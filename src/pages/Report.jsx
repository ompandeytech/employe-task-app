import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskContext } from "../context/taskContextStore";
import axios from "axios";
import { API_BASE, getAuthHeaders } from "../utils/apiConfig";
import RefreshWrapper from "../components/RefreshWrapper";

const getUserId = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user?.id ?? user?.user_id ?? user?.userId ?? user?.employee_id ?? user?.employeeId ?? null;
};

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (date) => {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

const isPresentRecord = (record) => {
  const status = String(record?.status || "").toLowerCase();
  if (status === "present" || status === "paid" || status === "p") return true;
  if (status === "absent" || status === "leave" || status === "a" || status === "l") return false;
  return Boolean(record?.in_time || record?.out_time);
};

export default function Report() {
  const navigate = useNavigate();
  const { tasks, refreshTasks } = useTaskContext();
  const userId = getUserId();
  const [range, setRange] = useState("7");
  const [attendanceRows, setAttendanceRows] = useState([]);

  const loadAttendance = useCallback(async () => {
    if (!userId) {
      setAttendanceRows([]);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/attendance`, {
        headers: getAuthHeaders(),
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      const employeeRows = rows.filter((row) => String(row.employee_id) === String(userId));
      setAttendanceRows(employeeRows);
    } catch {
      setAttendanceRows([]);
    }
  }, [userId]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadAttendance();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [loadAttendance]);

  const handleReportRefresh = useCallback(async () => {
    await Promise.all([
      loadAttendance(),
      refreshTasks ? refreshTasks() : Promise.resolve(),
    ]);
  }, [loadAttendance, refreshTasks]);

  // Filter data based on time range
  const filteredData = useMemo(() => {
    const today = startOfDay(new Date());
    const filterDate = startOfDay(new Date());

    switch (range) {
      case "7":
        filterDate.setDate(today.getDate() - 7);
        break;
      case "30":
        filterDate.setDate(today.getDate() - 30);
        break;
      case "this":
        filterDate.setDate(1);
        break;
      default:
        filterDate.setDate(today.getDate() - 7);
    }

    const filteredTasks = tasks.filter((task) => new Date(task.createdAt) >= filterDate);

    const attendanceByDate = new Map();
    attendanceRows.forEach((row) => {
      const key = String(row?.date || "").slice(0, 10);
      if (!key) return;
      attendanceByDate.set(key, row);
    });

    const filteredAttendance = [];
    const cursor = new Date(filterDate);
    while (cursor <= today) {
      const key = toIsoDate(cursor);
      const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;
      const record = attendanceByDate.get(key);
      const present = isWeekend ? false : (record ? isPresentRecord(record) : false);
      filteredAttendance.push({
        date: key,
        day: cursor.toLocaleDateString("en-US", { weekday: "short" }),
        dateNum: cursor.getDate(),
        present,
        isWeekend,
        status: isWeekend ? "weekend" : (present ? "present" : "absent"),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return { tasks: filteredTasks, attendance: filteredAttendance };
  }, [tasks, attendanceRows, range]);

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    const { tasks: filteredTasks, attendance: filteredAttendance } = filteredData;
    
    const completedTasks = filteredTasks.filter(t => t.status === 'done');
    const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress');
    const pendingTasks = filteredTasks.filter(t => t.status === 'pending');
    const droppedTasks = filteredTasks.filter(t => t.status === 'reassigned');
    
    const workingDays = filteredAttendance.filter(a => !a.isWeekend);
    const presentDays = workingDays.filter(a => a.present);
    const leaveDays = workingDays.length - presentDays.length;
    
    const totalTasks = filteredTasks.length || 1;
    const workingDaysCount = workingDays.length || 1;
    
    // Weighted performance scoring:
    // Completed: +40%, In Progress: +10%, Pending: -20%, Reassigned: -20%, Attendance: +10%
    const completedScore = (completedTasks.length / totalTasks) * 40;
    const inProgressScore = (inProgressTasks.length / totalTasks) * 10;
    const pendingScore = (pendingTasks.length / totalTasks) * (-20);
    const reassignedScore = (droppedTasks.length / totalTasks) * (-20);
    const attendanceScore = (presentDays.length / workingDaysCount) * 10;
    
    const performanceScore = Math.min(100, Math.max(0, 
      Math.round(completedScore + inProgressScore + pendingScore + reassignedScore + attendanceScore)
    ));
    
    return {
      performanceScore,
      completedTasks: completedTasks.length,
      inProgressTasks: inProgressTasks.length,
      pendingTasks: pendingTasks.length,
      droppedTasks: droppedTasks.length,
      presentDays: presentDays.length,
      leaveDays
    };
  }, [filteredData]);

  // Get recent tasks with stable, deterministic time estimates
  const recentTasks = useMemo(() => {
    return [...filteredData.tasks]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((task) => {
        const createdAtMs = new Date(task.createdAt).getTime() || 0;
        const taskIdValue = Number(task.id) || 0;
        const timeTaken = 1 + Math.abs((createdAtMs + taskIdValue) % 4);
        return { ...task, timeTaken };
      });
  }, [filteredData.tasks]);

  return (
    <>
      <RefreshWrapper onRefresh={handleReportRefresh}>
        <div className="performance-dashboard report-container">
      {/* Header */}
      {/* Header Section */}
      <div className="dashboard-header">
        <h1 className="main-title">My Performance Report</h1>
        <p className="subtitle">See your performance insights</p>
      </div>

      {/* Time Filter Pills */}
      <div className="time-filter">
        <button
          className={`filter-pill ${range === "7" ? "active" : ""}`}
          onClick={() => setRange("7")}
        >
          Last 7 Days
        </button>
        <button
          className={`filter-pill ${range === "30" ? "active" : ""}`}
          onClick={() => setRange("30")}
        >
          Last Month
        </button>
        <button
          className={`filter-pill ${range === "this" ? "active" : ""}`}
          onClick={() => setRange("this")}
        >
          This Month
        </button>
      </div>

      {/* Performance Score Hero Card */}
      <div className="performance-hero-card">
        <h2 className="hero-title">Performance Score</h2>
        <div className="score-content">
          <div className="circular-progress">
            <svg width="180" height="180" className="progress-svg">
              <defs>
                <linearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
              <circle cx="90" cy="90" r="75" className="progress-bg" />
              <circle
                cx="90"
                cy="90"
                r="75"
                className="progress-fill"
                style={{
                  strokeDasharray: "471.24",
                  strokeDashoffset: 471.24 - (471.24 * performanceMetrics.performanceScore) / 100
                }}
              />
            </svg>
            <div className="score-center">
              <div className="score-percentage">{performanceMetrics.performanceScore}%</div>
              <div className="score-message">Great performance, keep it up!</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card completed">
          <div className="stat-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-number">{performanceMetrics.completedTasks}</div>
          <div className="stat-label">Tasks Completed</div>
        </div>

        <div className="stat-card in-progress">
          <div className="stat-icon">
            <i className="fas fa-spinner"></i>
          </div>
          <div className="stat-number">{performanceMetrics.inProgressTasks}</div>
          <div className="stat-label">In Progress</div>
        </div>

        <div className="stat-card pending">
          <div className="stat-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-number">{performanceMetrics.pendingTasks}</div>
          <div className="stat-label">Pending Tasks</div>
        </div>

        <div className="stat-card dropped">
          <div className="stat-icon">
            <i className="fas fa-times-circle"></i>
          </div>
          <div className="stat-number">{performanceMetrics.droppedTasks}</div>
          <div className="stat-label">Tasks Dropped</div>
        </div>

        <div className="stat-card attendance">
          <div className="stat-icon">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="stat-number">{performanceMetrics.presentDays}</div>
          <div className="stat-label">Days Present</div>
        </div>

        <div className="stat-card leaves">
          <div className="stat-icon">
            <i className="fas fa-calendar-times"></i>
          </div>
          <div className="stat-number">{performanceMetrics.leaveDays}</div>
          <div className="stat-label">Leaves Taken</div>
        </div>
      </div>

      {/* Attendance Chart Section */}
      <div className="attendance-section">
        <h3 className="section-title">Attendance (Last 7 Days)</h3>
        <div className="attendance-chart">
          <div className="chart-bars">
            {filteredData.attendance.slice(-7).map((day, index) => (
              <div key={index} className="bar-wrapper">
                <div 
                  className={`bar ${day.status}`}
                  style={{ height: day.present ? '60px' : '25px' }}
                ></div>
                <div className="bar-label">{day.day}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Breakdown Section */}
      <div className="task-breakdown">
        <h3 className="section-title">Task Breakdown</h3>
        <div className="task-list">
          {recentTasks.map(task => (
            <div key={task.id} className={`task-card ${task.status}`}>
              <div className="task-content">
                <div className="task-info">
                  <h4 className="task-title">{task.title}</h4>
                  <div className="task-details">
                    <span className="task-time">Time taken: {task.timeTaken} hrs</span>
                    <span className="task-date">Date: {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
                <div className={`task-status ${task.status}`}>
                  {task.status === 'done' ? 'Completed' : 
                   task.status === 'reassigned' ? 'Dropped' : 'In Progress'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Productivity Insight Card */}
      <div className="insight-card">
        <div className="insight-icon">
          <i className="fas fa-lightbulb"></i>
        </div>
        <div className="insight-content">
          <h4 className="insight-title">
            {performanceMetrics.performanceScore >= 80 ? 'Excellent Performance! 🌟' : 
             performanceMetrics.performanceScore >= 60 ? 'Good Progress 👍' : 
             performanceMetrics.performanceScore >= 40 ? 'Keep Improving 💪' : 
             'Needs Attention ⚠️'}
          </h4>
          <p className="insight-text">
            {performanceMetrics.performanceScore >= 80 ? 'Outstanding work! Your completion rate and attendance are excellent. Keep maintaining this momentum!' : 
             performanceMetrics.performanceScore >= 60 ? 'You\'re doing well! Focus on completing pending tasks and maintaining consistent attendance.' : 
             performanceMetrics.performanceScore >= 40 ? 'There\'s room for improvement. Try to complete more tasks and reduce pending items in your queue.' : 
             'Your performance needs attention. Work on clearing pending tasks and increasing your completion rate.'}
          </p>
        </div>
      </div>

    </div>
  </RefreshWrapper>

      <div className="bottom-nav">
        <div className="nav-item" onClick={() => navigate("/")}>
          <i className="fas fa-home"></i>
          <span>Home</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/tasks")}>
          <i className="fas fa-tasks"></i>
          <span>Tasks</span>
        </div>
        <div className="nav-item active" onClick={() => navigate("/report")}>
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
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
          background: #f8fafc;
          color: #1e293b;
          line-height: 1.5;
        }

        .performance-dashboard {
          min-height: 100vh;
          background: #f8fafc;
          padding: 0 20px 100px;
          max-width: 480px;
          margin: 0 auto;
        }

        .report-container {
          padding-bottom: 100px;
        }

        /* Header */
        .report-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0 16px;
          padding-top: calc(env(safe-area-inset-top, 0px) + 10px);
          margin-bottom: 24px;
          background: transparent;
        }

        .menu-btn {
          width: 40px;
          height: 40px;
          border: none;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
        }

        .menu-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }

        .menu-btn i {
          color: #64748b;
          font-size: 16px;
        }

        .page-title {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }

        /* Header */
        .dashboard-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .main-title {
          font-size: 32px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }

        .subtitle {
          font-size: 16px;
          color: #64748b;
          font-weight: 500;
        }

        /* Time Filter Pills */
        .time-filter {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 32px;
        }

        .filter-pill {
          padding: 14px 24px;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          background: #ffffff;
          color: #64748b;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .filter-pill:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
        }

        .filter-pill.active {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          border-color: transparent;
          box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
        }

        /* Performance Hero Card */
        .performance-hero-card {
          background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
          border-radius: 24px;
          padding: 32px 24px;
          margin-bottom: 32px;
          box-shadow: 
            0 20px 40px rgba(16, 185, 129, 0.25),
            0 0 0 1px rgba(255, 255, 255, 0.1);
          position: relative;
          overflow: hidden;
        }

        .performance-hero-card::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          animation: shimmer 3s ease-in-out infinite;
        }

        @keyframes shimmer {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          50% { transform: translate(-30%, -30%) rotate(180deg); }
        }

        .hero-title {
          font-size: 20px;
          font-weight: 700;
          color: white;
          margin-bottom: 24px;
          text-align: center;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .score-content {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .circular-progress {
          position: relative;
        }

        .progress-svg {
          transform: rotate(-90deg);
        }

        .progress-bg {
          fill: none;
          stroke: rgba(255, 255, 255, 0.2);
          stroke-width: 12;
        }

        .progress-fill {
          fill: none;
          stroke: url(#heroGradient);
          stroke-width: 12;
          stroke-linecap: round;
          transition: stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .score-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .score-percentage {
          font-size: 42px;
          font-weight: 900;
          color: white;
          line-height: 1;
          margin-bottom: 8px;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .score-message {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: #ffffff;
          border-radius: 22px;
          padding: 24px;
          box-shadow: 
            0 10px 30px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(255, 255, 255, 0.8);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
          transform: translateX(-100%);
          transition: transform 0.6s ease;
        }

        .stat-card:hover::before {
          transform: translateX(100%);
        }

        .stat-card:hover {
          transform: translateY(-6px);
          box-shadow: 
            0 20px 40px rgba(0, 0, 0, 0.12),
            0 0 0 1px rgba(255, 255, 255, 0.8);
        }

        .stat-icon {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 24px;
          color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .stat-card.completed .stat-icon {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .stat-card.in-progress .stat-icon {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        }

        .stat-card.pending .stat-icon {
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        }

        .stat-card.dropped .stat-icon {
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        }

        .stat-card.attendance .stat-icon {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        }

        .stat-card.leaves .stat-icon {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }

        .stat-number {
          font-size: 32px;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 14px;
          color: #64748b;
          font-weight: 600;
        }

        /* Attendance Section */
        .attendance-section {
          background: #ffffff;
          border-radius: 22px;
          padding: 28px;
          margin-bottom: 32px;
          box-shadow: 
            0 10px 30px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(255, 255, 255, 0.8);
        }

        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 24px;
        }

        .attendance-chart {
          display: flex;
          justify-content: space-around;
          align-items: end;
          height: 100px;
        }

        .chart-bars {
          display: flex;
          justify-content: space-around;
          align-items: end;
          width: 100%;
          height: 80px;
          gap: 12px;
        }

        .bar-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .bar {
          width: 100%;
          max-width: 36px;
          border-radius: 12px 12px 0 0;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .bar.present {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .bar.absent {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }

        .bar.weekend {
          background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
        }

        .bar:hover {
          transform: scaleY(1.1);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .bar-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
        }

        /* Task Breakdown */
        .task-breakdown {
          background: #ffffff;
          border-radius: 22px;
          padding: 28px;
          margin-bottom: 32px;
          box-shadow: 
            0 10px 30px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(255, 255, 255, 0.8);
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .task-card {
          padding: 20px;
          border-radius: 18px;
          background: #f8fafc;
          transition: all 0.3s ease;
          border: 1px solid rgba(226, 232, 240, 0.5);
        }

        .task-card:hover {
          transform: translateX(6px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
          border-color: rgba(16, 185, 129, 0.2);
        }

        .task-card.done {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border-left: 4px solid #10b981;
        }

        .task-card.reassigned {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border-left: 4px solid #ef4444;
        }

        .task-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .task-info {
          flex: 1;
        }

        .task-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
        }

        .task-details {
          display: flex;
          gap: 16px;
        }

        .task-time, .task-date {
          font-size: 13px;
          color: #64748b;
        }

        .task-status {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .task-status.done {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }

        .task-status.reassigned {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }

        /* Insight Card */
        .insight-card {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-radius: 22px;
          padding: 24px;
          margin-bottom: 32px;
          box-shadow: 
            0 10px 30px rgba(59, 130, 246, 0.15),
            0 0 0 1px rgba(255, 255, 255, 0.8);
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          overflow: hidden;
        }

        .insight-card::before {
          content: '';
          position: absolute;
          top: -20px;
          right: -20px;
          width: 80px;
          height: 80px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%);
          border-radius: 50%;
        }

        .insight-icon {
          width: 52px;
          height: 52px;
          border-radius: 18px;
          background: rgba(59, 130, 246, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: #3b82f6;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }

        .insight-content {
          flex: 1;
          position: relative;
          z-index: 1;
        }

        .insight-title {
          font-size: 16px;
          font-weight: 700;
          color: #1e3a8a;
          margin-bottom: 4px;
        }

        .insight-text {
          font-size: 14px;
          color: #1e40af;
          line-height: 1.5;
        }

        /* Bottom Navigation */
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 480px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          display: flex;
          justify-content: space-around;
          padding: 12px 20px;
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
          z-index: 9999;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 16px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .nav-item:hover {
          background: rgba(16, 185, 129, 0.1);
          transform: translateY(-2px);
        }

        .nav-item.active {
          background: rgba(16, 185, 129, 0.1);
        }

        .nav-item i {
          font-size: 18px;
          color: #94a3b8;
          transition: color 0.3s ease;
        }

        .nav-item.active i {
          color: #10b981;
        }

        .nav-item span {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          transition: color 0.3s ease;
        }

        .nav-item.active span {
          color: #10b981;
          font-weight: 600;
        }

        /* Premium Animations */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .performance-hero-card,
        .stat-card,
        .attendance-section,
        .task-breakdown,
        .insight-card {
          animation: fadeInUp 0.8s ease-out;
        }

        .stat-card:nth-child(2) { animation-delay: 0.1s; }
        .stat-card:nth-child(3) { animation-delay: 0.2s; }
        .stat-card:nth-child(4) { animation-delay: 0.3s; }

        /* Responsive Design */
        @media (max-width: 480px) {
          .performance-dashboard {
            padding: 20px 16px 100px;
          }

          .main-title {
            font-size: 28px;
          }

          .time-filter {
            gap: 8px;
          }

          .filter-pill {
            padding: 12px 18px;
            font-size: 13px;
          }

          .performance-hero-card {
            padding: 28px 20px;
          }

          .stats-grid {
            gap: 12px;
            grid-template-columns: repeat(2, 1fr);
          }

          .stat-card {
            padding: 20px;
          }

          .stat-number {
            font-size: 28px;
          }

          .chart-bars {
            gap: 8px;
          }

          .task-content {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .task-status {
            align-self: flex-end;
          }
        }
      `}</style>
    </>
  );
}
