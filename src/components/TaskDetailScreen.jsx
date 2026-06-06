import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  CalendarDays,
  Clock3,
  FileText,
  History,
  ImageUp,
  ListChecks,
  MessageSquareText,
  Paperclip,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { API_BASE, getAuthHeaders } from "../utils/apiConfig";
import { fetchTaskNotes } from "../utils/taskNotes";
import "./TaskDetailScreen.css";

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf", "doc", "docx"];
const LOCAL_FOLLOWUPS_KEY = "taskFollowupsLocal";
const LOCAL_ATTACHMENTS_KEY = "taskAttachmentsLocal";

const formatDateTime = (value) => {
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

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const parseStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const resolveCurrentUser = () => {
  const user = parseStoredUser();
  return {
    id: user?.id ?? user?.user_id ?? user?.userId ?? user?.employee_id ?? user?.employeeId ?? null,
    name:
      user?.name ||
      user?.employee_name ||
      user?.employeeName ||
      user?.fullName ||
      user?.userName ||
      "Employee",
  };
};

const readLocalMap = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
};

const writeLocalMap = (key, map) => {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch (error) {
    console.error(`Failed to write ${key}`, error);
  }
};

const getLocalRows = (key, taskId) => {
  const map = readLocalMap(key);
  return Array.isArray(map[String(taskId)]) ? map[String(taskId)] : [];
};

const appendLocalRow = (key, taskId, row) => {
  const map = readLocalMap(key);
  const id = String(taskId);
  map[id] = [row, ...(Array.isArray(map[id]) ? map[id] : [])];
  writeLocalMap(key, map);
};

const normalizeStatusLabel = (status) => {
  const value = String(status || "assigned").replace(/_/g, " ").trim();
  return value ? value.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Assigned";
};

const getTaskDate = (task, fields) => {
  for (const field of fields) {
    if (task?.[field]) return task[field];
  }
  return null;
};

const getDueDate = (task) =>
  getTaskDate(task, ["due_date", "dueDate", "deadline", "deadline_at", "deadlineAt", "target_date", "targetDate"]);

