import React, { createContext, useContext, useState, useEffect } from 'react';

const NotificationContext = createContext();

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  // Load notifications from localStorage on mount
  useEffect(() => {
    const storedNotifications = localStorage.getItem('notifications');
    if (storedNotifications) {
      setNotifications(JSON.parse(storedNotifications));
    } else {
      // Add demo notifications for testing
      const demoNotifications = [
        {
          id: Date.now() - 10000,
          type: 'task_assigned',
          taskId: 1,
          taskTitle: 'Complete project documentation',
          sender: 'Admin',
          receiver: 'EMP-1024',
          message: "New task 'Complete project documentation' assigned to you today by Admin",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          read: false
        },
        {
          id: Date.now() - 20000,
          type: 'task_reassigned',
          taskId: 4,
          taskTitle: 'Bug fixes in production',
          sender: 'Manager',
          receiver: 'EMP-1024',
          message: "Task 'Bug fixes in production' has been reassigned to you by Manager",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          read: false
        },
        {
          id: Date.now() - 30000,
          type: 'task_completed',
          taskId: 6,
          taskTitle: 'Update dependencies',
          sender: 'Rahul Sharma',
          receiver: 'manager',
          message: "Task 'Update dependencies' has been completed by Rahul Sharma",
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          read: true
        }
      ];
      setNotifications(demoNotifications);
    }
  }, []);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Get current user
  const getCurrentUser = () => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  };

  // Create notification
  const createNotification = (type, taskId, taskTitle, sender, receiver, message) => {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      taskId,
      taskTitle,
      sender,
      receiver,
      message,
      timestamp: new Date().toISOString(),
      read: false
    };

    setNotifications(prev => [notification, ...prev]);
    
    // Also store in user-specific notifications
    const userNotifications = JSON.parse(localStorage.getItem(`notifications_${receiver}`) || '[]');
    userNotifications.push(notification);
    localStorage.setItem(`notifications_${receiver}`, JSON.stringify(userNotifications));
  };

  // Task assigned notification
  const notifyTaskAssigned = (task, assignedBy, assignedTo) => {
    const message = `New task '${task.title}' assigned to you today by ${assignedBy}`;
    createNotification('task_assigned', task.id, task.title, assignedBy, assignedTo, message);
  };

  // Task reassigned notification
  const notifyTaskReassigned = (task, reassignedBy, reassignedTo) => {
    const message = `Task '${task.title}' has been reassigned to you by ${reassignedBy}`;
    createNotification('task_reassigned', task.id, task.title, reassignedBy, reassignedTo, message);
  };

  // Task completed notification (for managers)
  const notifyTaskCompleted = (task, completedBy) => {
    const message = `Task '${task.title}' has been completed by ${completedBy}`;
    createNotification('task_completed', task.id, task.title, completedBy, 'manager', message);
  };

  // Get notifications for current user
  const getUserNotifications = () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];
    
    return notifications.filter(notification => 
      notification.receiver === currentUser.email || 
      notification.receiver === currentUser.empId ||
      notification.receiver === 'all'
    );
  };

  // Get unread count for current user
  const getUnreadCount = () => {
    return getUserNotifications().filter(notification => !notification.read).length;
  };

  // Mark notification as read
  const markAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  // Mark all notifications as read for current user
  const markAllAsRead = () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    setNotifications(prev => 
      prev.map(notification => 
        (notification.receiver === currentUser.email || 
         notification.receiver === currentUser.empId ||
         notification.receiver === 'all') && !notification.read
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  // Delete notification
  const deleteNotification = (notificationId) => {
    setNotifications(prev => 
      prev.filter(notification => notification.id !== notificationId)
    );
  };

  // Clear all notifications for current user
  const clearAllNotifications = () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    setNotifications(prev => 
      prev.filter(notification => 
        notification.receiver !== currentUser.email && 
        notification.receiver !== currentUser.empId &&
        notification.receiver !== 'all'
      )
    );
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  // Get notification icon
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task_assigned':
        return 'fas fa-plus-circle';
      case 'task_reassigned':
        return 'fas fa-exchange-alt';
      case 'task_completed':
        return 'fas fa-check-circle';
      default:
        return 'fas fa-bell';
    }
  };

  // Get notification color
  const getNotificationColor = (type) => {
    switch (type) {
      case 'task_assigned':
        return '#10b981';
      case 'task_reassigned':
        return '#f59e0b';
      case 'task_completed':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const value = {
    notifications,
    showNotificationPanel,
    setShowNotificationPanel,
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    notifyTaskAssigned,
    notifyTaskReassigned,
    notifyTaskCompleted,
    formatTime,
    getNotificationIcon,
    getNotificationColor
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
