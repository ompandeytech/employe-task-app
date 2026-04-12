import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskContext } from "../context/taskContextStore";
import axios from "axios";
import { API_BASE, getAuthHeaders } from "../utils/apiConfig";
import TaskCard from "../components/TaskCard";
import { fetchTaskNotes } from "../utils/taskNotes";
import RefreshWrapper from "../components/RefreshWrapper";
import Select from "react-select";

/**
 * @typedef {'done'|'in-progress'|'pending'|'reassign'|'note-add'|'note-view'|''} ModalType
 */

const parseStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const resolveCurrentUserInfo = () => {
  const user = parseStoredUser();
  const id =
    user?.id ??
    user?.user_id ??
    user?.userId ??
    user?.employee_id ??
    user?.employeeId ??
    null;
  const name =
    user?.name ||
    user?.employee_name ||
    user?.employeeName ||
    user?.fullName ||
    user?.userName ||
    "Employee";
  return { id, name };
};


export default function Tasks() {
  const navigate = useNavigate();
  const { updateTaskStatus, getTodayTasks, refreshTasks } = useTaskContext();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(/** @type {ModalType} */ (''));
  const [selectedTask, setSelectedTask] = useState(null);
  const [pendingReason, setPendingReason] = useState('');
  const [reassignEmployee, setReassignEmployee] = useState(null);
  const [reassignReason, setReassignReason] = useState('');
  const [inProgressPercent, setInProgressPercent] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notesList, setNotesList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [noteStatus, setNoteStatus] = useState('');
  const noteStatusTimer = useRef(null);

  // Show all active (not done) tasks on this page
  const todoTasks = getTodayTasks();
  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;


  const loadEmployees = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/users`, {
        headers: getAuthHeaders(),
      });
      const data = Array.isArray(response.data) ? response.data : [];
      setEmployees(data);
      console.log("EMPLOYEES:", data);
    } catch (err) {
      console.error("Failed to load employees for reassignment:", err);
      setEmployees([]);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshTasks();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshTasks]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    console.log("EMPLOYEES:", employees);
  }, [employees]);

  useEffect(() => {
    return () => {
      if (noteStatusTimer.current) {
        clearTimeout(noteStatusTimer.current);
      }
    };
  }, []);

  const pushNoteStatus = (message) => {
    setNoteStatus(message);
    if (noteStatusTimer.current) {
      clearTimeout(noteStatusTimer.current);
    }
    noteStatusTimer.current = setTimeout(() => {
      setNoteStatus('');
    }, 4000);
  };

  const formatNoteTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const employeeOptions = useMemo(() => {
    return employees
      .map((emp) => {
        const rawId = emp?.id ?? emp?.employee_id;
        if (rawId == null) return null;
        return {
          value: rawId,
          label: emp?.name ?? emp?.employee_name ?? emp?.username ?? "No Name",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [employees]);

  const selectStyles = useMemo(
    () => ({
      menuPortal: (base) => ({ ...base, zIndex: 4000 }),
    }),
    []
  );

  const selectedEmployeeOption = useMemo(() => {
    if (reassignEmployee == null) return null;
    const exactMatch = employeeOptions.find((opt) => opt.value === reassignEmployee);
    if (exactMatch) return exactMatch;
    const selectedNumeric = Number(reassignEmployee);
    return (
      employeeOptions.find((opt) => {
        const optionNumeric = Number(opt.value);
        return (
          !Number.isNaN(optionNumeric) &&
          !Number.isNaN(selectedNumeric) &&
          optionNumeric === selectedNumeric
        );
      }) ?? null
    );
  }, [employeeOptions, reassignEmployee]);

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
      const message = err.response?.data?.error || err.message || "Unable to load notes.";
      setNoteError(message);
      setNotesList([]);
    } finally {
      setNoteLoading(false);
    }
  };


  const handleSubmitNote = async () => {
    if (!selectedTask) return;
    if (!noteText.trim()) {
      setNoteError('Please enter a note before saving.');
      return;
    }
    setNoteSaving(true);
    setNoteError('');
    const { id: employeeId, name: employeeName } = resolveCurrentUserInfo();
    try {
      await axios.post(
        `${API_BASE}/tasks/${selectedTask.id}/notes`,
        {
          employee_id: employeeId,
          employee_name: employeeName,
          note: noteText.trim(),
        },
        {
          headers: getAuthHeaders(),
        }
      );
      setNoteText('');
      setNotesList([]);
      setShowModal(false);
      setSelectedTask(null);
      setModalType('');
      setInProgressPercent('');
      pushNoteStatus("Note saved successfully.");
    } catch (err) {
      console.error("Failed to save note:", err);
      const message = err.response?.data?.error || err.message || "Unable to save note.";
      setNoteError(message);
    } finally {
      setNoteSaving(false);
    }
  };

  const handleAction = async (task, action) => {
    setSelectedTask(task);
    setModalType(action);
    setShowModal(true);
    setPendingReason('');
    setReassignEmployee(null);
    setReassignReason('');
    setInProgressPercent(
      action === 'in-progress'
        ? String(task?.progress ?? '')
        : ''
    );

    if (action === 'note-view') {
      await loadTaskNotes(task.id);
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
      case 'in-progress':
        if (inProgressPercent === '') {
          alert('Please enter task progress percentage');
          return;
        }
        if (Number(inProgressPercent) < 0 || Number(inProgressPercent) > 100) {
          alert('Progress must be between 0 and 100');
          return;
        }
        additionalData = { startedAt: new Date().toISOString() };
        additionalData.progress = Number(inProgressPercent);
        await updateTaskStatus(selectedTask.id, 'inprogress', additionalData);
        break;
      case 'pending':
        additionalData = { 
          pendingReason: pendingReason,
          pendingAt: new Date().toISOString()
        };
        await updateTaskStatus(selectedTask.id, 'pending', additionalData);
        break;
      case 'reassign':
        if (reassignEmployee == null) {
          alert('Please select an employee to reassign the task.');
          return;
        }
        additionalData = { 
          reassignReason: reassignReason,
          reassignedTo: reassignEmployee,
          reassignedAt: new Date().toISOString()
        };
        await updateTaskStatus(selectedTask.id, 'reassigned', additionalData);
        break;
    }

    setShowModal(false);
    setSelectedTask(null);
    setModalType('');
    setInProgressPercent('');
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTask(null);
    setModalType('');
    setInProgressPercent('');
    setNoteText('');
    setNotesList([]);
    setNoteError('');
    setNoteSaving(false);
    setNoteLoading(false);
  };

  return (
    <RefreshWrapper onRefresh={handleRefresh}>
      <div className="tasks-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Today's Tasks</h1>
        <button className="refresh-btn" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {noteStatus && <p className="note-status">{noteStatus}</p>}

      {/* Task Cards */}
      <div className="tasks-list">
        {todoTasks.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-check-circle"></i>
            <h3>No tasks to do!</h3>
            <p>All your tasks have been completed or moved to other statuses.</p>
          </div>
        ) : (
          todoTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onAction={handleAction}
              showAddNote={true}
              showViewNotes={true}
            />
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && selectedTask && (
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

            {/* In Progress Modal */}
            {modalType === 'in-progress' && (
              <>
                <div className="modal-icon in-progress">
                  <i className="fas fa-spinner"></i>
                </div>
                <h3 className="modal-title">Start Working on This Task?</h3>
                <p className="modal-message">Enter completed percentage to mark task as in progress</p>
                <div className="modal-input">
                  <label>Task progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={inProgressPercent}
                    onChange={(e) => setInProgressPercent(e.target.value)}
                    placeholder="Enter percentage (0-100)"
                  />
                </div>
                <div className="modal-actions">
                  <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                  <button className="btn-confirm in-progress" onClick={confirmAction}>Confirm</button>
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
                    options={employeeOptions}
                    value={selectedEmployeeOption}
                    onChange={(selected) => {
                      const selectedValue = selected?.value;
                      if (selectedValue == null) {
                        setReassignEmployee(null);
                        return;
                      }
                      const numericValue = Number(selectedValue);
                      setReassignEmployee(
                        Number.isFinite(numericValue) ? numericValue : selectedValue
                      );
                    }}
                    className="employee-select"
                    classNamePrefix="react-select"
                    styles={selectStyles}
                    placeholder="Select Employee"
                    noOptionsMessage={() =>
                      employeeOptions.length === 0 ? "No employees found" : "No matching employees"
                    }
                    isClearable
                    menuPortalTarget={menuPortalTarget}
                    menuPlacement="auto"
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
              {modalType === 'note-add' && (
                <>
                  <div className="modal-icon note">
                    <i className="fas fa-pen"></i>
                  </div>
                  <h3 className="modal-title">Add Note</h3>
                  <div className="modal-input">
                    <label>Note</label>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Describe any context, blockers, or updates."
                      rows={4}
                    />
                  </div>
                  {noteError && <p className="modal-error">{noteError}</p>}
                  <div className="modal-actions">
                    <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                    <button className="btn-confirm note" onClick={handleSubmitNote} disabled={noteSaving}>
                      {noteSaving ? "Saving..." : "Save Note"}
                    </button>
                  </div>
                </>
              )}
              {modalType === 'note-view' && (
                <>
                  <div className="modal-icon note-view">
                    <i className="fas fa-eye"></i>
                  </div>
                  <h3 className="modal-title">Task Notes</h3>
                  {noteError && <p className="modal-error">{noteError}</p>}
                  {noteLoading ? (
                    <p className="modal-message">Loading notes...</p>
                  ) : (
                    <div className="modal-note-list">
                      {notesList.length === 0 ? (
                        <p className="note-empty">No notes yet for this task.</p>
                      ) : (
                        notesList.map((note, index) => (
                          <div className="modal-note-item" key={note.id ?? `${selectedTask?.id}-${index}`}>
                            <div className="note-meta">
                              <strong>{note.employee_name || note.employeeName || "Unknown"}</strong>
                              <span>{formatNoteTime(note.created_at || note.createdAt)}</span>
                            </div>
                            <p>{note.note || note.text || "-"}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <div className="modal-actions">
                    <button className="btn-cancel" onClick={closeModal}>Close</button>
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
        <div className="nav-item active" onClick={() => navigate("/tasks")}>
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

        .tasks-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          padding-bottom: 80px;
        }

        /* Page Header */
        .page-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .page-title {
          color: white;
          font-size: 24px;
          font-weight: 700;
          margin: 0;
        }

        .refresh-btn {
          border: 1px solid rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.15);
          color: white;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 12px;
          cursor: pointer;
        }

          .pull-hint {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: #64748b;
            transition: height 0.2s ease;
            overflow: hidden;
          }

          .note-status {
            margin: 0;
            text-align: center;
            font-size: 0.95rem;
            color: #059669;
            padding: 0 16px;
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
          max-height: 80vh;
          overflow-y: auto;
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
        }

        .modal-icon.done {
          background: linear-gradient(135deg, #10b981, #059669);
        }

        .modal-icon.in-progress {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .modal-icon.pending {
          background: linear-gradient(135deg, #f97316, #ea580c);
        }

          .modal-icon.reassign {
            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          }

          .modal-icon.note {
            background: linear-gradient(135deg, #2563eb, #0ea5e9);
          }

          .modal-icon.note-view {
            background: linear-gradient(135deg, #0ea5e9, #7dd3fc);
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
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
        }

        .modal-input textarea,
        .modal-input input,
        .modal-input select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
        }

          .modal-input textarea:focus,
          .modal-input input:focus,
          .modal-input select:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          .modal-error {
            color: #dc2626;
            font-size: 0.9rem;
            text-align: center;
            margin-bottom: 12px;
          }

          .modal-note-list {
            max-height: 280px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 12px;
          }

          .modal-note-item {
            border-radius: 12px;
            padding: 12px;
            border: 1px solid #e5e7eb;
            background: #f8fafc;
            box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
          }

          .modal-note-item p {
            margin: 0;
            font-size: 14px;
            color: #1e293b;
            line-height: 1.5;
          }

          .note-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: #475569;
            margin-bottom: 6px;
          }

          .note-empty {
            text-align: center;
            color: #94a3b8;
            font-size: 0.95rem;
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

        .btn-confirm.done {
          background: linear-gradient(135deg, #10b981, #059669);
        }

        .btn-confirm.in-progress {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .btn-confirm.pending {
          background: linear-gradient(135deg, #f97316, #ea580c);
        }

          .btn-confirm.reassign {
            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          }

        .btn-confirm.note {
          background: linear-gradient(135deg, #2563eb, #0ea5e9);
        }

        .employee-select {
          margin-top: 6px;
        }

        .react-select__control {
          border-radius: 12px;
          border-color: #cbd5f5;
          min-height: 48px;
        }

        .react-select__menu {
          z-index: 1500;
        }

        .react-select__menu-list {
          max-height: 260px;
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
          color: #667eea;
        }

        .nav-item.active span {
          color: #667eea;
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
          .action-buttons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  </RefreshWrapper>
  );
}
