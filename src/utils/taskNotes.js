import axios from 'axios';
import { API_BASE, getAuthHeaders } from './apiConfig';

const normalizeNotesResponse = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.notes)) return payload.notes;
  return [];
};

export const fetchTaskNotes = async (taskId) => {
  if (!taskId) return [];
  const response = await axios.get(`${API_BASE}/tasks/${taskId}/notes`, {
    headers: getAuthHeaders(),
  });
  return normalizeNotesResponse(response?.data);
};
