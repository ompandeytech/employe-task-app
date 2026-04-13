import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE, getAuthHeaders } from "../utils/apiConfig";
import Select from "react-select";
import { useTaskContext } from "../context/taskContextStore";
import TaskCard from "../components/TaskCard";
import { fetchTaskNotes } from "../utils/taskNotes";
import RefreshWrapper from "../components/RefreshWrapper";

const getStoredUser = () => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

export default function InProgressTasks() {
  const navigate = useNavigate();
  const { getTasksByStatus, updateTaskStatus, refreshTasks } = useTaskContext();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [pendingReason, setPendingReason] = useState('');
  const [reassignEmployee, setReassignEmployee] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [employees, setEmployees] = useState([]);
  const [notesList, setNotesList] = useState([]);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState('');
  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;

  const inProgressTasks = getTasksByStatus('inprogress');
  const modalRoot = typeof document !== "undefined" ? document.body : null;

  const handleInProgressRefresh = useCallback(async () => {
    if (!refreshTasks) return;
    await refreshTasks();
  }, [refreshTasks]);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const response = await axios.get(`${API_BASE}/users`, {
          headers: getAuthHeaders(),
        });
        const data = Array.isArray(response.data) ? response.data : [];
        setEmployees(data);
      } catch (err) {
        console.error("Failed to load employees:", err);
        setEmployees([]);
      }
    };
    loadEmployees();
  }, []);

  const employeeOptions = useMemo(() => {
    return employees
      .map((emp) => {
        const rawId = emp?.id ?? emp?.employee_id;
        if (rawId == null) return null;
        return {
          value: rawId,
          label: emp?.name ?? emp?.employee_name ?? emp?.username ?? "Employee",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [employees]);

  const handleAction = async (task, action) => {
    setSelectedTask(task);
    setModalType(action);
    setShowModal(true);
    setPendingReason('');
    setReassignEmployee('');
    setReassignReason('');
    setNotesList([]);
    setNoteError('');

    if (action === 'note-view') {
      setNoteLoading(true);
      try {
        const notes = await fetchTaskNotes(task.id);
        setNotesList(notes);
      } catch (err) {
        console.error("Failed to load task notes:", err);
        setNoteError(err.response?.data?.error || err.message || "Unable to load notes.");
        setNotesList([]);
      } finally {
        setNoteLoading(false);
      }
    }
  };

  const confirmAction = async () => {
    if (!selectedTask) return;

    let additionalData = {};
    
    switch(modalType) {
      case 'done':
        additionalData = { completedAt: new Date().toISOString() };
        await updateTaskStatus(selectedTask.id, 'done', additionalData);
        break;
      case 'pending':
        additionalData = { 
          pendingReason: pendingReason,
          pendingAt: new Date().toISOString()
        };
        await updateTaskStatus(selectedTask.id, 'pending', additionalData);
        break;
      case 'reassign': {
        if (!reassignEmployee) {
          alert('Please select an employee to reassign the task.');
          return;
        }
        const selectedEmployee = employeeOptions.find(
          (option) => String(option.value) === String(reassignEmployee)
        );
        if (!selectedEmployee) {
          alert('Selected employee is not valid. Please choose from the list.');
          return;
        }
        const storedUser = getStoredUser();
        const reassignedByName =
          storedUser?.name ||
          storedUser?.fullName ||
          storedUser?.employee_name ||
          storedUser?.userName ||
          "Admin";
        additionalData = { 
          reassignReason: reassignReason,
          reassignedTo: selectedEmployee.value,
          reassignedToName: selectedEmployee.label,
          reassignedAt: new Date().toISOString(),
          reassignedBy: reassignedByName,
        };
        await updateTaskStatus(selectedTask.id, 'reassigned', additionalData);
        break;
      }
    }

    closeModal();
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTask(null);
    setModalType('');
    setPendingReason('');
    setReassignEmployee('');
    setReassignReason('');
    setNotesList([]);
    setNoteError('');
  };


  return (
    <>
      <RefreshWrapper onRefresh={handleInProgressRefresh}>
        <div className="inprogress-tasks-container inprogress-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">In Progress</h1>
        <p className="page-subtitle">{inProgressTasks.length} task{inProgressTasks.length !== 1 ? 's' : ''} being worked on</p>
      </div>

      {/* Task Cards */}
      <div className="tasks-list">
        {inProgressTasks.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-spinner"></i>
            <h3>No tasks in progress</h3>
            <p>Start working on your tasks to see them here!</p>
          </div>
        ) : (
          inProgressTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onAction={handleAction}
              actions={[
                { action: 'done', label: 'Done', icon: 'fa-circle-check', className: 'done' },
                { action: 'pending', label: 'Pending', icon: 'fa-clock', className: 'pending' },
                { action: 'reassign', label: 'Reassign', icon: 'fa-user-pen', className: 'reassign' },
              ]}
              showViewNotes={true}
            />
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && selectedTask && modalRoot &&
        createPortal(
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              {/* Done Modal */}
              {modalType === 'done' && (
                <>
                  <div className="modal-icon done">
                    <i className="fas fa-circle-check"></i>
                  </div>
                  <h3 className="modal-title">Mark Task as Done?</h3>
                  <p className="modal-message">Are you sure you have completed this task?</p>
                  <div className="modal-actions">
                    <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                    <button className="btn-confirm done" onClick={confirmAction}>Confirm</button>
                  </div>
                </>
              )}

              {/* Pending Modal */}
              {modalType === 'pending' && (
                <>
                  <div className="modal-icon pending">
                    <i className="fas fa-clock"></i>
                  </div>
                  <h3 className="modal-title">Mark Task as Pending</h3>
                  <div className="modal-input">
                    <label>Enter reason for pending</label>
                    <textarea
                      value={pendingReason}
                      onChange={(e) => setPendingReason(e.target.value)}
                      placeholder="Why is this task pending?"
                      rows={3}
                    />
                  </div>
                  <div className="modal-actions">
                    <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                    <button className="btn-confirm pending" onClick={confirmAction}>Submit</button>
                  </div>
                </>
              )}

              {/* Reassign Modal */}
              {modalType === 'reassign' && (
                <>
                  <div className="modal-icon reassign">
                    <i className="fas fa-user-pen"></i>
                  </div>
                  <h3 className="modal-title">Reassign Task</h3>
                <div className="modal-input">
                  <label>Select Employee</label>
                  <Select
                    value={employeeOptions.find((opt) => opt.value === reassignEmployee) ?? null}
                    options={employeeOptions}
                    onChange={(option) => setReassignEmployee(option?.value ?? "")}
                    placeholder="Select employee"
                    menuPortalTarget={menuPortalTarget}
                    styles={{
                      menuPortal: (base) => ({ ...base, zIndex: 99999 }),
                      menu: (base) => ({ ...base, zIndex: 99999 }),
                    }}
                  />
                </div>
                  <div className="modal-input">
                    <label>Reason for reassignment</label>
                    <textarea
                      value={reassignReason}
                      onChange={(e) => setReassignReason(e.target.value)}
                      placeholder="Why are you reassigning this task?"
                      rows={3}
                    />
                  </div>
                  <div className="modal-actions">
                    <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                    <button className="btn-confirm reassign" onClick={confirmAction}>Reassign</button>
                  </div>
                </>
              )}

              {/* View Notes Modal */}
              {modalType === 'note-view' && (
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
              )}
            </div>
          </div>,
          modalRoot
        )}

        </div>
      </RefreshWrapper>

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

        .inprogress-tasks-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          padding-bottom: 80px;
        }

        .inprogress-container {
          padding-bottom: 100px;
        }

        /* Page Header */
        .page-header {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
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
          color: #3b82f6;
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

        .modal-icon.done {
          background: linear-gradient(135deg, #10b981, #059669);
        }

        .modal-icon.pending {
          background: linear-gradient(135deg, #f97316, #ea580c);
        }

        .modal-icon.reassign {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        }

        .modal-icon.note {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
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

        .modal-input {
          margin-bottom: 16px;
        }

        .modal-input label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }

        .modal-input input,
        .modal-input textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
        }

        .modal-input textarea {
          resize: vertical;
        }

        .modal-input input:focus,
        .modal-input textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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

        .btn-confirm {
          color: white;
        }

        .btn-confirm.complete {
          background: linear-gradient(135deg, #10b981, #059669);
        }

        .btn-confirm.complete:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .btn-confirm.pending {
          background: linear-gradient(135deg, #f97316, #ea580c);
        }

        .btn-confirm.pending:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
        }

        .btn-confirm.reassign {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        }

        .btn-confirm.reassign:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .btn-confirm.done {
          background: linear-gradient(135deg, #10b981, #059669);
        }

        .btn-confirm.done:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        /* Soft Bottom Navigation */
        .soft-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 480px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(15px);
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 12px 0;
          box-shadow: 0 -2px 15px rgba(0, 0, 0, 0.06);
          z-index: 9999;
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
          background: rgba(59, 130, 246, 0.08);
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
          color: #3b82f6;
        }

        .nav-item.active span {
          color: #3b82f6;
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
    </>
  );
}
