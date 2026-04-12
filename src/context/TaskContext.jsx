import React, { useState, useEffect, useRef } from 'react';
import { useNotificationContext } from './NotificationContext';
import axios from 'axios';
import { API_BASE, getAuthHeaders } from '../utils/apiConfig';
import { TaskContext } from './taskContextStore';

const USE_FILTER_ENDPOINTS = import.meta.env.VITE_USE_TASK_FILTER_ENDPOINTS === 'true';
const USE_UPDATE_STATUS_ENDPOINT = false;
const PENDING_TASKS_KEY = 'pendingTasks';

export const TaskProvider = ({ children }) => {
  const [taskState, setTaskState] = useState({ tasks: [], todayTasks: [] });
  const { tasks, todayTasks } = taskState;
  const tasksRef = useRef(tasks);
  const { notifyTaskReassigned, notifyTaskCompleted } = useNotificationContext();

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

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
    const assignedTo = task.assigned_employee_names ?? task.assigned_employee_ids ?? task.assignedTo ?? task.assigned_to ?? task.employee_name ?? task.employeeName ?? task.employee_id ?? task.employeeId ?? null;
    const taskId = task.id ?? task.task_id ?? task.taskId;
    const reassignedTo = task.reassignedTo ?? task.reassigned_to ?? null;
    const pendingReason = task.pendingReason ?? task.pending_reason ?? task.reason ?? null;
    const reassignReason = task.reassignReason ?? task.reassign_reason ?? task.reason ?? null;
    const completedAt = task.completedAt ?? task.completed_at ?? (status === 'done' ? createdAt : null);
    const startedAt = task.startedAt ?? task.started_at ?? (status === 'in_progress' ? createdAt : null);
    const pendingAt = task.pendingAt ?? task.pending_at ?? (status === 'pending' ? createdAt : null);

    return {
      ...task,
      id: taskId,
      status,
      created_at: createdAt,
      assignedTo,
      assigned_to: task.assigned_to ?? task.assignedTo ?? null,
      reassignedTo,
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

    const localReassigned = JSON.parse(localStorage.getItem('reassignedTasks') || '[]');

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
      const mergedTasks = [...normalizedEmployeeTasks, ...localReassigned, ...localPending];
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
          const mergedTasks = [...normalizedEmployeeTasks, ...localReassigned, ...localPending];
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

    if (normalizedStatus === 'reassigned') {
      try {
        const storedReassigned = JSON.parse(localStorage.getItem('reassignedTasks') || '[]');
        const filtered = storedReassigned.filter(t => t.id !== taskId);
        const updated = [...filtered, updatedTask];
        localStorage.setItem('reassignedTasks', JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save reassigned task to localStorage', error);
      }
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
