import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import client from "../api/client";

const FIXED_PAGES = ["attendance", "tasks", "report", "profile"];
const DYNAMIC_PAGES = ["sales", "manufacture", "rto"];

export default function Sidebar({ openMenu, setOpenMenu }) {
  const navigate = useNavigate();
  const [closing, setClosing] = useState(false);
  const [permissions, setPermissions] = useState(
  JSON.parse(localStorage.getItem("permissions") || "[]")
);

useEffect(() => {
  const fetchPermissions = async () => {
    try {
      const { data } = await client.get("/auth/me");

      const latestPermissions = data.app_permissions || [];

      localStorage.setItem(
        "permissions",
        JSON.stringify(latestPermissions)
      );

      setPermissions(latestPermissions);
    } catch (err) {
      console.error("Permission refresh failed", err);
    }
  };

  fetchPermissions();

  const interval = setInterval(fetchPermissions, 5000);

  return () => clearInterval(interval);
}, []);

  function hasAccess(page) {
    if (FIXED_PAGES.includes(page)) return true;
    if (!DYNAMIC_PAGES.includes(page)) return true;
    if (!permissions || permissions.length === 0) return true;
    return permissions.includes(page);
  }

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setOpenMenu(null);
      setClosing(false);
    }, 300); // animation duration
  };

  return (
    <>
      {openMenu && (
        <div className="slide-overlay" onClick={handleClose}>
          <div
            className={`slide-panel ${closing ? "slide-out" : "slide-in"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="slide-header">
              <h3>Menu</h3>
              <button className="close-btn" onClick={handleClose}>
                ✖
              </button>
            </div>

            <div className="slide-body">
              <div className="menu-item" onClick={() => navigate("/attendance")}>
                <i className="fas fa-calendar-check"></i>
                <span>Attendance</span>
              </div>

              <div className="menu-item" onClick={() => navigate("/tasks")}>
                <i className="fas fa-tasks"></i>
                <span>My Task</span>
              </div>

    {JSON.parse(localStorage.getItem("user") || "{}")?.role === "TL" && (
  <div className="menu-item" onClick={() => navigate("/task-assign")}>
    <i className="fas fa-user-check"></i>
    <span>Task Assign</span>
  </div>
)}
              <div className="menu-item" onClick={() => navigate("/report")}>
                <i className="fas fa-chart-bar"></i>
                <span>My Report</span>
              </div>

              <div className="menu-item" onClick={() => navigate("/salary")}>
                <i className="fas fa-wallet"></i>
                <span>Salary</span>
              </div>

              {hasAccess("sales") && (
                <div className="menu-item" onClick={() => navigate("/sales")}>
                  <i className="fas fa-box"></i>
                  <span>Sales</span>
                </div>
              )}

              {hasAccess("manufacture") && (
                <div className="menu-item" onClick={() => navigate("/manufacture")}>
                  <i className="fas fa-industry"></i>
                  <span>Manufacture</span>
                </div>
              )}

              {hasAccess("rto") && (
                <div className="menu-item" onClick={() => navigate("/rto")}>
                  <i className="fas fa-sync-alt"></i>
                  <span>RTO</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
