import './TaskCard.css';

const statusMeta = {
  done: {
    label: 'Completed',
    color: '#10b981',
    icon: 'fa-circle-check',
  },
  pending: {
    label: 'Pending',
    color: '#f97316',
    icon: 'fa-clock',
  },
  in_progress: {
    label: 'In Progress',
    color: '#3b82f6',
    icon: 'fa-spinner',
  },
  reassigned: {
    label: 'Reassigned',
    color: '#8b5cf6',
    icon: 'fa-user-pen',
  },
  assigned: {
    label: 'Assigned',
    color: '#0f766e',
    icon: 'fa-clipboard-list',
  },
  follow_up: {
    label: 'Follow Up',
    color: '#d97706',
    icon: 'fa-calendar-check',
  },
  review: {
    label: 'Review',
    color: '#2563eb',
    icon: 'fa-magnifying-glass-chart',
  },
  on_hold: {
    label: 'On Hold',
    color: '#f97316',
    icon: 'fa-pause-circle',
  },
};

const getStatusInfo = (status) => {
  const normalized = String(status || 'pending').trim().toLowerCase().replace(/\s+/g, '_');
  if (statusMeta[normalized]) return statusMeta[normalized];
  if (normalized === 'inprogress') return statusMeta.in_progress;
  return statusMeta.pending;
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const resolveAssignedTo = (assignedTo) => {
  if (Array.isArray(assignedTo)) return assignedTo.join(', ');
  return assignedTo || 'Unassigned';
};

const normalizeDateOnly = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const getDueDate = (task) =>
  task.due_date ||
  task.dueDate ||
  task.deadline ||
  task.deadline_at ||
  task.deadlineAt ||
  task.target_date ||
  task.targetDate ||
  null;

const getDeadlineState = (task) => {
  const dueDate = getDueDate(task);
  if (!dueDate) return { tone: 'schedule', label: 'On schedule', dueDate: null };
  const parsedDue = new Date(dueDate);
  if (Number.isNaN(parsedDue.getTime())) {
    return { tone: 'schedule', label: 'On schedule', dueDate: null };
  }
  const today = normalizeDateOnly(new Date());
  const due = normalizeDateOnly(parsedDue);
  if (due.getTime() < today.getTime()) return { tone: 'overdue', label: 'Overdue', dueDate };
  if (due.getTime() === today.getTime()) return { tone: 'today', label: 'Due today', dueDate };
  return { tone: 'schedule', label: 'On schedule', dueDate };
};

export default function TaskCard({
  task,
  onAction,
  actions,
  showAddNote = false,
  showViewNotes = false,
  onOpenDetails,
}) {
  const status = String(task.status || 'pending').trim().toLowerCase().replace(/\s+/g, '_');
  const metadata = getStatusInfo(status);
  const assignedTo = resolveAssignedTo(task.assignedTo);
  const progress = task.progress == null ? 0 : Number(task.progress);
  const reassignedBy =
    task.reassigned_by_name || task.reassigned_by || task.reassignedBy;
  const reassignedToName = task.reassigned_to_name || task.reassignedToName;
  const isReassigned = Boolean(reassignedBy);
  const deadline = getDeadlineState(task);

  const defaultActions = [
    { action: 'done', label: 'Done', icon: 'fa-circle-check', className: 'done' },
    { action: 'in-progress', label: 'In Progress', icon: 'fa-spinner', className: 'in-progress' },
    { action: 'pending', label: 'Pending', icon: 'fa-clock', className: 'pending' },
    { action: 'reassign', label: 'Reassign', icon: 'fa-user-pen', className: 'reassign' },
  ];

  const actionButtons = actions || defaultActions;
  const noteButtons = [];
  if (showAddNote) {
    noteButtons.push({ action: 'note-add', label: 'Add Note', icon: 'fa-plus', className: 'note' });
  }
  if (showViewNotes) {
    noteButtons.push({ action: 'note-view', label: 'View Notes', icon: 'fa-eye', className: 'note-view' });
  }

  return (
    <div
      className="task-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails?.(task)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetails?.(task);
        }
      }}
      style={{
        borderLeft: `4px solid ${isReassigned ? "#8b5cf6" : metadata.color}`,
      }}
    >
        <div
          className={`status-badge ${
            isReassigned ? "status-badge--reassigned" : `status-badge--${status}`
          }`}
        >
        <i className={`fas ${metadata.icon}`}></i>
        <span>{metadata.label.toUpperCase()}</span>
      </div>

      <div className="task-content">
        <div className={`deadline-pill deadline-pill--${deadline.tone}`}>
          <span></span>
          {deadline.label}
        </div>
        <h3 className="task-title">{task.title}</h3>
        <p className="task-description">{task.description}</p>

        <div className="task-details">
          <div className="detail-item">
            <i className="fas fa-user"></i>
            <span>Assigned To: {assignedTo}</span>
          </div>
          {isReassigned && (
            <div className="task-reassigned-info">
              <span role="img" aria-label="reassigned">
                🔁
              </span>
              <span>Reassigned by: {reassignedBy}</span>
            </div>
          )}
          <div className="detail-item">
            <i className="fas fa-info-circle"></i>
            <span>Status: {metadata.label}</span>
          </div>
          <div className="detail-item">
            <i className="fas fa-chart-line"></i>
            <span>Progress: {progress}%</span>
          </div>
          {deadline.dueDate && (
            <div className="detail-item">
              <i className="fas fa-calendar-day"></i>
              <span>Due: {formatDate(deadline.dueDate)}</span>
            </div>
          )}
          {status === 'in_progress' && task.startedAt && (
            <div className="detail-item">
              <i className="fas fa-play"></i>
              <span>Started: {formatDate(task.startedAt)}</span>
            </div>
          )}
          {status === 'pending' && task.pendingAt && (
            <div className="detail-item">
              <i className="fas fa-calendar-alt"></i>
              <span>Since: {formatDate(task.pendingAt)}</span>
            </div>
          )}
          {status === 'reassigned' && (reassignedToName || task.reassignedTo) && (
            <div className="detail-item">
            <i className="fas fa-user-plus"></i>
            <span>Reassigned to: {reassignedToName || task.reassignedTo}</span>
          </div>
        )}
          {status === 'reassigned' && task.reassigned_at && (
            <div className="detail-item">
              <i className="fas fa-calendar-alt"></i>
              <span>Reassigned: {formatDate(task.reassigned_at)}</span>
            </div>
          )}
          {status === 'done' && task.completedAt && (
            <div className="detail-item">
              <i className="fas fa-check-circle"></i>
              <span>Completed: {formatDate(task.completedAt)}</span>
            </div>
          )}
        </div>

        {status === 'pending' && (task.pendingReason || task.reason) && (
          <div className="pending-reason">
            <span className="pending-reason-icon">⚠️</span>
            <div>
              <strong>Reason:</strong> {task.pendingReason || task.reason}
            </div>
          </div>
        )}

        {status === 'reassigned' && task.reassignReason && (
          <div className="task-reason">
            <i className="fas fa-exclamation-triangle"></i>
            <div>
              <strong>Reason:</strong> {task.reassignReason}
            </div>
          </div>
        )}

      </div>

      <div className="action-buttons">
        {actionButtons.map(({ action, label, icon, className }) => (
          <button
            key={action}
            type="button"
            className={`action-btn ${className}`}
            onClick={(event) => {
              event.stopPropagation();
              onAction?.(task, action);
            }}
          >
            <i className={`fas ${icon}`}></i>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {noteButtons.length > 0 && (
        <div className="note-actions">
          {noteButtons.map(({ action, label, icon, className }) => (
            <button
              key={action}
              type="button"
              className={`action-btn ${className}`}
              onClick={(event) => {
                event.stopPropagation();
                onAction?.(task, action);
              }}
            >
              <i className={`fas ${icon}`}></i>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
