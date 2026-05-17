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
      <div className="welcome-glow glow-left"></div>
      <div className="welcome-glow glow-right"></div>

      <div className="welcome-shell fade-in">
        <div className="welcome-badge">Techiohisab Office</div>

        <h1 className="welcome-title">Your Smart Employee Workspace</h1>

        <div className="welcome-illustration slide-up" aria-hidden="true">
          <div className="illustration-panel">
            <div className="illustration-header">
              <span className="illustration-dot dot-blue"></span>
              <span className="illustration-dot dot-cyan"></span>
              <span className="illustration-dot dot-soft"></span>
            </div>

            <div className="illustration-screen">
              <div className="screen-badge">Connected team</div>

              <div className="screen-grid">
                <div className="screen-card tall">
                  <span>Tasks</span>
                  <strong>Live</strong>
                </div>
                <div className="screen-card">
                  <span>Attendance</span>
                  <strong>Ready</strong>
                </div>
                <div className="screen-card accent">
                  <span>Workflow</span>
                  <strong>Secure</strong>
                </div>
              </div>

              <div className="screen-wave">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>

        <button className="welcome-button" onClick={goToLogin}>
          Get Started
        </button>

        <div className="welcome-security-pill">Secure company environment</div>
      </div>
    </div>
  );
}
