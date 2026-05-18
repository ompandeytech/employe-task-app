import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskContext } from "../context/taskContextStore";
import NotificationBell from "../components/NotificationBell";
import RefreshWrapper from "../components/RefreshWrapper";
import WorkspaceBottomNav from "../components/WorkspaceBottomNav";
import "./dasboard.css";

export default function Dashboard({ setOpenMenu }) {
  const navigate = useNavigate();
  const { getTasksByStatus, getTodayTasks, refreshTasks } = useTaskContext();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userName = user?.name || "User";

  const todayTasks = getTodayTasks();
  const doneTasks = getTasksByStatus("done");
  const pendingTasks = getTasksByStatus("pending");
  const inProgressTasks = getTasksByStatus("inprogress");
  const reassignedTasks = getTasksByStatus("reassigned");
  const todoTasks = getTasksByStatus("todo");

  const stats = {
    total: todayTasks.length,
    done: doneTasks.length,
    pending: pendingTasks.length,
    inProgress: inProgressTasks.length,
    reassigned: reassignedTasks.length,
    todo: todoTasks.length,
  };

  const handleDashboardRefresh = useCallback(async () => {
    if (!refreshTasks) return;
    await refreshTasks();
  }, [refreshTasks]);

  const statCards = [
    {
      key: "done",
      tone: "blue",
      title: "Completed",
      value: stats.done,
      meta: "Tasks closed",
      icon: "fa-check-circle",
    },
    {
      key: "pending",
      tone: "gray",
      title: "Pending",
      value: stats.pending,
      meta: "Awaiting action",
      icon: "fa-clock",
    },
    {
      key: "inProgress",
      tone: "violet",
      title: "In Progress",
      value: stats.inProgress,
      meta: "Currently moving",
      icon: "fa-arrows-rotate",
    },
    {
      key: "reassigned",
      tone: "red",
      title: "Reassigned",
      value: stats.reassigned,
      meta: "Moved to others",
      icon: "fa-user-plus",
    },
  ];

  const quickActions = [
    {
      key: "done",
      title: "Completed",
      subtitle: `${stats.done} tasks done`,
      icon: "fa-check",
      route: "/done",
      tone: "blue",
    },
    {
      key: "progress",
      title: "In Progress",
      subtitle: `${stats.inProgress} active`,
      icon: "fa-sync",
      route: "/inprogress",
      tone: "violet",
    },
    {
      key: "pending",
      title: "Pending",
      subtitle: `${stats.pending} waiting`,
      icon: "fa-hourglass-half",
      route: "/pending",
      tone: "gray",
    },
    {
      key: "reassigned",
      title: "Reassigned",
      subtitle: `${stats.reassigned} moved`,
      icon: "fa-user-plus",
      route: "/reassigned",
      tone: "red",
    },
  ];

  return (
    <>
      <RefreshWrapper onRefresh={handleDashboardRefresh}>
        <div className="dashboard-page">
          <header className="dashboard-topbar">
            <button
              type="button"
              className="dashboard-icon-button"
              onClick={() => setOpenMenu(true)}
            >
              <i className="fas fa-bars"></i>
            </button>
            <span className="dashboard-topbar-title">Techiohisab</span>
            <div className="dashboard-topbar-bell">
              <NotificationBell />
            </div>
          </header>

          <main className="dashboard-content">
            <section className="dashboard-overview-card">
              <div className="dashboard-overview-copy">
                <span className="dashboard-overview-kicker">Workspace overview</span>
                <h1 className="dashboard-overview-title">Welcome back, {userName}</h1>
                <p className="dashboard-overview-text">
                  You have {stats.total} tasks scheduled for today across active and follow-up work.
                </p>
              </div>

              <div className="dashboard-overview-summary">
                <div className="dashboard-overview-chip">
                  <span>Today</span>
                  <strong>{stats.total}</strong>
                </div>
                <div className="dashboard-overview-chip">
                  <span>Open</span>
                  <strong>{stats.pending + stats.inProgress}</strong>
                </div>
              </div>
            </section>

            <section className="dashboard-section">
              <div className="dashboard-section-head">
                <h2 className="dashboard-section-title">Task analytics</h2>
                <span className="dashboard-section-note">Daily snapshot</span>
              </div>

              <div className="dashboard-stat-grid">
                {statCards.map((card) => (
                  <article
                    key={card.key}
                    className={`dashboard-stat-card dashboard-stat-card--${card.tone}`}
                  >
                    <div className="dashboard-stat-icon">
                      <i className={`fas ${card.icon}`} aria-hidden="true"></i>
                    </div>
                    <div className="dashboard-stat-value">{card.value}</div>
                    <div className="dashboard-stat-title">{card.title}</div>
                    <div className="dashboard-stat-meta">{card.meta}</div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboard-section">
              <div className="dashboard-section-head">
                <h2 className="dashboard-section-title">Quick actions</h2>
                <span className="dashboard-section-note">Jump into work</span>
              </div>

              <div className="dashboard-action-grid">
                {quickActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className={`dashboard-action-card dashboard-action-card--${action.tone}`}
                    onClick={() => navigate(action.route)}
                  >
                    <span className="dashboard-action-icon" aria-hidden="true">
                      <i className={`fas ${action.icon}`}></i>
                    </span>
                    <span className="dashboard-action-title">{action.title}</span>
                    <span className="dashboard-action-subtitle">{action.subtitle}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="dashboard-insight-card">
              <div className="dashboard-insight-copy">
                <span className="dashboard-insight-kicker">Focus note</span>
                <h3 className="dashboard-insight-title">Keep momentum with smaller next steps.</h3>
                <p className="dashboard-insight-text">
                  Prioritize one pending item, move one in-progress task forward, and keep your day
                  easier to manage.
                </p>
              </div>
              <div className="dashboard-insight-icon" aria-hidden="true">
                <i className="fas fa-lightbulb"></i>
              </div>
            </section>
          </main>
        </div>
      </RefreshWrapper>

      <WorkspaceBottomNav />
    </>
  );
}
