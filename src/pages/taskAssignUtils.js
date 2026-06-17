export const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "reassigned", label: "Reassigned" },
];

export const PROGRESS_OPTIONS = [0, 25, 50, 75, 100];

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

export const getUserId = (user) =>
  user?.id ?? user?.user_id ?? user?.userId ?? user?.employee_id ?? user?.employeeId ?? null;

export const getUserName = (user) =>
  user?.name || user?.fullName || user?.employee_name || user?.employeeName || user?.userName || "Team Leader";

export const getEmployeeId = (employee) => employee?.id ?? employee?.employee_id ?? employee?.user_id ?? null;

export const getEmployeeName = (employee) =>
  employee?.name ||
  employee?.employee_name ||
  employee?.employeeName ||
  employee?.fullName ||
  employee?.username ||
  "Employee";

export const getRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.tasks)) return payload.tasks;
  if (Array.isArray(payload?.users)) return payload.users;
  return [];
};

export const normalizeStatus = (status) => {
  const value = String(status || "pending").trim().toLowerCase();
  if (value === "inprogress" || value === "in progress") return "in_progress";
  if (value === "done" || value === "completed") return "completed";
  if (value === "reassign" || value === "reassigned") return "reassigned";
  return "pending";
};

export const getStatusLabel = (status) =>
  STATUS_OPTIONS.find((option) => option.value === normalizeStatus(status))?.label || "Pending";

export const getProgress = (task) => {
  const raw = task?.progress ?? task?.completion_percentage ?? task?.completionPercent ?? 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
};

export const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const getDueDate = (task) =>
  task?.due_date || task?.dueDate || task?.deadline || task?.deadline_at || task?.target_date || null;

export const getAssignedDate = (task) =>
  task?.assigned_at || task?.assignedAt || task?.created_at || task?.createdAt || task?.updated_at || null;

export const getTaskEmployeeName = (task, employeesById) => {
  const employeeId =
    task?.assigned_to ??
    task?.employee_id ??
    task?.employeeId ??
    task?.assignedTo ??
    (Array.isArray(task?.assigned_employee_ids) ? task.assigned_employee_ids[0] : null);

  if (employeeId != null && employeesById.has(String(employeeId))) {
    return employeesById.get(String(employeeId));
  }

  if (Array.isArray(task?.assigned_employee_names) && task.assigned_employee_names.length) {
    return task.assigned_employee_names.join(", ");
  }

  return task?.employee_name || task?.employeeName || task?.assigned_to_name || task?.assignedToName || "-";
};

export const isAssignedByCurrentUser = (task, user) => {
  const userId = getUserId(user);
  const userName = getUserName(user).trim().toLowerCase();
  const assignedByIds = [
    task?.assigned_by,
    task?.assignedBy,
    task?.assigned_by_id,
    task?.assignedById,
    task?.created_by_id,
    task?.createdById,
    task?.tl_id,
    task?.team_leader_id,
  ].filter((value) => value != null && value !== "");

  if (userId != null && assignedByIds.some((value) => String(value) === String(userId))) {
    return true;
  }

  const assignedByNames = [
    task?.assigned_by_name,
    task?.assignedByName,
    task?.created_by,
    task?.createdBy,
    task?.tl_name,
    task?.team_leader_name,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  return assignedByNames.some((value) => value === userName);
};
