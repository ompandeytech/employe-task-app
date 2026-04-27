import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Sidebar({ openMenu, setOpenMenu }) {
  const navigate = useNavigate();
  const [closing, setClosing] = useState(false);

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

              <div className="menu-item" onClick={() => navigate("/report")}>
                <i className="fas fa-chart-bar"></i>
                <span>My Report</span>
              </div>

              <div className="menu-item" onClick={() => navigate("/salary")}>
                <i className="fas fa-wallet"></i>
                <span>Salary</span>
              </div>

              <div className="menu-item" onClick={() => navigate("/sales")}>
                <i className="fas fa-box"></i>
                <span>Sales</span>
              </div>

              <div className="menu-item" onClick={() => navigate("/manufacture")}>
                <i className="fas fa-industry"></i>
                <span>Manufacture</span>
              </div>

              <div className="menu-item" onClick={() => navigate("/rto")}>
                <i className="fas fa-sync-alt"></i>
                <span>RTO</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
