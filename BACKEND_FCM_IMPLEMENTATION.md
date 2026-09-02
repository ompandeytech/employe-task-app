# Backend FCM Implementation Requirements

## Overview
This document outlines the backend implementation requirements for Firebase Cloud Messaging (FCM) push notifications in the Employee Task App.

## Firebase Configuration
- **Firebase Project**: techiohisab-video
- **Project ID**: techiohisab-video
- **Android Package**: com.techio.employee
- **FCM Sender ID**: 133954422100

## Required Backend Endpoints

### 1. Device Token Registration
**Endpoint**: `POST /api/devices/register`

**Request Body**:
```json
{
  "userId": "string",
  "token": "string",
  "platform": "android"
}
```

**Response**: 
- Success: 200 OK
- Error: 400/500 with error message

**Purpose**: Store FCM device tokens associated with employee users for sending push notifications.

**Database Requirements**:
- Create or verify `employee_devices` table with columns:
  - `id` (primary key)
  - `user_id` (references employees table)
  - `fcm_token` (string, indexed)
  - `platform` (string: 'android', 'ios', etc.)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
  - `is_active` (boolean, default true)

**Business Logic**:
- Check if token already exists for user
- If exists, update `updated_at` timestamp
- If not exists, create new record
- Support multiple devices per user (same user can have multiple tokens)
- Handle token de-duplication

### 2. Device Token Update
**Endpoint**: `PUT /api/devices/update`

**Request Body**:
```json
{
  "userId": "string",
  "oldToken": "string",
  "newToken": "string",
  "platform": "android"
}
```

**Purpose**: Update FCM token when it refreshes (tokens can refresh periodically).

**Business Logic**:
- Find device record by userId and oldToken
- Update with newToken and refresh timestamp
- Handle cases where oldToken doesn't exist (create new)

### 3. Device Token Removal
**Endpoint**: `DELETE /api/devices/remove`

**Request Body**:
```json
{
  "userId": "string",
  "token": "string"
}
```

**Purpose**: Remove device token when user logs out or uninstalls app.

**Business Logic**:
- Soft delete (set is_active = false) or hard delete
- Clean up invalid tokens periodically

## Firebase Admin SDK Setup

### Installation
```bash
npm install firebase-admin
```

### Configuration
- Download service account key from Firebase Console
- Store service account JSON securely (environment variable or secret manager)
- NEVER commit service account credentials to git

### Initialization
```javascript
const admin = require('firebase-admin');

// Initialize with environment variable or secure config
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'techiohisab-video'
});
```

## Notification Sending Functions

### Send Push Notification
```javascript
async function sendPushNotification(userIds, notification) {
  // Get active FCM tokens for users
  const tokens = await getActiveFCMTokens(userIds);
  
  if (tokens.length === 0) {
    console.log('No active tokens found for users');
    return;
  }

  const message = {
    notification: {
      title: notification.title,
      body: notification.body
    },
    data: notification.data || {},
    tokens: tokens
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    
    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      await cleanupInvalidTokens(failedTokens);
    }
    
    console.log(`Successfully sent ${response.successCount} notifications`);
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}
```

### Helper Functions
```javascript
async function getActiveFCMTokens(userIds) {
  // Query database for active FCM tokens
  const tokens = await db.query(`
    SELECT fcm_token 
    FROM employee_devices 
    WHERE user_id IN (?) AND is_active = true
  `, [userIds]);
  
  return tokens.map(t => t.fcm_token);
}

async function cleanupInvalidTokens(tokens) {
  // Mark invalid tokens as inactive
  await db.query(`
    UPDATE employee_devices 
    SET is_active = false 
    WHERE fcm_token IN (?)
  `, [tokens]);
}
```

## Notification Events Integration

### 1. New Task Assignment
**Trigger**: When a task is assigned to an employee

**When to send**: After successful task creation in database

**Notification Content**:
```javascript
{
  title: "New Task Assigned",
  body: "You have received a new task.",
  data: {
    type: "task_assigned",
    taskId: task.id
  }
}
```

**Integration Point**: In task creation endpoint after database insert

### 2. Task Reassignment
**Trigger**: When a task is reassigned to a different employee

