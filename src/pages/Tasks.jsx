import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTaskContext } from "../context/taskContextStore";
import axios from "axios";
import { API_BASE, getAuthHeaders } from "../utils/apiConfig";
import TaskCard from "../components/TaskCard";
import RefreshWrapper from "../components/RefreshWrapper";
import WorkspaceBottomNav from "../components/WorkspaceBottomNav";
import Select from "react-select";
import { fetchTaskNotes } from "../utils/taskNotes";

const getStoredUser = () => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

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

export default function Tasks() {
  const { updateTaskStatus, getTodayTasks, refreshTasks } = useTaskContext();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [pendingReason, setPendingReason] = useState("");
  const [reassignEmployee, setReassignEmployee] = useState(null);
  const [reassignReason, setReassignReason] = useState("");
  const [inProgressPercent, setInProgressPercent] = useState("");
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [notesList, setNotesList] = useState([]);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const noteStatusTimer = useRef(null);

  const todoTasks = getTodayTasks();
  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;
  const modalRoot = typeof document !== "undefined" ? document.body : null;

  const loadEmployees = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/users`, {
        headers: getAuthHeaders(),
      });
      const data = Array.isArray(response.data) ? response.data : [];
      setEmployees(data);
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
    return () => {
      if (noteStatusTimer.current) {
        clearTimeout(noteStatusTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return () => {};
    const body = document.body;
    if (showModal) {
      body.classList.add("modal-open");
    } else {
      body.classList.remove("modal-open");
    }
    return () => {
      body.classList.remove("modal-open");
    };
  }, [showModal]);

  const pushNoteStatus = (message) => {
    setNoteStatus(message);
    if (noteStatusTimer.current) {
      clearTimeout(noteStatusTimer.current);
    }
    noteStatusTimer.current = setTimeout(() => {
      setNoteStatus("");
    }, 4000);
  };

  const loadTaskNotes = async (taskId) => {
    if (!taskId) return;
    setNoteLoading(true);
    setNoteError("");
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

  const openAddNoteModal = (task) => {
    setSelectedTask(task);
    setModalType("note-add");
    setNoteText("");
    setNoteError("");
    setNotesList([]);
    setShowModal(true);
  };

  const openViewNotesModal = async (task) => {
    setSelectedTask(task);
    setModalType("note-view");
    setNoteError("");
    setNotesList([]);
    setShowModal(true);
    await loadTaskNotes(task.id);
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

  const selectedEmployeeOption = useMemo(() => {
    if (reassignEmployee == null) return null;
    const exact = employeeOptions.find((opt) => opt.value === reassignEmployee);
    if (exact) return exact;
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

  const handleAction = async (task, action) => {
    if (action === "note-add") {
      openAddNoteModal(task);
      return;
    }
    if (action === "note-view") {
      await openViewNotesModal(task);
      return;
    }
    setSelectedTask(task);
    setModalType(action);
    setShowModal(true);
    setPendingReason("");
    setReassignEmployee(null);
    setReassignReason("");
    setInProgressPercent(action === "in-progress" ? String(task?.progress ?? "") : "");
    setRating(0);
    setFeedback("");
  };

  const handleSubmitNote = async () => {
    if (!selectedTask) return;
    if (!noteText.trim()) {
      setNoteError("Please enter a note before saving.");
      return;
    }
    setNoteSaving(true);
    setNoteError("");
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
      setNoteText("");
      setNotesList([]);
      setShowModal(false);
      setSelectedTask(null);
      setModalType("");
      pushNoteStatus("Note saved successfully.");
    } catch (err) {
      console.error("Failed to save note:", err);
      const message = err.response?.data?.error || err.message || "Unable to save note.";
      setNoteError(message);
    } finally {
      setNoteSaving(false);
    }
  };

  const confirmAction = async () => {
    if (!selectedTask) return;

    let additionalData = {};

    switch (modalType) {
      case "done":
  additionalData = {
    completedAt: new Date().toISOString(),
  };

  await axios.post(
    `${API_BASE}/tasks/${selectedTask.id}/employee-feedback`,
    {
      rating,
      feedback,
    },
    {
      headers: getAuthHeaders(),
    }
  );

  await updateTaskStatus(
    selectedTask.id,
    "done",
    additionalData
  );

  break;
      case "in-progress":
        if (inProgressPercent === "") {
          alert("Please enter task progress percentage");
          return;
        }
        if (Number(inProgressPercent) < 0 || Number(inProgressPercent) > 100) {
          alert("Progress must be between 0 and 100");
          return;
        }
        additionalData = { startedAt: new Date().toISOString() };
        additionalData.progress = Number(inProgressPercent);
        await updateTaskStatus(selectedTask.id, "inprogress", additionalData);
        break;
      case "pending":
        additionalData = {
          pendingReason: pendingReason,
          pendingAt: new Date().toISOString(),
        };
        await updateTaskStatus(selectedTask.id, "pending", additionalData);
        break;
      case "reassign": {
        if (reassignEmployee == null) {
          alert("Please select an employee to reassign the task.");
          return;
        }
        const selectedEmployee = employeeOptions.find(
          (option) => option.value === reassignEmployee
        );
        if (!selectedEmployee) {
          alert("Selected employee is not valid. Please choose from the list.");
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
          assignedTo: selectedEmployee.label,
          reassignedAt: new Date().toISOString(),
          reassignedBy: reassignedByName,
        };
        await updateTaskStatus(selectedTask.id, "reassigned", additionalData);
        await refreshTasks();
        break;
      }
      default:
        break;
    }

    setShowModal(false);
    setSelectedTask(null);
    setModalType("");
    setInProgressPercent("");
    setPendingReason("");
    setReassignEmployee(null);
    setReassignReason("");
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTask(null);
    setModalType("");
    setInProgressPercent("");
    setPendingReason("");
    setReassignEmployee(null);
    setReassignReason("");
    setNoteText("");
    setNotesList([]);
    setNoteError("");
    setNoteSaving(false);
    setNoteLoading(false);
  };

  const modalTitles = {
    done: "Mark Task as Done",
    "in-progress": "Update Progress",
    pending: "Put Task on Hold",
    reassign: "Reassign Task",
    "note-add": "Add Note",
    "note-view": "Task Notes",
  };

  const confirmButtonLabels = {
    done: "Complete",
    "in-progress": "Save Progress",
    pending: "Set Pending",
    reassign: "Reassign",
  };

  const renderModalFields = () => {
    switch (modalType) {
      case "done":
  return (
    <>
      <div className="done-modal-header">
        <div className="done-modal-badge">
          <i className="fas fa-star"></i>
        </div>

        <div>
          <h3 className="modal-title">Rating</h3>
          <p className="done-modal-subtitle">
            Share how this task went.
          </p>
        </div>
      </div>

      <div className="rating-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`rating-star ${rating >= star ? "active" : ""}`}
            onClick={() => setRating(star)}
          >
            <i className="fas fa-star"></i>
          </button>
        ))}
      </div>

      <div className="modal-input modal-input--feedback">
        <label>Feedback</label>

        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Type your feedback..."
          rows={4}
        />
      </div>
    </>
  );
      case "in-progress":
        return (
          <label>
            Progress (%)
            <input
              type="number"
              min="0"
              max="100"
              placeholder="Enter progress"
              value={inProgressPercent}
              onChange={(event) => setInProgressPercent(event.target.value)}
            />
          </label>
        );
      case "pending":
        return (
          <label>
            Reason for pending
            <textarea
              placeholder="Describe why this task is paused"
              value={pendingReason}
              onChange={(event) => setPendingReason(event.target.value)}
            />
          </label>
        );
      case "reassign":
        return (
          <>
            <label>
              Reassign to
              <Select
                value={selectedEmployeeOption}
                options={employeeOptions}
                onChange={(option) => setReassignEmployee(option?.value ?? null)}
                placeholder="Select employee"
                menuPortalTarget={menuPortalTarget}
                menuPlacement="top"
                styles={{
                  menuPortal: (base) => ({ ...base, zIndex: 99999 }),
                  menu: (base) => ({ ...base, zIndex: 99999 }),
                }}
                isClearable
              />
            </label>
            <label>
              Reassignment reason (optional)
              <textarea
                placeholder="Add a quick note for the other employee"
                value={reassignReason}
                onChange={(event) => setReassignReason(event.target.value)}
              />
            </label>
          </>
        );
      case "note-add":
        return null;
      default:
        return null;
    }
  };

  const confirmButtonText = confirmButtonLabels[modalType] ?? "Confirm";

  return (
    <>
      <RefreshWrapper onRefresh={handleRefresh}>
        <div className="tasks-container">
          <header className="tasks-header">
            <div>
              <p className="eyebrow">Today’s Work</p>
              <h1>Active Tasks</h1>
              <p className="subhead">
                You have {todoTasks.length} task{todoTasks.length !== 1 ? "s" : ""} waiting.
              </p>
            </div>
            <button className="refresh-btn" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </header>

          {noteStatus && <p className="note-status">{noteStatus}</p>}
          <section className="tasks-list">
            {todoTasks.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-bell-slash"></i>
                <h3>No active tasks</h3>
                <p>Pull down to refresh or wait for new assignments.</p>
              </div>
            ) : (
              todoTasks.map((task) => (
                <TaskCard
                  key={task.id ?? task.task_id ?? task.taskId}
                  task={task}
                  onAction={handleAction}
                  showAddNote
                  showViewNotes
                />
              ))
            )}
          </section>
        </div>
      </RefreshWrapper>

      {showModal &&
        selectedTask &&
        modalRoot &&
        createPortal(
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2>{modalTitles[modalType] ?? "Update Task"}</h2>
                <button type="button" onClick={closeModal} aria-label="Close modal">
                  &times;
                </button>
              </div>
              <p className="modal-task-name">{selectedTask.title}</p>
              {modalType === "note-add" ? (
                <>
                  <div className="modal-input">
                    <label>Note</label>
                    <textarea
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Describe blockers, context, or updates."
                      rows={4}
                    />
                  </div>
                  {noteError && <p className="modal-error">{noteError}</p>}
                  <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={closeModal}>
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSubmitNote}
                      disabled={noteSaving}
                    >
                      {noteSaving ? "Saving..." : "Save Note"}
                    </button>
                  </div>
                </>
              ) : modalType === "note-view" ? (
                <>
                  {noteError && <p className="modal-error">{noteError}</p>}
                  {noteLoading ? (
                    <p className="modal-message">Loading notes...</p>
                  ) : (
                    <div className="modal-note-list">
                      {notesList.length === 0 ? (
                        <p className="note-empty">No notes yet for this task.</p>
                      ) : (
                        notesList.map((note, index) => (
                          <div
                            className="modal-note-item"
                            key={note.id ?? `${selectedTask?.id}-${index}`}
                          >
                            <div className="note-meta">
                              <strong>
                                {note.employee_name || note.employeeName || "Unknown"}
                              </strong>
                              <span>
                                {formatNoteTime(
                                  note.created_at ??
                                    note.createdAt ??
                                    note.updated_at ??
                                    note.updatedAt ??
                                    note.createdAt
                                )}
                              </span>
                            </div>
                            <p>{note.note || note.text || "-"}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={closeModal}>
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="modal-fields">{renderModalFields()}</div>
                  <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={closeModal}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={confirmAction}>
                      {confirmButtonText}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          modalRoot
        )}

      <WorkspaceBottomNav />

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f8fafc;
        }

        body.modal-open {
          overflow: hidden;
        }

        .tasks-container {
          min-height: 100vh;
          padding-bottom: calc(100px + env(safe-area-inset-bottom));
          background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%);
        }

        .tasks-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0 16px 10px;
          padding-top: calc(env(safe-area-inset-top, 0px) + 10px);
          gap: 16px;
        }

        .tasks-header h1 {
          margin: 4px 0;
          font-size: 28px;
          color: #0f172a;
        }

        .tasks-header .eyebrow {
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6366f1;
          margin: 0;
        }

        .tasks-header .subhead {
          margin: 0;
          color: #475569;
          font-size: 14px;
        }

        .refresh-btn {
          border: none;
          background: #eef2ff;
          padding: 10px 16px;
          border-radius: 12px;
          font-weight: 600;
          color: #4f46e5;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .refresh-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .refresh-btn:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(79, 70, 229, 0.2);
        }

        .tasks-list {
          padding: 0 16px 50px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 16px;
          border-radius: 18px;
          background: white;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.1);
        }

        .empty-state i {
          font-size: 40px;
          color: #a855f7;
          margin-bottom: 12px;
        }

        .empty-state h3 {
          margin-bottom: 8px;
          color: #0f172a;
        }

        .empty-state p {
          color: #475569;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .modal-card {
          width: 100%;
          max-width: 420px;
          max-height: 80vh;
          margin: 0;
          background: white;
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 20px;
          color: #0f172a;
        }

        .modal-header button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          line-height: 1;
        }

        .modal-task-name {
          color: #475569;
          margin: 0 0 16px;
          font-weight: 500;
        }

        .modal-fields label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .modal-fields input,
        .modal-fields textarea {
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 10px 12px;
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.2s ease;
        }

        .modal-fields input:focus,
        .modal-fields textarea:focus {
          outline: none;
          border-color: #6366f1;
        }

        .modal-fields textarea {
          min-height: 80px;
          resize: vertical;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }

        .modal-note-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 12px;
        }

        .modal-note-item {
          background: #f8fafc;
          border-radius: 12px;
          padding: 12px;
          border: 1px solid #e2e8f0;
        }

        .note-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #475569;
          margin-bottom: 6px;
          gap: 8px;
        }

        .note-meta strong {
          color: #0f172a;
        }

        .note-empty {
          color: #475569;
          font-size: 13px;
        }

        .modal-error {
          color: #dc2626;
          font-size: 12px;
          margin: 8px 0;
        }

        .note-status {
          margin: 0 16px 12px;
          font-size: 12px;
          color: #047857;
          background: #d1fae5;
          border-radius: 10px;
          padding: 8px 12px;
        }

        .btn {
          cursor: pointer;
          padding: 10px 16px;
          border-radius: 10px;
          border: none;
          font-weight: 600;
          transition: transform 0.2s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
        }

        .btn-secondary {
          background: #eef2ff;
          color: #4f46e5;
        }

        .btn:not(:disabled):hover {
          transform: translateY(-2px);
        }

        @media (max-width: 600px) {
          .tasks-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .modal-actions {
            flex-direction: column;
          }

          .modal-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
