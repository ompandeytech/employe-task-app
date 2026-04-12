import { useNavigate } from "react-router-dom";
import "./Welcome.css";

export default function Welcome() {
  const navigate = useNavigate();

  const goToLogin = () => {
    sessionStorage.setItem("seenWelcome", "true");
    navigate("/login");
  };

  return (
    <div className="welcome-page">

      {/* Background dots */}
      <div className="glow-dot dot-1"></div>
      <div className="glow-dot dot-2"></div>
      <div className="glow-dot dot-3"></div>
      <div className="glow-dot dot-4"></div>

      <div className="center-box fade-in">
        <div className="floating-icon"></div>

        <h1 className="app-title">Techio Task</h1>
        <p className="app-subtitle">
          Smart task management for teams.
        </p>

        <button className="btn-primary full-btn" onClick={goToLogin}>
          Go to Login
        </button>
      </div>

    </div>
  );
}
