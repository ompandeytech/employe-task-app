import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import {
  PROGRESS_OPTIONS,
  STATUS_OPTIONS,
  formatDate,
  getAssignedDate,
  getDueDate,
  getEmployeeId,
  getEmployeeName,
  getProgress,
  getRows,
  getStatusLabel,
  getStoredUser,
  getTaskEmployeeName,
  getUserId,
  getUserName,
  isAssignedByCurrentUser,
  normalizeStatus,
} from "./taskAssignUtils";
import "./TaskAssign.css";

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);
  return <span className={`task-status-badge ${normalized.replace("_", "-")}`}>{getStatusLabel(normalized)}</span>;
}

function ProgressBar({ value }) {
  const progress = getProgress({ progress: value });
  return (
    <div className="task-progress-cell">
      <span className="task-progress-label">{progress}%</span>
      <div className="task-progress-track" aria-hidden="true">
        <div className="task-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function TaskAssign() {
  const navigate = useNavigate();
  const currentUser = useMemo(getStoredUser, []);
  const currentUserId = getUserId(currentUser);
  const currentUserName = getUserName(currentUser);
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [form, setForm] = useState({
    employeeId: "",
    title: "",
    description: "",
    priority: "Medium",
    dueDate: "",
    status: "pending",
    progress: 0,
  });

  const employeesById = useMemo(() => {
    const lookup = new Map();
    employees.forEach((employee) => {
      const id = getEmployeeId(employee);
      if (id != null) lookup.set(String(id), getEmployeeName(employee));
    });
    return lookup;
  }, [employees]);

  const assignedByMeTasks = useMemo(
    () => tasks.filter((task) => isAssignedByCurrentUser(task, currentUser)),
    [tasks, currentUser]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, tasksRes] = await Promise.all([client.get("/users"), client.get("/tasks")]);
      setEmployees(getRows(usersRes.data));
      setTasks(getRows(tasksRes.data));
      setMessage({ type: "", text: "" });
    } catch (error) {
      console.error("Failed to load task assignment data", error);
      setMessage({ type: "error", text: "Unable to load employees or tasks. Please refresh again." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateForm = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "status" && value === "completed") next.progress = 100;
      if (field === "status" && value === "pending") next.progress = 0;
      return next;
    });
  };

  const resetForm = () => {
    setForm({
      employeeId: "",
      title: "",
      description: "",
      priority: "Medium",
      dueDate: "",
      status: "pending",
      progress: 0,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const employee = employees.find((item) => String(getEmployeeId(item)) === String(form.employeeId));
    if (!employee) {
      setMessage({ type: "error", text: "Please select an employee." });
      return;
    }
    if (!form.title.trim()) {
      setMessage({ type: "error", text: "Please enter a task title." });
      return;
    }

    const employeeId = getEmployeeId(employee);
    const employeeName = getEmployeeName(employee);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      due_date: form.dueDate || null,
      status: form.status,
      progress: Number(form.progress),
      assigned_to: employeeId,
      employee_id: employeeId,
      employee_name: employeeName,
      assigned_employee_ids: [employeeId],
      assigned_employee_names: [employeeName],
      assigned_by: currentUserId,
      assigned_by_id: currentUserId,
      assigned_by_name: currentUserName,
      created_by: currentUserName,
      assigned_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await client.post("/tasks", payload);
      setMessage({ type: "success", text: "Task assigned successfully." });
      resetForm();
      await loadData();
      window.dispatchEvent(new Event("tasks:refresh"));
    } catch (error) {
      console.error("Failed to assign task", error);
      setMessage({
        type: "error",
        text: error.response?.data?.message || error.response?.data?.error || "Unable to assign task.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="task-assign-page">
      <header className="task-assign-header">
        <button className="task-assign-icon-btn" type="button" onClick={() => navigate("/")}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <div>
          <h1>Task Assign</h1>
          <p>Assign employee tasks and track TL-owned work.</p>
        </div>
        <button className="task-assign-link-btn" type="button" onClick={() => navigate("/task-history")}>
          <i className="fas fa-clock-rotate-left"></i>
          <span>History</span>
        </button>
      </header>

      <main className="task-assign-content">
        <div className="task-assign-grid">
          <section className="task-assign-panel">
            <div className="task-assign-panel-head">
              <h2>Assign Task</h2>
              <p>Logged in as {currentUserName}</p>
            </div>
            <form className="task-assign-form" onSubmit={handleSubmit}>
              <div className="task-assign-field">
                <label htmlFor="task-employee">Employee</label>
                <select
                  id="task-employee"
                  value={form.employeeId}
                  onChange={(event) => updateForm("employeeId", event.target.value)}
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => {
                    const id = getEmployeeId(employee);
                    if (id == null) return null;
                    return (
                      <option key={id} value={id}>
                        {getEmployeeName(employee)}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="task-assign-field">
                <label htmlFor="task-title">Task Title</label>
                <input
                  id="task-title"
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Enter task title"
                />
              </div>

              <div className="task-assign-field">
                <label htmlFor="task-description">Task Description</label>
                <textarea
                  id="task-description"
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Add task details"
                />
              </div>

              <div className="task-assign-form-row">
                <div className="task-assign-field">
                  <label htmlFor="task-priority">Priority</label>
                  <select
                    id="task-priority"
                    value={form.priority}
                    onChange={(event) => updateForm("priority", event.target.value)}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>

                <div className="task-assign-field">
                  <label htmlFor="task-due-date">Due Date</label>
                  <input
                    id="task-due-date"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => updateForm("dueDate", event.target.value)}
                  />
                </div>
              </div>

              <div className="task-assign-form-row">
                <div className="task-assign-field">
                  <label htmlFor="task-status">Status</label>
                  <select
                    id="task-status"
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="task-assign-field">
                  <label htmlFor="task-progress">Progress</label>
                  <select
                    id="task-progress"
                    value={form.progress}
                    onChange={(event) => updateForm("progress", Number(event.target.value))}
                  >
                    {PROGRESS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {message.text && <p className={`task-assign-status ${message.type}`}>{message.text}</p>}

              <button className="task-assign-primary-btn" type="submit" disabled={saving}>
                {saving ? "Assigning..." : "Assign Task"}
              </button>
            </form>
          </section>

          <section className="task-assign-panel">
            <div className="task-assign-toolbar">
              <div>
                <div className="task-assign-count">{assignedByMeTasks.length} assigned by you</div>
              </div>
              <button className="task-assign-secondary-btn" type="button" onClick={loadData} disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {assignedByMeTasks.length === 0 ? (
              <div className="task-assign-empty">
                <i className="fas fa-clipboard-list"></i>
                <strong>No assigned tasks found</strong>
                <span>Tasks assigned by this TL will appear here.</span>
              </div>
            ) : (
              <div className="task-assign-table-wrap">
                <table className="task-assign-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Task</th>
                      <th>Priority</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedByMeTasks.map((task) => (
                      <tr key={task.id ?? task.task_id ?? `${task.title}-${getAssignedDate(task)}`}>
                        <td>{getTaskEmployeeName(task, employeesById)}</td>
                        <td className="task-assign-title-cell">
                          <strong>{task.title || "-"}</strong>
                          <span>{task.description || "No description"}</span>
                        </td>
                        <td>{task.priority || "-"}</td>
                        <td>{formatDate(getDueDate(task))}</td>
                        <td>
                          <StatusBadge status={task.status} />
                        </td>
                        <td>
                          <ProgressBar value={getProgress(task)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
