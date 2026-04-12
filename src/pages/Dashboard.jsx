import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskContext } from "../context/taskContextStore";
import NotificationBell from "../components/NotificationBell";

export default function Dashboard({ setOpenMenu }) {
  const navigate = useNavigate();
  const { getTasksByStatus, getTodayTasks } = useTaskContext();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userName = user?.name || "User";
  
  const todayTasks = getTodayTasks();
  const doneTasks = getTasksByStatus('done');
  const pendingTasks = getTasksByStatus('pending');
  const inProgressTasks = getTasksByStatus('inprogress');
  const reassignedTasks = getTasksByStatus('reassigned');
  const todoTasks = getTasksByStatus('todo');

  const stats = {
    total: todayTasks.length,
    done: doneTasks.length,
    pending: pendingTasks.length,
    inProgress: inProgressTasks.length,
    reassigned: reassignedTasks.length,
    todo: todoTasks.length
  };

  return (
    <div className="home-screen">
      {/* Top Navbar */}
      <div className="top-navbar">
        <button className="menu-icon" onClick={() => setOpenMenu(true)}>
          <i className="fas fa-bars"></i>
        </button>
        <span className="app-name">Apna Task</span>
        <NotificationBell />
      </div>

      {/* Welcome Section */}
      <div className="welcome-section">
        <p className="welcome-text">Welcome back,</p>
        <h2 className="user-name">{userName}</h2>
      </div>

      {/* Your Tasks Card */}
      <div className="your-tasks-card">
        <div className="card-header">
          <h3 className="card-title">Your Tasks</h3>
          <span className="today-pill">Today</span>
        </div>
        <div className="stats-badges">
          <div className="stat-badge total">
            <i className="fas fa-layer-group"></i>
            <span>{stats.total} Total</span>
          </div>
          <div className="stat-badge done">
            <i className="fas fa-check-circle"></i>
            <span>{stats.done} Done</span>
          </div>
          <div className="stat-badge pending">
            <i className="fas fa-clock"></i>
            <span>{stats.pending} Pending</span>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="quick-actions">
        <div className="section-header">
          <h3 className="section-title">Quick Actions</h3>
        </div>
        <div className="action-grid">
          <div className="action-card done" onClick={() => navigate("/done")}>
            <div className="card-icon">
              <i className="fas fa-check"></i>
            </div>
            <h4 className="action-title">Done</h4>
            <p className="action-subtitle">{stats.done} completed</p>
          </div>
          <div className="action-card progress" onClick={() => navigate("/inprogress")}>
            <div className="card-icon">
              <i className="fas fa-sync"></i>
            </div>
            <h4 className="action-title">In Progress</h4>
            <p className="action-subtitle">{stats.inProgress} working</p>
          </div>
          <div className="action-card pending" onClick={() => navigate("/pending")}>
            <div className="card-icon">
              <i className="fas fa-hourglass-half"></i>
            </div>
            <h4 className="action-title">Pending</h4>
            <p className="action-subtitle">{stats.pending} on hold</p>
          </div>
          <div className="action-card reassign" onClick={() => navigate("/reassigned")}>
            <div className="card-icon">
              <i className="fas fa-user-plus"></i>
            </div>
            <h4 className="action-title">Reassigned</h4>
            <p className="action-subtitle">{stats.reassigned} reassigned</p>
          </div>
        </div>
      </div>

      {/* Productivity Tip Card */}
      <div className="productivity-tip">
        <div className="tip-content">
          <h3 className="tip-title">Productivity Tip</h3>
          <p className="tip-description">Break your big goals into small daily tasks to stay focused.</p>
        </div>
        <div className="tip-icon">
          <i className="fas fa-lightbulb"></i>
        </div>
      </div>

      {/* Soft Bottom Navigation */}
      <div className="soft-bottom-nav">
        <div className="nav-item active" onClick={() => navigate("/")}>
          <i className="fas fa-home"></i>
          <span>Home</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/tasks")}>
          <i className="fas fa-tasks"></i>
          <span>Tasks</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/report")}>
          <i className="fas fa-chart-line"></i>
          <span>Report</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/profile")}>
          <i className="fas fa-user"></i>
          <span>Profile</span>
        </div>
      </div>

      <style>{`
        * {
          box-sizing: border-box;
        }
        
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }

        .home-screen {
          min-height: 100vh;
          background: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding-bottom: 80px;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          width: 100%;
          max-width: 100%;
        }

        /* Top Navbar */
        .top-navbar {
          background: linear-gradient(135deg, #1e40af, #3730a3);
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          width: 100%;
        }

        .menu-icon, .notification-icon {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: background 0.2s ease;
        }

        .menu-icon:hover, .notification-icon:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .menu-icon i, .notification-icon i {
          font-size: 18px;
        }

        .notification-icon {
          position: relative;
        }

        .red-dot {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          border: 2px solid #1e40af;
        }

        .app-name {
          color: white;
          font-size: 18px;
          font-weight: 600;
        }

        /* Welcome Section */
        .welcome-section {
          padding: 15px 8px 10px;
        }

        .welcome-text {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 4px 0;
        }

        .user-name {
          color: #1e293b;
          font-size: 28px;
          font-weight: 700;
          margin: 0;
        }

        /* Your Tasks Card */
        .your-tasks-card {
          background: white;
          margin: 0 8px 12px;
          border-radius: 16px;
          padding: 12px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .card-title {
          color: #1e293b;
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .today-pill {
          background: #dbeafe;
          color: #1e40af;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .stats-badges {
          display: flex;
          gap: 6px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        /* Quick Actions Section */
        .quick-actions {
          padding: 0 8px 12px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .section-title {
          color: #1e293b;
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .view-all {
          color: #3b82f6;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .action-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .action-card {
          border-radius: 12px;
          padding: 12px;
          text-align: center;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .action-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        .action-card.done {
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }

        .action-card.progress {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
        }

        .action-card.pending {
          background: linear-gradient(135deg, #f97316, #ea580c);
          box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);
        }

        .action-card.reassign {
          background: linear-gradient(135deg, #ec4899, #db2777);
          box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3);
        }

        .card-icon {
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 8px;
        }

        .card-icon i {
          color: white;
          font-size: 16px;
        }

        .action-title {
          color: white;
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 2px 0;
        }

        .action-subtitle {
          color: rgba(255, 255, 255, 0.8);
          font-size: 11px;
          margin: 0;
        }

        /* Productivity Tip Card */
        .productivity-tip {
          background: #fef3c7;
          margin: 0 8px 12px;
          border-radius: 12px;
          padding: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tip-content {
          flex: 1;
        }

        .tip-title {
          color: #92400e;
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 3px 0;
        }

        .tip-description {
          color: #78350f;
          font-size: 13px;
          margin: 0;
          line-height: 1.4;
        }

        .tip-icon {
          width: 36px;
          height: 36px;
          background: #fbbf24;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 10px;
        }

        .tip-icon i {
          color: white;
          font-size: 16px;
        }

        /* Soft Bottom Navigation */
        .soft-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(15px);
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 12px 0;
          box-shadow: 0 -2px 15px rgba(0, 0, 0, 0.06);
          z-index: 1000;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 8px 16px;
          border-radius: 12px;
        }

        .nav-item:hover {
          background: rgba(59, 130, 246, 0.08);
          transform: translateY(-1px);
        }

        .nav-item i {
          font-size: 18px;
          color: #94a3b8;
          transition: color 0.2s ease;
        }

        .nav-item span {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          transition: color 0.2s ease;
        }

        .nav-item.active i {
          color: #667eea;
        }

        .nav-item.active span {
          color: #667eea;
          font-weight: 600;
        }

        /* Responsive Design */
        @media (max-width: 480px) {
          .action-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