**When to send**: After successful task reassignment in database

**Notification Content**:
```javascript
{
  title: "Task Reassigned",
  body: "A task has been reassigned to you.",
  data: {
    type: "task_reassigned",
    taskId: task.id
  }
}
```

**Integration Point**: In task reassignment endpoint after database update

### 3. Salary Payment
**Trigger**: When salary is marked as "Paid" for an employee

**When to send**: After successful salary status update in database

**Notification Content**:
```javascript
{
  title: "Salary Update",
  body: "Your salary has been marked as paid.",
  data: {
    type: "salary_paid",
    salaryId: salary.id
  }
}
```

**Integration Point**: In salary update endpoint after database update

## Error Handling Guidelines

### Notification Failure Rules
- **NEVER** let notification failure cause the main operation to fail
- Log notification errors separately
- Continue with main business logic even if notifications fail
- Implement retry logic for transient failures
- Monitor notification delivery rates

### Example Error Handling
```javascript
try {
  // Main business operation (e.g., create task)
  const task = await createTask(taskData);
  
  // Send notification (non-blocking)
  sendPushNotification([task.assignedTo], {
    title: "New Task Assigned",
    body: "You have received a new task.",
    data: { type: "task_assigned", taskId: task.id }
  }).catch(err => {
    console.error('Notification failed but task was created:', err);
    // Don't throw, task creation was successful
  });
  
  return task;
} catch (error) {
  // Handle main operation error
  throw error;
}
```

## Security Considerations

### Firebase Service Account
- Store in environment variable: `FIREBASE_SERVICE_ACCOUNT_KEY`
- Use secret management system in production
- Rotate credentials periodically
- Restrict service account permissions to minimum required

### API Security
- Device registration endpoints must be authenticated
- Validate that userId matches authenticated user
- Rate limit device registration endpoints
- Validate token format before storage

### Data Privacy
- Don't include sensitive information in notification payloads
- Use notification data payload for minimal metadata
- Keep PII out of push notification titles/bodies

## Testing Recommendations

### Unit Tests
- Test device token CRUD operations
- Test Firebase Admin SDK initialization
- Test notification sending with mock tokens

### Integration Tests
- Test end-to-end notification flow
- Test token refresh scenarios
- Test invalid token cleanup

### Manual Testing
- Use Firebase Console to send test notifications
- Verify notifications appear on Android device
- Test foreground, background, and killed app states

## Monitoring and Logging

### Key Metrics
- Notification delivery success rate
- Token registration/failure rates
- API endpoint response times
- Invalid token cleanup frequency

### Logging
- Log notification send attempts (with user IDs, not tokens)
- Log Firebase SDK errors
- Log API endpoint errors
- Monitor quota usage (Firebase has limits)

## Deployment Checklist

- [ ] Firebase Admin SDK installed
- [ ] Service account key configured securely
- [ ] Database tables created/migrated
- [ ] API endpoints implemented
- [ ] Notification event integrations added
- [ ] Error handling implemented
- [ ] Monitoring/logging configured
- [ ] Testing completed in staging environment
- [ ] Environment variables configured for production
- [ ] Rate limiting configured
- [ ] Database indexes created on fcm_token column

## Frontend-Backend Contract

### Frontend Will:
- Call `POST /api/devices/register` after successful login
- Provide `userId`, `token`, and `platform` in request body
- Include authentication token in request headers
- Handle registration failures gracefully (no user-facing errors)

### Backend Will:
- Accept device registration requests from authenticated users
- Store tokens securely in database
- Support multiple devices per user
- Return appropriate HTTP status codes
- Never expose sensitive data in responses

## Troubleshooting

### Common Issues

**Notifications not arriving**:
- Verify device tokens are valid and active
- Check Firebase project configuration
- Verify API key permissions
- Check notification payload format

**Invalid token errors**:
- Implement automatic token cleanup
- Check for token refresh issues
- Verify token format in database

**High failure rates**:
- Check Firebase quota limits
- Verify network connectivity
- Check for malformed notification payloads
- Review Firebase console for project issues

## Contact Information
For questions about this implementation, contact the frontend development team with the context of this document.