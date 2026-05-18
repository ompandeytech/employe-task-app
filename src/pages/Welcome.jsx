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
        <div className="welcome-brand">
  <div className="brand-icon">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 2L4 5V11C4 16 7.5 20.5 12 22C16.5 20.5 20 16 20 11V5L12 2Z"
        fill="#00bc1f"
      />
      <path
        d="M10.2 12.8L8.2 10.8L7 12L10.2 15.2L17 8.4L15.8 7.2L10.2 12.8Z"
        fill="white"
      />
    </svg>
  </div>

  <span>Techiohisab Office</span>
</div>

       <h1 className="welcome-title">
  Your Smart <span>Employee</span>
  <br />
  Workspace
</h1>

       <div className="welcome-illustration slide-up">
  <img
    src="/welcome.png"
    alt="Welcome"
    className="welcome-image"
  />
</div>

        <button className="welcome-button" onClick={goToLogin}>
          Get Started
        </button>

        <div className="welcome-security-pill"><div className="brand-icon">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 2L4 5V11C4 16 7.5 20.5 12 22C16.5 20.5 20 16 20 11V5L12 2Z"
        fill="#280493"
      />
      <path
        d="M10.2 12.8L8.2 10.8L7 12L10.2 15.2L17 8.4L15.8 7.2L10.2 12.8Z"
        fill="white"
      />
    </svg>
  </div>Secure company environment</div>
      </div>
    </div>
  );
}
