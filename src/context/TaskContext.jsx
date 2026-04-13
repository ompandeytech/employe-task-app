import React, { useState, useEffect, useRef } from 'react';
import { useNotificationContext } from './NotificationContext';
import axios from 'axios';
import { API_BASE, getAuthHeaders } from '../utils/apiConfig';
import { TaskContext } from './taskContextStore';

const NAME_FIELD_CANDIDATES = [
  'name',
  'employee_name',
  'employeeName',
  'full_name',
  'fullName',
  'display_name',
  'displayName',
  'username',
  'userName',
  'first_name',
  'firstName',
  'firstname',
  'given_name',
  'givenName',
  'last_name',
  'lastName',
  'lastname',
  'surname',
  'family_name',
  'familyName',
];

const ID_FIELD_CANDIDATES = [
  'id',
  'employee_id',
  'employeeId',
  'user_id',
  'userId',
];

const normalizeNameList = (value, options = {}) => {
  const { allowNumeric = true } = options;
  if (value == null) return [];
  const candidates = Array.isArray(value) ? value : String(value).split(',');
  return candidates
    .map((item) => (item == null ? '' : String(item).trim()))
    .filter((text) => {
      if (!text) return false;
      if (allowNumeric) return true;
      return !/^[\d\s,]+$/.test(text);
    });
};

const parseIdList = (value) => {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((item) => (item == null ? '' : String(item).trim())).filter(Boolean);
  }
  const text = String(value).trim();
  if (!text) return [];
  const sanitized = text.replace(/\[/g, '').replace(/\]/g, '');
  const parts = sanitized.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : [text];
};

const matchEmployeeIdFromRecord = (record) => {
  if (!record || typeof record !== 'object') return null;
  for (const field of ID_FIELD_CANDIDATES) {
    if (record[field] != null) return record[field];
  }
  if (record.employee && typeof record.employee === 'object' && record.employee.id != null) {
    return record.employee.id;
  }
  if (record.user && typeof record.user === 'object' && record.user.id != null) {
    return record.user.id;
  }
  return null;
};

const matchEmployeeNameFromRecord = (record) => {
  if (!record || typeof record !== 'object') return null;
  for (const field of NAME_FIELD_CANDIDATES) {
    const value = record[field];
    if (value) return String(value).trim();
  }
  const firstName = record.first_name ?? record.firstName ?? record.firstname ?? record.given_name ?? record.givenName;
  const lastName = record.last_name ?? record.lastName ?? record.lastname ?? record.surname ?? record.family_name ?? record.familyName;
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ').trim() || null;
  }
  return null;
};

const buildEmployeeLookupFromList = (rows) => {
  const lookup = new Map();
  if (!Array.isArray(rows)) return lookup;
  rows.forEach((row) => {
    const id = matchEmployeeIdFromRecord(row);
    const name = matchEmployeeNameFromRecord(row);
    if (id != null && name) {
      lookup.set(String(id), name);
    }
  });
  return lookup;
};

const lookupEmployeeNameById = (lookup, rawId) => {
  if (!lookup || rawId == null) return null;
  const normalizedId = String(rawId).trim();
  if (!normalizedId) return null;
  if (lookup.has(normalizedId)) return lookup.get(normalizedId);
  const numericId = Number(normalizedId);
  if (!Number.isNaN(numericId)) {
    const numericKey = String(numericId);
    if (lookup.has(numericKey)) return lookup.get(numericKey);
  }
  return null;
};

const USE_FILTER_ENDPOINTS = import.meta.env.VITE_USE_TASK_FILTER_ENDPOINTS === 'true';
const USE_UPDATE_STATUS_ENDPOINT = false;
const PENDING_TASKS_KEY = 'pendingTasks';

