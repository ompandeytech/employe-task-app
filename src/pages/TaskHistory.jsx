import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import {
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
  normalizeStatus,
} from "./taskAssignUtils";
import "./TaskAssign.css";

const yesNo = (value) => (value ? "Yes" : "No");

const isCompleted = (task) => normalizeStatus(task.status) === "completed" || getProgress(task) === 100;

const isReassigned = (task) =>
  normalizeStatus(task.status) === "reassigned" ||
  Boolean(task?.reassignedTo || task?.reassigned_to || task?.reassigned_at || task?.reassignedAt);

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const readNested = (value, keys) => {
  if (!value || typeof value !== "object") return [];
  return keys.map((key) => value[key]).filter((item) => item != null && item !== "");
};

const taskHasOwnershipData = (task) => {
  const ownershipFields = [
    task?.assigned_by,
    task?.assignedBy,
    task?.assigned_by_id,
    task?.assignedById,
    task?.assigned_by_user_id,
    task?.assignedByUserId,
    task?.assigned_by_name,
    task?.assignedByName,
    task?.created_by,
    task?.createdBy,
    task?.created_by_id,
    task?.createdById,
    task?.created_by_user_id,
    task?.createdByUserId,
    task?.creator_id,
    task?.creatorId,
    task?.creator_name,
    task?.creatorName,
    task?.tl_id,
    task?.tlId,
    task?.tl_name,
    task?.tlName,
    task?.team_leader_id,
    task?.teamLeaderId,
    task?.team_leader_name,
    task?.teamLeaderName,
  ];

  return ownershipFields.some((value) => value != null && value !== "");
};

const isTaskOwnedByCurrentTl = (task, user) => {
  const userId = getUserId(user);
  const userIdText = userId == null ? "" : String(userId);
  const userName = normalizeText(getUserName(user));

  const nestedIdKeys = ["id", "user_id", "userId", "employee_id", "employeeId"];
  const nestedNameKeys = [
    "name",
    "fullName",
    "full_name",
    "employee_name",
    "employeeName",
    "username",
    "userName",
  ];

  const idCandidates = [
    task?.assigned_by,
    task?.assignedBy,
    task?.assigned_by_id,
    task?.assignedById,
    task?.assigned_by_user_id,
    task?.assignedByUserId,
    task?.created_by_id,
    task?.createdById,
    task?.created_by_user_id,
    task?.createdByUserId,
    task?.creator_id,
    task?.creatorId,
    task?.tl_id,
    task?.tlId,
    task?.team_leader_id,
    task?.teamLeaderId,
    ...readNested(task?.assignedBy, nestedIdKeys),
    ...readNested(task?.assigned_by, nestedIdKeys),
    ...readNested(task?.createdBy, nestedIdKeys),
    ...readNested(task?.created_by, nestedIdKeys),
    ...readNested(task?.creator, nestedIdKeys),
    ...readNested(task?.team_leader, nestedIdKeys),
    ...readNested(task?.teamLeader, nestedIdKeys),
  ].filter((value) => value != null && value !== "" && typeof value !== "object");

  if (userIdText && idCandidates.some((value) => String(value) === userIdText)) {
    return true;
  }

  const nameCandidates = [
    task?.assigned_by_name,
    task?.assignedByName,
    task?.created_by,
    task?.createdBy,
    task?.creator_name,
    task?.creatorName,
    task?.tl_name,
    task?.tlName,
    task?.team_leader_name,
    task?.teamLeaderName,
    ...readNested(task?.assignedBy, nestedNameKeys),
    ...readNested(task?.assigned_by, nestedNameKeys),
    ...readNested(task?.createdBy, nestedNameKeys),
    ...readNested(task?.created_by, nestedNameKeys),
    ...readNested(task?.creator, nestedNameKeys),
    ...readNested(task?.team_leader, nestedNameKeys),
    ...readNested(task?.teamLeader, nestedNameKeys),
  ]
    .filter((value) => value != null && value !== "" && typeof value !== "object")
    .map(normalizeText);

  return Boolean(userName && nameCandidates.some((value) => value === userName));
};

const getOwnershipSnapshot = (task) => ({
  id: task?.id ?? task?.task_id ?? task?.taskId,
  assignedBy: task?.assignedBy,
  assigned_by: task?.assigned_by,
  assigned_by_id: task?.assigned_by_id,
  assigned_by_name: task?.assigned_by_name,
  createdBy: task?.createdBy,
  created_by: task?.created_by,
  created_by_id: task?.created_by_id,
  created_by_user_id: task?.created_by_user_id,
  creator_id: task?.creator_id,
  creator_name: task?.creator_name,
  tl_id: task?.tl_id,
  tl_name: task?.tl_name,
  team_leader_id: task?.team_leader_id,
  team_leader_name: task?.team_leader_name,
  employee_id: task?.employee_id,
  employee_name: task?.employee_name,
});

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

