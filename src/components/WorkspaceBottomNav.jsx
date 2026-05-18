import { useLocation, useNavigate } from "react-router-dom";
import "../pages/dasboard.css";

const navItems = [
  { path: "/", icon: "fa-home", label: "Home" },
  { path: "/tasks", icon: "fa-tasks", label: "Tasks" },
  { path: "/report", icon: "fa-chart-line", label: "Report" },
  { path: "/profile", icon: "fa-user", label: "Profile" },
];

export default function WorkspaceBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="dashboard-bottom-nav" aria-label="Primary">
      <div className="dashboard-bottom-nav-shell">
        {navItems.map((item) => (
          <button
            key={item.path}
            type="button"
            className={`dashboard-nav-item ${
              location.pathname === item.path ? "active" : ""
            }`}
            onClick={() => navigate(item.path)}
          >
            <i className={`fas ${item.icon}`}></i>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