const getExtension = (file) => {
  const name = file?.name || "";
  return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function TaskDetailScreen({ task, onClose, onAction, onRefreshTask }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [followups, setFollowups] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [flowLogs, setFlowLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [followupRemark, setFollowupRemark] = useState("");
  const [savingFollowup, setSavingFollowup] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const user = useMemo(resolveCurrentUser, []);

  const taskId = task?.id ?? task?.task_id ?? task?.taskId;

  const loadDetailData = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setMessage("");

    const localFollowups = getLocalRows(LOCAL_FOLLOWUPS_KEY, taskId);
    const localAttachments = getLocalRows(LOCAL_ATTACHMENTS_KEY, taskId);

    try {
      const [followupRes, attachmentRes, notesRows] = await Promise.allSettled([
        axios.get(`${API_BASE}/tasks/${taskId}/followups`, { headers: getAuthHeaders() }),
        axios.get(`${API_BASE}/tasks/${taskId}/attachments`, { headers: getAuthHeaders() }),
        fetchTaskNotes(taskId),
      ]);

      const nextFollowups =
        followupRes.status === "fulfilled"
          ? extractList(followupRes.value?.data)
          : [];
      const nextAttachments =
        attachmentRes.status === "fulfilled"
          ? extractList(attachmentRes.value?.data)
          : [];

      setFollowups([...localFollowups, ...nextFollowups]);
      setAttachments([...localAttachments, ...nextAttachments]);
      setNotes(notesRows.status === "fulfilled" ? notesRows.value : []);
      if (followupRes.status === "rejected" || attachmentRes.status === "rejected") {
        setMessage("Some detail history is shown from local cache until the server is available.");
      }
    } catch (error) {
      console.error("Failed to load task details", error);
      setFollowups(localFollowups);
      setAttachments(localAttachments);
      setMessage("Showing cached task details. New updates will retry when you are online.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadDetailData();
  }, [loadDetailData]);

  useEffect(() => {
    setFlowLogs(buildTimeline(task, followups, attachments, notes));
  }, [task, followups, attachments, notes]);

  const handleAddFollowup = async () => {
    if (!followupDate || !followupRemark.trim()) {
      setMessage("Select a followup date and enter a remark.");
      return;
    }

    setSavingFollowup(true);
    setMessage("");
    const payload = {
      followup_date: followupDate,
      remark: followupRemark.trim(),
      employee_id: user.id,
      created_by: user.name,
    };

    try {
      const response = await axios.post(`${API_BASE}/tasks/${taskId}/followups`, payload, {
        headers: getAuthHeaders(),
      });
      const created = normalizeFollowup(response.data || payload, user);
      setFollowups((current) => [created, ...current]);
      setFollowupDate("");
      setFollowupRemark("");
      setMessage("Followup added successfully.");
      onRefreshTask?.();
    } catch (error) {
      console.error("Failed to save followup", error);
      const localRow = normalizeFollowup({
        ...payload,
        id: `local-followup-${Date.now()}`,
        created_at: new Date().toISOString(),
        localOnly: true,
      }, user);
      appendLocalRow(LOCAL_FOLLOWUPS_KEY, taskId, localRow);
      setFollowups((current) => [localRow, ...current]);
      setFollowupDate("");
      setFollowupRemark("");
      setMessage("Followup saved locally and will remain visible while offline.");
    } finally {
      setSavingFollowup(false);
    }
  };

  const handleUploadFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const invalid = files.find((file) => !ALLOWED_EXTENSIONS.includes(getExtension(file)));
    if (invalid) {
      setMessage("Only JPG, JPEG, PNG, PDF, DOC, and DOCX files are allowed.");
      return;
    }

    setUploading(true);
    setMessage("");
    for (const file of files) {
      await uploadSingleFile(file);
    }
    setUploading(false);
    onRefreshTask?.();
  };

  const uploadSingleFile = async (file) => {
    const formData = new FormData();
formData.append("attachments", file);

    formData.append("employee_id", user.id ?? "");
    formData.append("created_by", user.name);

    try {
      const authHeaders = getAuthHeaders();
      if (!authHeaders.Authorization) {
        throw new Error("Not authorized, no token");
      }

      const response = await axios.post(`${API_BASE}/tasks/${taskId}/attachments`, formData, {
        headers: authHeaders,
      });
     const uploadedFiles = response.data?.attachments || [];

if (uploadedFiles.length) {
  setAttachments((current) => [
    ...uploadedFiles.map((item) =>
      normalizeAttachment(item, file, user)
    ),
    ...current,
  ]);
}
      setMessage("Attachment uploaded successfully.");
    } catch (error) {
      console.error("Failed to upload attachment", error);
      const previewUrl = file.size <= 1024 * 1024 * 2 ? await fileToDataUrl(file) : "";
      const localRow = normalizeAttachment({
        id: `local-attachment-${Date.now()}-${file.name}`,
        file_name: file.name,
        file_type: getExtension(file),
        file_size: file.size,
        created_at: new Date().toISOString(),
        created_by: user.name,
        preview_url: previewUrl,
        localOnly: true,
      }, file, user);
      appendLocalRow(LOCAL_ATTACHMENTS_KEY, taskId, localRow);
      setAttachments((current) => [localRow, ...current]);
      setMessage("Attachment saved locally because the network or upload API is unavailable.");
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: ListChecks },
    { id: "followups", label: "Followups", icon: CalendarDays },
    { id: "attachments", label: "Attachments", icon: Paperclip },
    { id: "timeline", label: "Timeline", icon: History },
    { id: "notes", label: "Notes", icon: MessageSquareText },
  ];

  return (
    <div className="task-detail-overlay" onClick={onClose}>
      <section className="task-detail-panel" onClick={(event) => event.stopPropagation()}>
        <header className="task-detail-header">
          <div>
            <p>Task Details</p>
            <h2>{task.title || "Task"}</h2>
          </div>
          <button type="button" className="task-detail-close" onClick={onClose} aria-label="Close details">
            <X size={20} />
          </button>
        </header>

        <nav className="task-detail-tabs" aria-label="Task detail sections">
          {tabs.map(({ id, label, icon }) => (
            <button
              type="button"
              key={id}
              className={activeTab === id ? "active" : ""}
              onClick={() => setActiveTab(id)}
            >
              {createElement(icon, { size: 16 })}
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {message && <p className="task-detail-message">{message}</p>}
        {loading && <p className="task-detail-loading">Loading task history...</p>}

        <div className="task-detail-body">
          {activeTab === "overview" && (
            <OverviewSection task={task} onAction={onAction} />
          )}

          {activeTab === "followups" && (
            <section className="detail-section">
              <div className="followup-form">
                <label>
                  Followup Date
                  <input
                    type="date"
                    value={followupDate}
                    onChange={(event) => setFollowupDate(event.target.value)}
                  />
                </label>
                <label>
                  Remark
                  <textarea
                    value={followupRemark}
                    onChange={(event) => setFollowupRemark(event.target.value)}
                    placeholder="Add followup remark"
                    rows={3}
                  />
                </label>
                <button type="button" onClick={handleAddFollowup} disabled={savingFollowup}>
                  <Plus size={16} />
                  {savingFollowup ? "Saving..." : "Add Followup"}
                </button>
              </div>

              <HistoryList
                emptyText="No followups yet."
                rows={followups.map((item) => ({
                  id:
  item.id ??
  `${item.followup_date}-${item.followup_note || item.remark}`,
                  title: formatDate(item.followup_date ?? item.followupDate ?? item.date),
                  subtitle:
  item.remark ||
  item.followup_note ||
  item.followup_remark ||
  "-",
                  meta: `Created by ${item.created_by || item.createdBy || item.employee_name || "Employee"}`,
                  localOnly: item.localOnly,
                }))}
              />
            </section>
          )}

          {activeTab === "attachments" && (
            <section className="detail-section">
              <input
                ref={cameraInputRef}
                className="hidden-file-input"
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                onChange={handleUploadFiles}
              />
              <input
                ref={imageInputRef}
                className="hidden-file-input"
                type="file"
                accept="image/jpeg,image/png"
                multiple
                onChange={handleUploadFiles}
              />
              <input
                ref={documentInputRef}
                className="hidden-file-input"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                onChange={handleUploadFiles}
              />

              <div className="attachment-actions">
                <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={uploading}>
                  <ImageUp size={16} /> Take Photo
                </button>
                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading}>
                  <Upload size={16} /> Select Image
                </button>
                <button type="button" onClick={() => documentInputRef.current?.click()} disabled={uploading}>
                  <FileText size={16} /> Upload PDF / Document
                </button>
              </div>

              <HistoryList
                emptyText="No attachments uploaded yet."
                rows={attachments.map((item) => ({
                  id: item.id ?? item.file_name ?? item.name,
                  title: item.file_name || item.fileName || item.name || "Attachment",
                  subtitle: formatDateTime(item.created_at ?? item.createdAt ?? item.uploaded_at),
                  meta: item.created_by || item.createdBy || item.employee_name || "Employee",
                  href: item.url || item.file_url || item.fileUrl || item.preview_url,
                  localOnly: item.localOnly,
                }))}
              />
            </section>
          )}

          {activeTab === "timeline" && (
            <HistoryList emptyText="No timeline activity yet." rows={flowLogs} ordered />
          )}

          {activeTab === "notes" && (
            <HistoryList
              emptyText="No notes yet."
              rows={notes.map((note, index) => ({
                id: note.id ?? `${taskId}-note-${index}`,
                title: note.employee_name || note.employeeName || "Employee",
                subtitle: note.note || note.text || "-",
                meta: formatDateTime(note.created_at ?? note.createdAt ?? note.updated_at ?? note.updatedAt),
              }))}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function OverviewSection({ task, onAction }) {
  const dueDate = getDueDate(task);
  const rows = [
    ["Status", normalizeStatusLabel(task.status)],
    ["Progress", `${task.progress ?? 0}%`],
    ["Assigned To", Array.isArray(task.assignedTo) ? task.assignedTo.join(", ") : task.assignedTo || "Unassigned"],
    ["Due Date", dueDate ? formatDateTime(dueDate) : "Not set"],
    ["Created", formatDateTime(task.created_at ?? task.createdAt)],
  ];

  return (
    <section className="detail-section">
      <p className="task-detail-description">{task.description || "No description available."}</p>
      <div className="overview-grid">
        {rows.map(([label, value]) => (
          <div className="overview-item" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="detail-action-strip">
        <button type="button" onClick={() => onAction?.(task, "in-progress")}>Update Progress</button>
        <button type="button" onClick={() => onAction?.(task, "pending")}>Pending Reason</button>
        <button type="button" onClick={() => onAction?.(task, "reassign")}>Reassign</button>
        <button type="button" onClick={() => onAction?.(task, "note-add")}>Add Notes</button>
        <button type="button" onClick={() => onAction?.(task, "note-view")}>View Notes</button>
        <button type="button" onClick={() => onAction?.(task, "done")}>Complete</button>
      </div>
    </section>
  );
}

function HistoryList({ rows, emptyText, ordered = false }) {
  if (!rows.length) return <p className="task-detail-empty">{emptyText}</p>;

  return (
    <div className={ordered ? "history-list history-list--timeline" : "history-list"}>
      {rows.map((row) => (
        <article className="history-item" key={row.id}>
          <div className="history-dot">
            <Clock3 size={14} />
          </div>
          <div>
            <div className="history-title-row">
              {row.href ? (
                <a href={row.href} target="_blank" rel="noreferrer">{row.title}</a>
              ) : (
                <strong>{row.title}</strong>
              )}
              {row.localOnly && <span>Local</span>}
            </div>
            <p>{row.subtitle}</p>
            <small>{row.meta}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.followups)) return payload.followups;
  if (Array.isArray(payload?.attachments)) return payload.attachments;
  return payload && typeof payload === "object" ? [payload] : [];
}

function normalizeFollowup(row, user) {
  return {
    ...row,
    followup_date: row.followup_date ?? row.followupDate ?? row.date,
    remark:
  row.remark ??
  row.followup_note ??
  row.followup_remark ??
  "",
    created_by: row.created_by ?? row.createdBy ?? row.employee_name ?? user.name,
    created_at: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}

function normalizeAttachment(row, file, user) {
  return {
    ...row,
    file_name: row.file_name ?? row.fileName ?? row.name ?? file?.name,
    file_type: row.file_type ?? row.fileType ?? getExtension(file),
    file_size: row.file_size ?? row.fileSize ?? file?.size,
    created_by: row.created_by ?? row.createdBy ?? row.employee_name ?? user.name,
    created_at: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}

function buildTimeline(task, followups, attachments, notes) {
  const events = [];
  const push = (type, date, subtitle, meta = "") => {
    if (!date) return;
    events.push({
      id: `${type}-${date}-${events.length}`,
      title: type,
      subtitle,
      meta: formatDateTime(date) + (meta ? ` • ${meta}` : ""),
      rawDate: new Date(date).getTime(),
    });
  };

  push("Task Created", task.created_at ?? task.createdAt, task.title || "Task created");
  push("Assigned", task.assigned_at ?? task.assignedAt ?? task.created_at ?? task.createdAt, "Task assigned");
  push("Reassigned", task.reassigned_at ?? task.reassignedAt, task.reassignReason || "Task reassigned");
  push("Status Changed", task.updated_at ?? task.updatedAt, normalizeStatusLabel(task.status));
  push("Completed", task.completedAt ?? task.completed_at, "Task completed");

  notes.forEach((note) => {
    push("Note Added", note.created_at ?? note.createdAt ?? note.updated_at ?? note.updatedAt, note.note || note.text || "-", note.employee_name || note.employeeName || "");
  });

  followups.forEach((item) => {
    push("Followup Added", item.created_at ?? item.createdAt ?? item.followup_date ?? item.followupDate, item.remark || item.followup_remark || "-", item.created_by || item.createdBy || "");
  });

  attachments.forEach((item) => {
    push("Attachment Uploaded", item.created_at ?? item.createdAt ?? item.uploaded_at, item.file_name || item.fileName || item.name || "Attachment", item.created_by || item.createdBy || "");
  });

  return events
    .filter((event) => Number.isFinite(event.rawDate))
    .sort((a, b) => a.rawDate - b.rawDate);
}