export default function TaskHistory() {
  const navigate = useNavigate();
  const currentUser = useMemo(getStoredUser, []);
  const currentUserId = getUserId(currentUser);
  const currentUserName = getUserName(currentUser);
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const employeesById = useMemo(() => {
    const lookup = new Map();
    employees.forEach((employee) => {
      const id = getEmployeeId(employee);
      if (id != null) lookup.set(String(id), getEmployeeName(employee));
    });
    return lookup;
  }, [employees]);

  const historyTasks = useMemo(() => {
    const filtered = tasks.filter((task) => isTaskOwnedByCurrentTl(task, currentUser));
    console.log("[TaskHistory] TL identifier", {
      id: currentUserId,
      name: currentUserName,
      user: currentUser,
    });
    console.log("[TaskHistory] Raw task count", tasks.length);
    console.log("[TaskHistory] Filtered task count", filtered.length);
    console.log("[TaskHistory] Ownership field samples", tasks.slice(0, 5).map(getOwnershipSnapshot));
    return filtered;
  }, [tasks, currentUser, currentUserId, currentUserName]);

  const summary = useMemo(
    () => ({
      total: historyTasks.length,
      completed: historyTasks.filter(isCompleted).length,
      reassigned: historyTasks.filter(isReassigned).length,
      inProgress: historyTasks.filter((task) => normalizeStatus(task.status) === "in_progress").length,
    }),
    [historyTasks]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, tasksRes] = await Promise.all([client.get("/users"), client.get("/tasks")]);
      setEmployees(getRows(usersRes.data));
      const taskRows = getRows(tasksRes.data);
      const hasOwnershipData = taskRows.some(taskHasOwnershipData);
      console.log("[TaskHistory] API response structure", {
        rawPayloadType: Array.isArray(tasksRes.data) ? "array" : typeof tasksRes.data,
        rawTaskCount: taskRows.length,
        hasOwnershipData,
        firstTaskOwnership: taskRows[0] ? getOwnershipSnapshot(taskRows[0]) : null,
      });
      setTasks(taskRows);
    } catch (loadError) {
      console.error("Failed to load task history", loadError);
      setError("Unable to load task history. Please refresh again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="task-assign-page">
      <header className="task-assign-header">
        <button className="task-assign-icon-btn" type="button" onClick={() => navigate("/task-assign")}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <div>
          <h1>Task History</h1>
          <p>Showing only tasks assigned by {currentUserName}.</p>
        </div>
        <button className="task-assign-link-btn" type="button" onClick={loadData} disabled={loading}>
          <i className="fas fa-rotate"></i>
          <span>{loading ? "Loading" : "Refresh"}</span>
        </button>
      </header>

      <main className="task-assign-content">
        <section className="task-history-summary" aria-label="Task history summary">
          <div className="task-history-stat">
            <span>Total</span>
            <strong>{summary.total}</strong>
          </div>
          <div className="task-history-stat">
            <span>In Progress</span>
            <strong>{summary.inProgress}</strong>
          </div>
          <div className="task-history-stat">
            <span>Completed</span>
            <strong>{summary.completed}</strong>
          </div>
          <div className="task-history-stat">
            <span>Reassigned</span>
            <strong>{summary.reassigned}</strong>
          </div>
        </section>

        <section className="task-assign-panel">
          <div className="task-assign-toolbar">
            <div>
              <div className="task-assign-count">TL-owned task history</div>
            </div>
          </div>

          {error && <p className="task-assign-status error">{error}</p>}

          {historyTasks.length === 0 ? (
            <div className="task-assign-empty">
              <i className="fas fa-clock-rotate-left"></i>
              <strong>No history found</strong>
              <span>No tasks assigned by this TL are available.</span>
            </div>
          ) : (
            <div className="task-assign-table-wrap">
              <table className="task-assign-table">
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Task Title</th>
                    <th>Assigned Date</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Completion %</th>
                    <th>Reassigned</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {historyTasks.map((task) => (
                    <tr key={task.id ?? task.task_id ?? `${task.title}-${getAssignedDate(task)}`}>
                      <td>{getTaskEmployeeName(task, employeesById)}</td>
                      <td>{task.title || "-"}</td>
                      <td>{formatDate(getAssignedDate(task))}</td>
                      <td>{formatDate(getDueDate(task))}</td>
                      <td>
                        <StatusBadge status={task.status} />
                      </td>
                      <td>
                        <ProgressBar value={getProgress(task)} />
                      </td>
                      <td>{yesNo(isReassigned(task))}</td>
                      <td>{yesNo(isCompleted(task))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
