import { useCallback, useEffect, useMemo, useState } from "react";
import { useTaskContext } from "../context/taskContextStore";
import axios from "axios";
import { API_BASE, getAuthHeaders } from "../utils/apiConfig";
import RefreshWrapper from "../components/RefreshWrapper";
import WorkspaceBottomNav from "../components/WorkspaceBottomNav";
import "./ReportPage.css";

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

  const performanceMetrics = useMemo(() => {
    const { tasks: filteredTasks, attendance: filteredAttendance } = filteredData;

    const completedTasks = filteredTasks.filter((task) => task.status === "done");
    const inProgressTasks = filteredTasks.filter((task) => task.status === "in_progress");
    const pendingTasks = filteredTasks.filter((task) => task.status === "pending");
    const droppedTasks = filteredTasks.filter((task) => task.status === "reassigned");

    const workingDays = filteredAttendance.filter((attendance) => !attendance.isWeekend);
    const presentDays = workingDays.filter((attendance) => attendance.present);
    const leaveDays = workingDays.length - presentDays.length;

    const totalTasks = filteredTasks.length || 1;
    const workingDaysCount = workingDays.length || 1;

    const completedScore = (completedTasks.length / totalTasks) * 40;
    const inProgressScore = (inProgressTasks.length / totalTasks) * 10;
    const pendingScore = (pendingTasks.length / totalTasks) * -20;
    const reassignedScore = (droppedTasks.length / totalTasks) * -20;
    const attendanceScore = (presentDays.length / workingDaysCount) * 10;

    const performanceScore = Math.min(
      100,
      Math.max(0, Math.round(completedScore + inProgressScore + pendingScore + reassignedScore + attendanceScore))
    );

    return {
      performanceScore,
      completedTasks: completedTasks.length,
      inProgressTasks: inProgressTasks.length,
      pendingTasks: pendingTasks.length,
      droppedTasks: droppedTasks.length,
      presentDays: presentDays.length,
      leaveDays,
    };
  }, [filteredData]);

  return (
    <>
      <RefreshWrapper onRefresh={handleReportRefresh}>
        <div className="performance-dashboard report-container">
         

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

          <div className="performance-hero-card">
            <h2 className="hero-title">Performance Score</h2>
            <div className="score-content">
              <div className="circular-progress">
                <svg width="180" height="180" className="progress-svg">
                  <defs>
                    <linearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#2563eb" />
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
                      strokeDashoffset: 471.24 - (471.24 * performanceMetrics.performanceScore) / 100,
                    }}
                  />
                </svg>
                <div className="score-center">
                  <div className="score-percentage">{performanceMetrics.performanceScore}%</div>
                  <div className="score-message">Great performance, keep it up!</div>
                </div>
              </div>
              <div className="hero-insight-panel">
                <p className="hero-insight-label">Performance Insight</p>
                <h3 className="hero-insight-title">A strong snapshot of your recent work.</h3>
                <p className="hero-insight-text">
                  Your score blends task completion, progress momentum, and attendance consistency into one clean view.
                </p>
                <span className="hero-insight-trend">+12% from last week</span>
              </div>
            </div>
          </div>

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

          <div className="attendance-section">
            <h3 className="section-title">Attendance (Last 7 Days)</h3>
            <div className="attendance-chart">
              <div className="chart-bars">
                {filteredData.attendance.slice(-7).map((day, index) => (
                  <div key={index} className="bar-wrapper">
                    <div
                      className={`bar ${day.status}`}
                      style={{ height: day.present ? "60px" : "25px" }}
                    ></div>
                    <div className="bar-label">{day.day}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </RefreshWrapper>

      <WorkspaceBottomNav />
    </>
  );
}
