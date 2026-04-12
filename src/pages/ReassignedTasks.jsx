import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskContext } from "../context/taskContextStore";
import { fetchTaskNotes } from "../utils/taskNotes";
import TaskCard from "../components/TaskCard";
import RefreshWrapper from "../components/RefreshWrapper";

export default function ReassignedTasks() {
  const navigate = useNavigate();
  const { getTasksByStatus, updateTaskStatus, refreshTasks } = useTaskContext();
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalType, setModalType] = useState('');
  const [notesList, setNotesList] = useState([]);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Refresh tasks on mount to ensure latest reassigned tasks are visible
  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  const reassignedTasks = getTasksByStatus('reassigned')

  const handleReassignedRefresh = useCallback(async () => {
    if (!refreshTasks) return;
    await refreshTasks();
  }, [refreshTasks]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEmployeeName = (employeeId) => {
    const employees = {
      'EMP-1001': 'John Smith',
      'EMP-1002': 'Sarah Johnson',
      'EMP-1003': 'Mike Wilson',
      'EMP-1004': 'Emily Brown',
      'EMP-1024': 'Current User'
    };
    return employees[employeeId] || employeeId;
  };

  const loadTaskNotes = async (taskId) => {
    if (!taskId) return;
    setNoteLoading(true);
    setNoteError('');
    setNotesList([]);
    try {
      const notes = await fetchTaskNotes(taskId);
      setNotesList(notes);
    } catch (err) {
      console.error("Failed to load task notes:", err);
      setNoteError(err.response?.data?.error || err.message || "Unable to load notes.");
      setNotesList([]);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleAction = async (task, action) => {
    if (action === 'take-back') {
      try {
        const storedReassigned = JSON.parse(localStorage.getItem('reassignedTasks') || '[]');
        const filtered = storedReassigned.filter(t => t.id !== task.id);
        localStorage.setItem('reassignedTasks', JSON.stringify(filtered));
      } catch (error) {
        console.error('Failed to remove task from localStorage', error);
      }
      updateTaskStatus(task.id, 'todo', {
        reassignedAt: null,
        reassignedTo: null,
        reassignReason: null
      });
      return;
    }

    if (action === 'done') {
      setSelectedTask(task);
      setModalType(action);
      setShowModal(true);
      return;
    }

    if (action === 'note-view') {
      setSelectedTask(task);
      setModalType(action);
      setShowModal(true);
      await loadTaskNotes(task.id);
    }
  };

  const confirmComplete = () => {
    if (selectedTask) {
      // Remove from localStorage before changing status
      try {
        const storedReassigned = JSON.parse(localStorage.getItem('reassignedTasks') || '[]');
        const filtered = storedReassigned.filter(t => t.id !== selectedTask.id);
        localStorage.setItem('reassignedTasks', JSON.stringify(filtered));
      } catch (error) {
        console.error('Failed to remove task from localStorage', error);
      }
      updateTaskStatus(selectedTask.id, 'done', {
        completedAt: new Date().toISOString()
      });
      setShowModal(false);
      setSelectedTask(null);
      setModalType('');
      setNotesList([]);
      setNoteError('');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTask(null);
    setModalType('');
    setNotesList([]);
    setNoteError('');
    setNoteLoading(false);
  };

  return (
    <RefreshWrapper onRefresh={handleReassignedRefresh}>
      <div className="reassigned-tasks-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Reassigned Tasks</h1>
        <p className="page-subtitle">{reassignedTasks.length} task{reassignedTasks.length !== 1 ? 's' : ''} reassigned</p>
      </div>

      {/* Task Cards */}
      <div className="tasks-list">
        {reassignedTasks.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-user-pen"></i>
            <h3>No reassigned tasks</h3>
            <p>All tasks are with their current assignees!</p>
          </div>
        ) : (
          reassignedTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onAction={handleAction}
              actions={[
                { action: 'take-back', label: 'Take Back', icon: 'fa-undo', className: 'take-back' },
                { action: 'done', label: 'Complete', icon: 'fa-circle-check', className: 'complete' },
              ]}
              showViewNotes={false}
            />
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && selectedTask && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {modalType === 'note-view' ? (
              <>
                <div className="modal-icon note">
                  <i className="fas fa-sticky-note"></i>
                </div>
                <h3 className="modal-title">Task Notes</h3>
                {noteLoading ? (
                  <p className="modal-message">Loading notes...</p>
                ) : noteError ? (
                  <p className="modal-message" style={{ color: '#ef4444' }}>{noteError}</p>
                ) : notesList.length === 0 ? (
                  <p className="modal-message">No notes yet</p>
                ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
                    {notesList.map((note, idx) => (
                      <div key={idx} style={{
                        padding: '12px',
                        backgroundColor: '#f0f9ff',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        fontSize: '13px'
                      }}>
                        <strong>{note.employee_name || note.employeeName || "Unknown"}</strong>
                        <p style={{ marginTop: '4px', marginBottom: 0 }}>{note.note}</p>
                        <small style={{ color: '#94a3b8' }}>
                          {new Date(note.created_at || note.createdAt).toLocaleString()}
                        </small>
                      </div>
                    ))}
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn-cancel" onClick={closeModal}>Close</button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-icon reassigned">
                  <i className="fas fa-circle-check"></i>
                </div>
                <h3 className="modal-title">Complete Reassigned Task?</h3>
                <p className="modal-message">Are you sure you have completed this task?</p>
                
                <div className="task-details-modal">
                  <div className="detail-row">
                    <label>Task:</label>
                    <span>{selectedTask.title}</span>
                  </div>
                  <div className="detail-row">
                    <label>Reassigned to:</label>
                    <span>{getEmployeeName(selectedTask.reassignedTo)}</span>
                  </div>
                  <div className="detail-row">
                    <label>Reassigned:</label>
                    <span>{formatDate(selectedTask.reassignedAt)}</span>
                  </div>
                  {selectedTask.reassignReason && (
                    <div className="detail-row">
                      <label>Reason:</label>
                      <span>{selectedTask.reassignReason}</span>
                    </div>
                  )}
                </div>

                <div className="modal-actions">
                  <button className="btn-cancel" onClick={closeModal}>
                    Cancel
                  </button>
                  <button className="btn-confirm complete" onClick={confirmComplete}>
                    Complete
                  </button>
                </div>
              </>
            )}
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

        .reassigned-tasks-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #faf5ff 0%, #e9d5ff 100%);
          padding-bottom: 80px;
        }

        /* Page Header */
        .page-header {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
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
          color: #8b5cf6;
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
          margin-bottom: 8px;
        }

        .modal-message {
          font-size: 14px;
          color: #64748b;
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

        .btn-cancel,
        .btn-confirm {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-cancel {
          background: #f3f4f6;
          color: #6b7280;
        }

        .btn-cancel:hover {
          background: #e5e7eb;
        }

        .btn-confirm.complete {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
        }

        .btn-confirm.complete:hover {
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
          background: rgba(139, 92, 246, 0.08);
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
          color: #8b5cf6;
        }

        .nav-item.active span {
          color: #8b5cf6;
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
  </RefreshWrapper>
  );
}
