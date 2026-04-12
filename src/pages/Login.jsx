import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_BASE = "https://techiohisab.com/api";

export default function Login({ onSuccess }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password;

    if (!normalizedEmail || !normalizedPassword) {
      alert("Enter email and password");
      return;
    }

    try {
      const fullUrl = `${API_BASE}/auth/login`;
      console.log("API CALLING:", fullUrl);
      console.log("LOGIN API:", fullUrl);
      setLoading(true);
      const res = await axios.post(fullUrl,
        {
          email: normalizedEmail,
          password: normalizedPassword,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const data = res.data;

      const rawUser = data.user || data;
      const userForApp = {
        id:
          rawUser.id ??
          rawUser.user_id ??
          rawUser.userId ??
          rawUser.employee_id ??
          rawUser.employeeId ??
          "",
        name: rawUser.name ?? rawUser.fullName ?? "",
        email: rawUser.email ?? "",
        role: rawUser.role ?? "",
        token: data.token ?? rawUser.token ?? "",
      };

      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("user", JSON.stringify(userForApp));
      window.dispatchEvent(new Event("tasks:refresh"));
      onSuccess?.();
      navigate("/");
    } catch (err) {
      const status = err?.response?.status;
      const serverMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.msg;

      console.error("Login request failed", {
        url: err?.config?.url,
        baseURL: err?.config?.baseURL,
        method: err?.config?.method,
        status,
        code: err?.code,
        message: err?.message,
        response: err?.response?.data,
      });

      let errorMessage = "Login failed. Please try again.";

      if (!err?.response) {
        errorMessage =
          "Network issue: server se connect nahi ho pa raha. Internet aur API HTTPS access check karein.";
      } else if (status === 401 || status === 403) {
        errorMessage = serverMessage
          ? String(serverMessage)
          : "Invalid email or password";
      } else if (status >= 500) {
        errorMessage = "Server error. Thodi der baad try karein.";
      } else if (serverMessage) {
        errorMessage = String(serverMessage);
      } else {
        errorMessage = `Login failed (status ${status})`;
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-circle">
  <i className="fa-solid fa-user-tie"></i>
</div>

          <h2>Welcome Back</h2>
          <p>Sign in to your employee dashboard</p>
        </div>

        <div className="input-group">
          <label>Email</label>
          <input
            type="email"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="current-password"
            spellCheck={false}
            placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="primary-btn" onClick={handleLogin} disabled={loading}>
          {loading ? "Signing in..." : "Login to Dashboard"}
        </button>

        <p className="footer-text">Secure login â€¢ Powered by your system</p>
      </div>

      <style>{`
        body {
          margin: 0;
          font-family: 'Inter', Arial, sans-serif;
          background: linear-gradient(135deg, #4f46e5, #3b82f6, #06b6d4);
        }

        .login-wrapper {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .login-card {
          width: 360px;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 28px 26px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
          text-align: center;
          animation: fadeIn 0.6s ease-in-out;
        }
 .logo-circle i {
  font-size: 32px;
}

        @keyframes fadeIn {
          from { transform: translateY(15px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .logo-circle {
          width: 70px;
          height: 70px;
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          color: white;
          font-size: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          margin: 0 auto 10px;
          box-shadow: 0 8px 15px rgba(79,70,229,0.3);
        }

        .login-header h2 {
          margin: 8px 0 4px;
          color: #111827;
        }

        .login-header p {
          color: #6b7280;
          font-size: 14px;
          margin-bottom: 18px;
        }

        .input-group {
          text-align: left;
          margin-bottom: 12px;
        }

        .input-group label {
          font-size: 13px;
          color: #374151;
          margin-bottom: 4px;
          display: block;
        }

        .input-group input {
          width: 100%;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          font-size: 14px;
          outline: none;
        }

        .input-group input:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 2px rgba(79,70,229,0.15);
        }

        .primary-btn {
          width: 100%;
          margin-top: 10px;
          padding: 11px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          color: white;
          font-size: 15px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .primary-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(79,70,229,0.25);
        }

        .primary-btn:disabled {
          background: #9ca3af;
        }

        .footer-text {
          font-size: 12px;
          color: #9ca3af;
          margin-top: 12px;
        }

        @media (max-width: 400px) {
          .login-card {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

