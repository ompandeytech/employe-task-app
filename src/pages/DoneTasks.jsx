import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskContext } from "../context/taskContextStore";

export default function DoneTasks({ setOpenMenu }) {
  const navigate = useNavigate();
  const { getTasksByStatus } = useTaskContext();
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const doneTasks = getTasksByStatus('done');

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="done-tasks-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Completed Tasks</h1>
        <p className="page-subtitle">Great job! {doneTasks.length} task{doneTasks.length !== 1 ? 's' : ''} completed</p>
      </div>

      {/* Task Cards */}
      <div className="tasks-list">
        {doneTasks.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-trophy"></i>
            <h3>No completed tasks yet</h3>
            <p>Start working on your tasks to see them here!</p>
          </div>
        ) : (
          doneTasks.map(task => (
            <div 
              key={task.id} 
              className="task-card completed"
            >
              {/* Success Badge */}
              <div className="success-badge">
                <i className="fas fa-check-circle"></i>
                <span>COMPLETED</span>
              </div>

              {/* Task Content */}
              <div className="task-content">
                <h3 className="task-title">{task.title}</h3>
                <p className="task-description">{task.description}</p>
                
                <div className="task-details">
                  <div className="detail-item">
                    <i className="fas fa-user"></i>
                    <span>Assigned To: {task.assignedTo}</span>
                  </div>
                  <div className="detail-item">
                    <i className="fas fa-calendar-check"></i>
                    <span>Completed: {formatDate(task.completedAt)}</span>
                  </div>
                </div>
              </div>

              {/* View Details Button */}
              <button 
                className="view-details-btn"
                onClick={() => {
                  setSelectedTask(task);
                  setShowModal(true);
                }}
              >
                <i className="fas fa-eye"></i>
                <span>View Details</span>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Task Details Modal */}
      {showModal && selectedTask && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon done">
              <i className="fas fa-trophy"></i>
            </div>
            <h3 className="modal-title">Task Completed!</h3>
            
            <div className="task-details-modal">
              <div className="detail-row">
                <label>Task:</label>
                <span>{selectedTask.title}</span>
              </div>
              <div className="detail-row">
                <label>Description:</label>
                <span>{selectedTask.description}</span>
              </div>
              <div className="detail-row">
                <label>Assigned To:</label>
                <span>{selectedTask.assignedTo}</span>
              </div>
              <div className="detail-row">
                <label>Completed At:</label>
                <span>{formatDate(selectedTask.completedAt)}</span>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-close" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Soft Bottom Navigation */}
      <div className="soft-bottom-nav">
        <div className="nav-item" onClick={() => navigate("/")}>
          <i className="fas fa-home"></i>
          <span>Home</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/tasks")}>
          <i className="fas fa-tasks"></i>
          <span>Tasks</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/report")}>
          <i className="fas fa-chart-line"></i>
          <span>Report</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/profile")}>
          <i className="fas fa-user"></i>
          <span>Profile</span>
        </div>
      </div>

      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f8fafc;
          color: #1e293b;
        }

        .done-tasks-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          padding-bottom: 80px;
        }

        /* Page Header */
        .page-header {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .page-title {
          color: white;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .page-subtitle {
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          font-weight: 500;
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #64748b;
        }

        .empty-state i {
          font-size: 48px;
          color: #10b981;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .empty-state p {
          font-size: 14px;
          color: #64748b;
        }

        /* Tasks List */
        .tasks-list {
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Task Card */
        .task-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 8px 32px rgba(16, 185, 129, 0.15);
          border-left: 4px solid #10b981;
          position: relative;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .task-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(16, 185, 129, 0.2);
        }

        .success-badge {
          position: absolute;
          top: -10px;
          right: 20px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .success-badge i {
          font-size: 10px;
        }

        .task-content {
          margin-bottom: 16px;
          padding-top: 10px;
        }

        .task-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .task-description {
          font-size: 14px;
          color: #64748b;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .task-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #475569;
        }

        .detail-item i {
          font-size: 12px;
          color: #10b981;
        }

        .view-details-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 16px;
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .view-details-btn:hover {
          background: rgba(16, 185, 129, 0.2);
          transform: translateY(-1px);
        }

        .view-details-btn i {
          font-size: 14px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }

        .modal-card {
          background: white;
          border-radius: 20px;
          padding: 24px;
          margin: 20px;
          max-width: 400px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease;
        }

        .modal-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 24px;
          color: white;
          background: linear-gradient(135deg, #10b981, #059669);
        }

        .modal-title {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          text-align: center;
          margin-bottom: 20px;
        }

        .task-details-modal {
          margin-bottom: 20px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
        }

        .detail-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .detail-row label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          min-width: 80px;
        }

        .detail-row span {
          font-size: 13px;
          color: #64748b;
          text-align: right;
          flex: 1;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
        }

        .btn-close {
          flex: 1;
          padding: 12px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-close:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        /* Soft Bottom Navigation */
        .soft-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(15px);
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 12px 0;
          box-shadow: 0 -2px 15px rgba(0, 0, 0, 0.06);
          z-index: 1000;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 8px 16px;
          border-radius: 12px;
        }

        .nav-item:hover {
          background: rgba(16, 185, 129, 0.08);
          transform: translateY(-1px);
        }

        .nav-item i {
          font-size: 18px;
          color: #94a3b8;
          transition: color 0.2s ease;
        }

        .nav-item span {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          transition: color 0.2s ease;
        }

        .nav-item.active i {
          color: #10b981;
        }

        .nav-item.active span {
          color: #10b981;
          font-weight: 600;
        }

        /* Animations */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Responsive Design */
        @media (max-width: 480px) {
          .detail-row {
            flex-direction: column;
            gap: 4px;
          }

          .detail-row label {
            min-width: auto;
          }

          .detail-row span {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}