export const TaskProvider = ({ children }) => {
  const [taskState, setTaskState] = useState({ tasks: [], todayTasks: [] });
  const { tasks, todayTasks } = taskState;
  const tasksRef = useRef(tasks);
  const { notifyTaskReassigned, notifyTaskCompleted } = useNotificationContext();
  const employeeLookupRef = useRef(new Map());
  const employeesLoadedRef = useRef(false);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const updateEmployeeLookup = (rows) => {
    const lookup = buildEmployeeLookupFromList(rows);
    employeeLookupRef.current = lookup;
    return lookup;
  };

  const loadEmployees = async () => {
    try {
      const response = await axios.get(`${API_BASE}/users`, { headers: getAuthHeaders() });
      const rows = Array.isArray(response.data) ? response.data : [];
      updateEmployeeLookup(rows);
    } catch (err) {
      console.error('Failed to load employee directory', err);
    }
    return employeeLookupRef.current;
  };

  const ensureEmployeesLoaded = async () => {
    if (!employeesLoadedRef.current) {
      await loadEmployees();
      employeesLoadedRef.current = true;
    }
    return employeeLookupRef.current;
  };

  const getLoggedInUser = () => JSON.parse(localStorage.getItem('user') || '{}');

  const getLoggedInUserId = () => {
    const user = getLoggedInUser();
    return user?.id ?? user?.user_id ?? user?.userId ?? user?.employee_id ?? user?.employeeId ?? null;
  };

  const normalizeStatus = (status) => {
    if (!status) return 'pending';
    const value = String(status).trim().toLowerCase();
    if (value === 'inprogress' || value === 'in progress') return 'in_progress';
    if (value === 'completed') return 'done';
    if (value === 'todo' || value === 'to do') return 'pending';
    return value;
  };

  const normalizeTask = (task) => {
    const createdAt = task.created_at || task.createdAt || task.updated_at || task.updatedAt || new Date().toISOString();
    const status = normalizeStatus(task.status);

    const resolveAssignedNames = () => {
      const explicitNames = normalizeNameList(task.assigned_employee_names);
      if (explicitNames.length) return explicitNames;

      const assignedIds = parseIdList(task.assigned_employee_ids);
      if (assignedIds.length) {
        const lookup = employeeLookupRef.current;
        const idNames = assignedIds
          .map((id) => lookupEmployeeNameById(lookup, id))
          .filter(Boolean);
        if (idNames.length) return idNames;
      }

      const fallbackFields = [
        task.assignedTo,
        task.assigned_to,
        task.employee_name ?? task.employeeName ?? task.name ?? task.fullName ?? task.full_name,
      ];

      for (const fieldValue of fallbackFields) {
        const names = normalizeNameList(fieldValue, { allowNumeric: false });
        if (names.length) return names;
      }

      return [];
    };

    const resolvedNames = resolveAssignedNames();
    const assignedTo = resolvedNames.length > 0 ? resolvedNames : 'Unassigned';
    const taskId = task.id ?? task.task_id ?? task.taskId;
    const reassignedTo = task.reassignedTo ?? task.reassigned_to ?? null;
    const pendingReason = task.pendingReason ?? task.pending_reason ?? task.reason ?? null;
    const reassignReason = task.reassignReason ?? task.reassign_reason ?? task.reason ?? null;
    const completedAt = task.completedAt ?? task.completed_at ?? (status === 'done' ? createdAt : null);
    const startedAt = task.startedAt ?? task.started_at ?? (status === 'in_progress' ? createdAt : null);
    const pendingAt = task.pendingAt ?? task.pending_at ?? (status === 'pending' ? createdAt : null);
    const reassignedBy = task.reassignedBy ?? task.reassigned_by ?? null;
    const reassignedToNameField = task.reassignedToName ?? task.reassigned_to_name ?? null;

    return {
      ...task,
      id: taskId,
      status,
      created_at: createdAt,
      assignedTo,
      assigned_to: task.assigned_to ?? task.assignedTo ?? null,
      reassignedTo,
      reassignedBy,
      reassignedToName: reassignedToNameField,
      createdAt,
      pendingReason,
      reassignReason,
      pendingAt,
      startedAt,
      completedAt,
      progress: task.progress ?? null,
    };
  };

  const getListFromResponse = (response) => {
    const payload = response?.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.tasks)) return payload.tasks;
    return [];
  };

  const getLocalPendingTasks = () => {
    try {
      return JSON.parse(localStorage.getItem(PENDING_TASKS_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const saveLocalPendingTasks = (tasks) => {
    try {
      localStorage.setItem(PENDING_TASKS_KEY, JSON.stringify(tasks || []));
    } catch (error) {
      console.error('Failed to save pending tasks to localStorage', error);
    }
  };

  const removeLocalPendingTask = (taskId) => {
    try {
      const stored = getLocalPendingTasks();
      const filtered = stored.filter((task) => task.id !== taskId);
      localStorage.setItem(PENDING_TASKS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove pending task from localStorage', error);
    }
  };

  const isNotFound = (error) => error?.response?.status === 404;

  const mapTaskUserId = (task) => (
    task.assigned_to ??
    task.employee_id ??
    task.assignedTo ??
    task.employeeId ??
    task?.employee?.id ??
    task?.user?.id ??
    null
  );

  const isTodayDate = (value) => {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  };

  const fetchTasksFromAllEndpoint = async (userId) => {
    const allRes = await axios.get(`${API_BASE}/tasks`, { headers: getAuthHeaders() });
    const allTasks = getListFromResponse(allRes);
    const userIdStr = String(userId);
    return allTasks.filter((task) =>
      task.assigned_employee_ids?.includes(userId) ||
      String(mapTaskUserId(task)) === userIdStr
    );
  };

  const fetchEmployeeTasks = async (userId) => {
    if (!USE_FILTER_ENDPOINTS) {
      return fetchTasksFromAllEndpoint(userId);
    }

    const employeeRes = await axios.get(`${API_BASE}/tasks/employee/${userId}`, { headers: getAuthHeaders() });
    return getListFromResponse(employeeRes);
  };

  const fetchTodayTasks = async (userId, fallbackEmployeeTasks) => {
    if (!USE_FILTER_ENDPOINTS) {
      return fallbackEmployeeTasks.filter((task) =>
        isTodayDate(task.created_at || task.createdAt)
      );
    }

    const todayRes = await axios.get(`${API_BASE}/tasks/today/${userId}`, { headers: getAuthHeaders() });
    return getListFromResponse(todayRes);
  };

  const loadTasks = async () => {
    const userId = getLoggedInUserId();

    if (!userId) {
      setTimeout(() => {
        setTaskState({ tasks: [], todayTasks: [] });
      }, 0);
      return;
    }

    await ensureEmployeesLoaded();

    const previousPendingTasksMap = new Map(
      tasksRef.current
        .filter((task) => task.status === 'pending' && !task.reassignedTo)
        .map((task) => [task.id, task])
    );

    const localPending = getLocalPendingTasks();
    const localPendingTasksMap = new Map(
      localPending
        .filter((task) => task.status === 'pending')
        .map((task) => [task.id, task])
    );

    const normalizeEmployeeRows = (rows) => rows.map((row) => {
      const normalized = normalizeTask(row);
      if (normalized.status === 'pending') {
        const prev = previousPendingTasksMap.get(normalized.id) ?? localPendingTasksMap.get(normalized.id);
        if (prev) {
          normalized.pendingReason = normalized.pendingReason ?? prev.pendingReason;
          normalized.pendingAt = normalized.pendingAt ?? prev.pendingAt;
        }
      }
      return normalized;
    });

    const mergeUniqueTasks = (tasksToMerge) => {
      const uniqueTasksMap = new Map(tasksToMerge.map((t) => [t.id, t]));

      previousPendingTasksMap.forEach((prevTask, id) => {
        if (!uniqueTasksMap.has(id)) {
          uniqueTasksMap.set(id, prevTask);
        } else {
          const existing = uniqueTasksMap.get(id);
          if (existing.status === 'pending') {
            existing.pendingReason = existing.pendingReason ?? prevTask.pendingReason;
            existing.pendingAt = existing.pendingAt ?? prevTask.pendingAt;
          }
        }
      });

      localPending.forEach((prevTask) => {
        const existing = uniqueTasksMap.get(prevTask.id);
        if (!existing) {
          uniqueTasksMap.set(prevTask.id, prevTask);
        } else if (existing.status === 'pending') {
          existing.pendingReason = existing.pendingReason ?? prevTask.pendingReason;
          existing.pendingAt = existing.pendingAt ?? prevTask.pendingAt;
        }
      });

      return Array.from(uniqueTasksMap.values());
    };

    try {
      const employeeRows = await fetchEmployeeTasks(userId);
      const todayRows = await fetchTodayTasks(userId, employeeRows);

      const normalizedEmployeeTasks = normalizeEmployeeRows(employeeRows);
      const mergedTasks = [...normalizedEmployeeTasks, ...localPending];
      const uniqueTasks = mergeUniqueTasks(mergedTasks);
      const normalizedTodayTasks = todayRows.map(normalizeTask);

      setTaskState({
        tasks: uniqueTasks,
        todayTasks: normalizedTodayTasks,
      });
      console.log('Loaded tasks state:', uniqueTasks);
    } catch (err) {
      if (USE_FILTER_ENDPOINTS && isNotFound(err)) {
        try {
          const employeeRows = await fetchTasksFromAllEndpoint(userId);
          const todayRows = employeeRows.filter((task) =>
            isTodayDate(task.created_at || task.createdAt)
          );

          const normalizedEmployeeTasks = normalizeEmployeeRows(employeeRows);
          const mergedTasks = [...normalizedEmployeeTasks, ...localPending];
          const uniqueTasks = mergeUniqueTasks(mergedTasks);
          const normalizedTodayTasks = todayRows.map(normalizeTask);

          setTaskState({
            tasks: uniqueTasks,
            todayTasks: normalizedTodayTasks,
          });
          console.log('Loaded tasks state (fallback):', uniqueTasks);
          return;
        } catch (fallbackErr) {
          console.error('Failed to load employee tasks', fallbackErr);
        }
      }
      console.error('Failed to load employee tasks', err);
      setTaskState({ tasks: [], todayTasks: [] });
    }
  };

  useEffect(() => {
    // Initialize tasks on mount
    (async () => {
      await loadTasks();
    })();

    const handleRefresh = () => {
      loadTasks();
    };
    const pollInterval = window.setInterval(loadTasks, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadTasks();
      }
    };

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('tasks:refresh', handleRefresh);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('tasks:refresh', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateTaskStatus = async (taskId, newStatus, additionalData = {}) => {
    // Get the current task from state first
    const currentTask = tasks.find((item) => item.id === taskId);
    if (!currentTask) return;

    const normalizedStatus = normalizeStatus(newStatus);
    const reason = additionalData.pendingReason || additionalData.reassignReason || additionalData.reason || null;
    const parsedProgress = additionalData.progress == null ? null : Number(additionalData.progress);
    const progress = Number.isFinite(parsedProgress) ? parsedProgress : null;
    let parsedReassignedTo = null;
    if (!(additionalData.reassignedTo == null || additionalData.reassignedTo === '')) {
      const rawReassignedTo = String(additionalData.reassignedTo).trim();
      const numericMatch = rawReassignedTo.match(/\d+/);
      parsedReassignedTo = Number(numericMatch ? numericMatch[0] : rawReassignedTo);
    }
    const reassignedTo = Number.isFinite(parsedReassignedTo) ? parsedReassignedTo : null;
    const backendStatus = normalizedStatus === 'done'
      ? 'done'
      : normalizedStatus === 'in_progress'
        ? 'in_progress'
        : normalizedStatus === 'reassigned'
          ? 'reassigned'
          : 'pending';
    const legacyBackendStatus = normalizedStatus === 'done'
      ? 'Completed'
      : normalizedStatus === 'in_progress'
        ? 'In Progress'
        : normalizedStatus === 'reassigned'
          ? 'Reassigned'
          : 'To Do';

    if (USE_UPDATE_STATUS_ENDPOINT) {
      try {
        await axios.post(`${API_BASE}/tasks/update-status`, {
          taskId,
          status: backendStatus,
          reason,
          progress,
          reassignedTo,
        }, { headers: getAuthHeaders() });
      } catch (err) {
        if (!isNotFound(err)) {
          console.error('Failed to update task status', err);
          return;
        }

        try {
          if (reassignedTo) {
            await axios.put(`${API_BASE}/tasks/${taskId}/reassign`, {
              new_assigned_to: reassignedTo,
              reassign_reason: reason || 'Reassigned from employee app',
            }, { headers: getAuthHeaders() });
          } else {
            await axios.put(`${API_BASE}/tasks/${taskId}`, {
              title: currentTask.title,
              description: currentTask.description,
              status: legacyBackendStatus,
              progress: progress ?? currentTask.progress ?? 0,
            }, { headers: getAuthHeaders() });
          }
        } catch (fallbackErr) {
          console.error('Failed to update task status', fallbackErr);
          return;
        }
      }
    } else {
      try {
        if (reassignedTo) {
          await axios.put(`${API_BASE}/tasks/${taskId}/reassign`, {
            new_assigned_to: reassignedTo,
            reassign_reason: reason || 'Reassigned from employee app',
          }, { headers: getAuthHeaders() });
        } else {
          await axios.put(`${API_BASE}/tasks/${taskId}`, {
            title: currentTask.title,
            description: currentTask.description,
            status: legacyBackendStatus,
            progress: progress ?? currentTask.progress ?? 0,
          }, { headers: getAuthHeaders() });
        }
      } catch (err) {
        console.error('Failed to update task status', err);
        return;
      }
    }

    // Update local state immediately for UI responsiveness
    const updatedTask = { ...currentTask, ...additionalData, status: normalizedStatus };
    const updatedTasks = tasks.map(t => t.id === taskId ? updatedTask : t);
    const updatedTodayTasks = todayTasks.map(t => t.id === taskId ? updatedTask : t);
    setTaskState(prev => ({ ...prev, tasks: updatedTasks, todayTasks: updatedTodayTasks }));
    console.log('Updated task state:', updatedTasks);

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    if (currentTask && normalizedStatus === 'done') {
      notifyTaskCompleted(updatedTask, currentUser.name || 'Employee');
    }
    if (currentTask && reassignedTo) {
      notifyTaskReassigned(updatedTask, currentUser.name || 'Admin', reassignedTo);
    }
    
    // Persist reassigned tasks to localStorage for refresh resilience
    if (normalizedStatus === 'pending') {
      try {
        const storedPending = getLocalPendingTasks();
        const filtered = storedPending.filter(t => t.id !== taskId);
        const updated = [...filtered, updatedTask];
        saveLocalPendingTasks(updated);
      } catch (error) {
        console.error('Failed to save pending task to localStorage', error);
      }
    } else {
      removeLocalPendingTask(taskId);
    }

    // Only load tasks for non-reassigned updates to prevent losing reassigned tasks
    if (normalizedStatus !== 'reassigned') {
      await loadTasks();
    }
  };

  const getTasksByStatus = (status) => {
    // Direct filtering without complex logic for reassigned
    if (status === 'reassigned') {
      return tasks.filter(task => task.status === 'reassigned');
    }
    
    // For other statuses
    if (status === 'inprogress') {
      return tasks.filter(task => task.status === 'in_progress');
    }

    if (status === 'todo') {
      return tasks.filter(task => task.status === 'pending' && !task.reassignedTo);
    }

    if (status === 'pending') {
      return tasks.filter(task => task.status === 'pending' && !task.reassignedTo);
    }

    return tasks.filter(task => task.status === status);
  };

  const getTodayTasks = () => {
    // Return all active tasks (not done, not reassigned)
    // Filter from main tasks array to include recently updated tasks
    return tasks.filter((task) => 
      task.status !== 'done' && 
      task.status !== 'reassigned'
    );
  };

  const value = {
    tasks,
    updateTaskStatus,
    getTasksByStatus,
    getTodayTasks,
    refreshTasks: loadTasks,
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};
