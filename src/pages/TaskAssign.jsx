import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
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
  if (status === "mixed") {
    return <span className="task-status-badge mixed">Mixed</span>;
  }
  const normalized = normalizeStatus(status);
  return <span className={`task-status-badge ${normalized.replace("_", "-")}`}>{getStatusLabel(normalized)}</span>;
}

function ProgressBar({ value, label }) {
  const progress = getProgress({ progress: value });
  return (
    <div className="task-progress-cell">
      <span className="task-progress-label">{label || `${progress}%`}</span>
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
    employeeIds: [],
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

  const groupedAssignedByMeTasks = useMemo(() => {
    const groups = new Map();
    assignedByMeTasks.forEach((task) => {
      const assignedDate = getAssignedDate(task) || "";
      const groupId =
        task.assignment_group_id ||
        task.assignmentGroupId ||
        [
          task.assigned_by ?? task.assignedBy ?? task.assigned_by_id ?? task.assignedById ?? currentUserId ?? "",
          assignedDate,
          task.title || "",
          task.description || "",
          task.priority || "",
          getDueDate(task) || "",
        ].join("|");

      if (!groups.has(groupId)) {
        groups.set(groupId, {
          ...task,
          groupId,
          records: [],
          assignedEmployeeNames: [],
          statusValues: [],
          progressValues: [],
        });
      }

      const group = groups.get(groupId);
      const employeeName = getTaskEmployeeName(task, employeesById);
      if (employeeName && employeeName !== "-" && !group.assignedEmployeeNames.includes(employeeName)) {
        group.assignedEmployeeNames.push(employeeName);
      }
      group.records.push(task);
      group.statusValues.push(normalizeStatus(task.status));
      group.progressValues.push(getProgress(task));
    });

    return Array.from(groups.values()).map((group) => {
      const uniqueStatuses = [...new Set(group.statusValues)];
      const uniqueProgress = [...new Set(group.progressValues)];
      const averageProgress = Math.round(
        group.progressValues.reduce((total, value) => total + value, 0) / Math.max(group.progressValues.length, 1)
      );

      return {
        ...group,
        assignedEmployeeText: group.assignedEmployeeNames.join(", ") || "-",
        displayStatus: uniqueStatuses.length === 1 ? uniqueStatuses[0] : "mixed",
        displayProgress: uniqueProgress.length === 1 ? uniqueProgress[0] : averageProgress,
        progressLabel: uniqueProgress.length === 1 ? `${uniqueProgress[0]}%` : `Mixed (${averageProgress}%)`,
      };
    });
  }, [assignedByMeTasks, currentUserId, employeesById]);

  const employeeOptions = useMemo(() => {
    const seen = new Set();
    return employees
      .map((employee) => {
        const id = getEmployeeId(employee);
        if (id == null) return null;
        const key = String(id);
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          value: id,
          label: getEmployeeName(employee),
          employee,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [employees]);

  const selectedEmployeeOptions = useMemo(
    () => employeeOptions.filter((option) => form.employeeIds.some((id) => String(id) === String(option.value))),
    [employeeOptions, form.employeeIds]
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
      employeeIds: [],
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
    const selectedEmployeesMap = new Map();
    selectedEmployeeOptions.forEach((option) => {
      selectedEmployeesMap.set(String(option.value), option.employee);
    });
    const selectedEmployees = Array.from(selectedEmployeesMap.values());
    if (selectedEmployees.length === 0) {
      setMessage({ type: "error", text: "Please select at least one employee." });
      return;
    }
    if (!form.title.trim()) {
      setMessage({ type: "error", text: "Please enter a task title." });
      return;
    }

    const assignedAt = new Date().toISOString();
    const createPayload = (employee) => {
      const employeeId = getEmployeeId(employee);
      const employeeName = getEmployeeName(employee);
      return {
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
        assigned_at: assignedAt,
      };
    };

    setSaving(true);
    try {
      await Promise.all(selectedEmployees.map((employee) => client.post("/tasks", createPayload(employee))));
      setMessage({
        type: "success",
        text:
          selectedEmployees.length === 1
            ? "Task assigned successfully."
            : `Task assigned successfully to ${selectedEmployees.length} employees.`,
      });
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
                <Select
                  inputId="task-employee"
                  classNamePrefix="task-assign-select"
                  value={selectedEmployeeOptions}
                  options={employeeOptions}
                  onChange={(options) => updateForm("employeeIds", (options || []).map((option) => option.value))}
                  placeholder="Select employees"
                  isMulti
                  closeMenuOnSelect={false}
                />
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
                <div className="task-assign-count">{groupedAssignedByMeTasks.length} assigned by you</div>
              </div>
              <button className="task-assign-secondary-btn" type="button" onClick={loadData} disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {groupedAssignedByMeTasks.length === 0 ? (
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
                    {groupedAssignedByMeTasks.map((task) => (
                      <tr key={task.groupId ?? task.id ?? task.task_id ?? `${task.title}-${getAssignedDate(task)}`}>
                        <td data-label="Assigned Employees">{task.assignedEmployeeText}</td>
                        <td className="task-assign-title-cell" data-label="Task">
                          <strong>{task.title || "-"}</strong>
                          <span>{task.description || "No description"}</span>
                        </td>
                        <td data-label="Priority">{task.priority || "-"}</td>
                        <td data-label="Due Date">{formatDate(getDueDate(task))}</td>
                        <td data-label="Status">
                          <StatusBadge status={task.displayStatus} />
                        </td>
                        <td data-label="Progress">
                          <ProgressBar value={task.displayProgress} label={task.progressLabel} />
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
