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
};

const getStatusInfo = (status) => {
  const normalized = String(status || 'pending').trim().toLowerCase();
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

export default function TaskCard({
  task,
  onAction,
  actions,
  showAddNote = false,
  showViewNotes = false,
}) {
  const status = String(task.status || 'pending').trim().toLowerCase();
  const metadata = getStatusInfo(status);
  const assignedTo = resolveAssignedTo(task.assignedTo);
  const progress = task.progress == null ? 0 : Number(task.progress);

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

  const showReassignedBadge = status === "reassigned";

  return (
    <div className="task-card" style={{ borderLeft: `4px solid ${metadata.color}` }}>
      <div className={`status-badge status-badge--${status}`}>
        <i className={`fas ${metadata.icon}`}></i>
        <span>{metadata.label.toUpperCase()}</span>
        {showReassignedBadge && <span className="status-badge__extra">REASSIGNED</span>}
      </div>

      <div className="task-content">
        <h3 className="task-title">{task.title}</h3>
        <p className="task-description">{task.description}</p>

        <div className="task-details">
          <div className="detail-item">
            <i className="fas fa-user"></i>
            <span>Assigned To: {assignedTo}</span>
          </div>
          {task.reassignedBy && (
            <div className="task-reassigned-info">
              <span role="img" aria-label="reassigned">
                🔁
              </span>
              <span>Reassigned by: {task.reassignedBy}</span>
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
          {status === 'reassigned' && (task.reassignedToName || task.reassignedTo) && (
            <div className="detail-item">
              <i className="fas fa-user-plus"></i>
              <span>Reassigned to: {task.reassignedToName || task.reassignedTo}</span>
            </div>
          )}
          {status === 'reassigned' && task.reassignedBy && (
            <div className="detail-item reassigned-by">
              <i className="fas fa-user-check"></i>
              <span>Reassigned by: {task.reassignedBy}</span>
            </div>
          )}
          {status === 'reassigned' && task.reassignedAt && (
            <div className="detail-item">
              <i className="fas fa-calendar-alt"></i>
              <span>Reassigned: {formatDate(task.reassignedAt)}</span>
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

        {task.reassignedBy && (
          <div className="task-reassigned-info">
            <span role="img" aria-label="reassigned">
              🔁
            </span>
            <span>Reassigned by: {task.reassignedBy}</span>
          </div>
        )}
      </div>

      <div className="action-buttons">
        {actionButtons.map(({ action, label, icon, className }) => (
          <button
            key={action}
            type="button"
            className={`action-btn ${className}`}
            onClick={() => onAction?.(task, action)}
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
              onClick={() => onAction?.(task, action)}
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
