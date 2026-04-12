import React from 'react';
import { useNotificationContext } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

const NotificationBell = () => {
  const navigate = useNavigate();
  const {
    showNotificationPanel,
    setShowNotificationPanel,
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    formatTime,
    getNotificationIcon,
    getNotificationColor
  } = useNotificationContext();

  const userNotifications = getUserNotifications();
  const unreadCount = getUnreadCount();

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    setShowNotificationPanel(false);
    
    // Navigate to task details if task ID exists
    if (notification.taskId) {
      navigate(`/tasks`);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleClearAll = () => {
    clearAllNotifications();
    setShowNotificationPanel(false);
  };

  return (
    <div className="notification-bell-container">
      {/* Bell Icon */}
      <div 
        className="notification-bell"
        onClick={() => setShowNotificationPanel(!showNotificationPanel)}
      >
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && (
          <div className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </div>

      {/* Notification Panel */}
      {showNotificationPanel && (
        <>
          <div 
            className="notification-overlay"
            onClick={() => setShowNotificationPanel(false)}
          />
          <div className="notification-panel">
            {/* Header */}
            <div className="notification-header">
              <h3>Notifications</h3>
              <div className="notification-actions">
                {unreadCount > 0 && (
                  <button 
                    className="mark-all-read-btn"
                    onClick={handleMarkAllAsRead}
                  >
                    Mark all as read
                  </button>
                )}
                {userNotifications.length > 0 && (
                  <button 
                    className="clear-all-btn"
                    onClick={handleClearAll}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="notifications-list">
              {userNotifications.length === 0 ? (
                <div className="no-notifications">
                  <i className="fas fa-bell-slash"></i>
                  <p>No notifications yet</p>
                </div>
              ) : (
                userNotifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div 
                      className="notification-icon"
                      style={{ color: getNotificationColor(notification.type) }}
                    >
                      <i className={getNotificationIcon(notification.type)}></i>
                    </div>
                    <div className="notification-content">
                      <div className="notification-message">
                        {notification.message}
                      </div>
                      <div className="notification-meta">
                        <span className="notification-sender">
                          From: {notification.sender}
                        </span>
                        <span className="notification-time">
                          {formatTime(notification.timestamp)}
                        </span>
                      </div>
                    </div>
                    <div className="notification-actions-right">
                      {!notification.read && (
                        <div className="unread-indicator"></div>
                      )}
                      <button
                        className="delete-notification"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        .notification-bell-container {
          position: relative;
          z-index: 1001;
        }

        .notification-bell {
          width: 40px;
          height: 40px;
          border: none;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
          position: relative;
        }

        .notification-bell:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }

        .notification-bell i {
          color: #64748b;
          font-size: 16px;
          transition: color 0.3s ease;
        }

        .notification-bell:hover i {
          color: #3b82f6;
        }

        .notification-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
        }

        .notification-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: transparent;
          z-index: 999;
        }

        .notification-panel {
          position: fixed;
          top: 80px;
          right: 20px;
          width: 380px;
          max-height: 480px;
          background: white;
          border-radius: 20px;
          box-shadow: 
            0 20px 40px rgba(0, 0, 0, 0.15),
            0 0 0 1px rgba(255, 255, 255, 0.8);
          z-index: 1002;
          overflow: hidden;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .notification-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        .notification-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .notification-actions {
          display: flex;
          gap: 8px;
        }

        .mark-all-read-btn,
        .clear-all-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .mark-all-read-btn {
          background: #f0f9ff;
          color: #0369a1;
        }

        .mark-all-read-btn:hover {
          background: #e0f2fe;
        }

        .clear-all-btn {
          background: #fef2f2;
          color: #dc2626;
        }

        .clear-all-btn:hover {
          background: #fee2e2;
        }

        .notifications-list {
          max-height: 380px;
          overflow-y: auto;
        }

        .no-notifications {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #94a3b8;
        }

        .no-notifications i {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .no-notifications p {
          font-size: 16px;
          font-weight: 500;
        }

        .notification-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 24px;
          border-bottom: 1px solid #f8fafc;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }

        .notification-item:hover {
          background: #f8fafc;
        }

        .notification-item.unread {
          background: linear-gradient(90deg, #f0f9ff 0%, #ffffff 100%);
          border-left: 3px solid #3b82f6;
        }

        .notification-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(59, 130, 246, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 16px;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-message {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          line-height: 1.4;
          margin-bottom: 4px;
        }

        .notification-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #64748b;
        }

        .notification-sender {
          font-weight: 500;
        }

        .notification-time {
          opacity: 0.8;
        }

        .notification-actions-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .unread-indicator {
          width: 8px;
          height: 8px;
          background: #3b82f6;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .delete-notification {
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #94a3b8;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }

        .delete-notification:hover {
          background: #fef2f2;
          color: #ef4444;
        }

        .delete-notification i {
          font-size: 12px;
        }

        /* Scrollbar styling */
        .notifications-list::-webkit-scrollbar {
          width: 4px;
        }

        .notifications-list::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        .notifications-list::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }

        .notifications-list::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Responsive design */
        @media (max-width: 480px) {
          .notification-panel {
            width: calc(100vw - 32px);
            right: -16px;
            left: 16px;
          }

          .notification-header {
            padding: 16px 20px 12px;
          }

          .notification-item {
            padding: 14px 20px;
          }

          .notification-message {
            font-size: 13px;
          }

          .notification-meta {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationBell;
