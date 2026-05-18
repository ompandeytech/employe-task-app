import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const API_BASE = "https://techiohisab.com/api";

export default function Login({ onSuccess }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loginMode, setLoginMode] = useState("password");
  const [quickSessionToken, setQuickSessionToken] = useState(
    localStorage.getItem("quickSessionToken") || ""
  );
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const pinInputRef = useRef(null);

  useEffect(() => {
    const storedQuickSession = localStorage.getItem("quickSessionToken");

    if (storedQuickSession) {
      setQuickSessionToken(storedQuickSession);
      setLoginMode("pin");
    }
  }, []);

  useEffect(() => {
    if (loginMode === "pin") {
      pinInputRef.current?.focus();
    }
  }, [loginMode]);

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
      const res = await axios.post(
        fullUrl,
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
      if (data.quickSessionToken) {
        localStorage.setItem("quickSessionToken", data.quickSessionToken);
      }
      localStorage.setItem("permissions", JSON.stringify(rawUser.app_permissions || []));
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

  const handlePinLogin = async () => {
    if (!pin || pin.length !== 4) {
      alert("Enter valid 4 digit PIN");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE}/auth/verify-pin`, {
        pin,
        quickSessionToken,
      });

      const data = res.data;

      localStorage.setItem("user", JSON.stringify(data.user));
      if (data.quickSessionToken) {
        localStorage.setItem("quickSessionToken", data.quickSessionToken);
      }
      onSuccess?.();
      navigate("/");
    } catch {
      alert("Invalid PIN");
    } finally {
      setLoading(false);
    }
  };

  const focusPinInput = () => {
    pinInputRef.current?.focus();
  };

  const updatePinValue = (nextValue) => {
    setPin(nextValue.replace(/\D/g, "").slice(0, 4));
  };

  const handlePinInputChange = (e) => {
    updatePinValue(e.target.value);
  };

  const handlePinKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handlePinLogin();
    }
  };

  const appendPinDigit = (digit) => {
    if (loading || pin.length >= 4) return;
    setPin((current) => `${current}${digit}`.slice(0, 4));
    focusPinInput();
  };

  const removePinDigit = () => {
    if (loading) return;
    setPin((current) => current.slice(0, -1));
    focusPinInput();
  };

  const pinDigits = Array.from({ length: 4 }, (_, index) => pin[index] || "");
  const activePinIndex = pin.length >= 4 ? 3 : pin.length;

  return (
    <div className="login-page">
      <div className="login-ambient login-ambient-left" aria-hidden="true"></div>
      <div className="login-ambient login-ambient-right" aria-hidden="true"></div>

      <div className="login-card">
        <div className="login-brand-row" aria-label="Techiohisab Office">
          <div className="login-brand-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L5 5V10.5C5 15 8.1 19.1 12 20.5C15.9 19.1 19 15 19 10.5V5L12 2Z"
                fill="url(#brandShieldGradient)"
              />
              <path
                d="M10.1 12.7L8.5 11.1L7.4 12.2L10.1 14.9L16.7 8.3L15.6 7.2L10.1 12.7Z"
                fill="white"
              />
              <defs>
                <linearGradient
                  id="brandShieldGradient"
                  x1="5"
                  y1="2"
                  x2="19"
                  y2="20.5"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#0058BC" />
                  <stop offset="1" stopColor="#7B3FE4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="login-brand-text">Techiohisab Office</span>
        </div>

        <div className="login-header">
          <h1>Welcome Back</h1>
        </div>

        {quickSessionToken ? (
          <div className="login-mode-switch" role="tablist" aria-label="Login mode">
            <button
              type="button"
              className={`login-mode-btn ${loginMode === "password" ? "active" : ""}`}
              onClick={() => setLoginMode("password")}
              aria-pressed={loginMode === "password"}
            >
              Password
            </button>
            <button
              type="button"
              className={`login-mode-btn ${loginMode === "pin" ? "active" : ""}`}
              onClick={() => setLoginMode("pin")}
              aria-pressed={loginMode === "pin"}
            >
              PIN
            </button>
          </div>
        ) : null}

        {loginMode === "password" ? (
          <div className="login-section">
            <div className="login-field">
              <label htmlFor="login-email">Email</label>
              <div className="login-input-shell">
                <i className="fa-regular fa-envelope login-input-icon" aria-hidden="true"></i>
                <input
                  id="login-email"
                  className="login-input"
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
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-input-shell">
                <i className="fa-solid fa-lock login-input-icon" aria-hidden="true"></i>
                <input
                  id="login-password"
                  className="login-input"
                  type={showPassword ? "text" : "password"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="current-password"
                  spellCheck={false}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="login-visibility-btn"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <i
                    className={`fa-regular ${showPassword ? "fa-eye-slash" : "fa-eye"}`}
                    aria-hidden="true"
                  ></i>
                </button>
              </div>
            </div>

            <div className="login-meta-row">
              <label className="login-checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              
            </div>

            <button className="login-primary-btn" onClick={handleLogin} disabled={loading}>
              {loading ? "Signing in..." : "Login to workspace"}
            </button>

           

          </div>
        ) : (
          <div className="login-pin-panel">
            <div className="login-pin-hero" aria-hidden="true">
              <div className="login-pin-hero-icon">
                <svg width="65" height="65" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L4.75 5.1V10.75C4.75 15.55 7.85 19.63 12 21C16.15 19.63 19.25 15.55 19.25 10.75V5.1L12 2Z"
                    fill="url(#pinShieldGradient)"
                  />
                  <path
  d="M12 10.2C10.9 10.2 10 9.3 10 8.2V7.8C10 6.7 10.9 5.8 12 5.8C13.1 5.8 14 6.7 14 7.8V8.2C14 9.3 13.1 10.2 12 10.2ZM15.2 11.4H8.8C8.2 11.4 7.8 11.9 7.8 12.4V15.4C7.8 16 8.2 16.4 8.8 16.4H15.2C15.8 16.4 16.2 16 16.2 15.4V12.4C16.2 11.9 15.8 11.4 15.2 11.4Z"
  fill="white"
/>
                  <defs>
                    <linearGradient
                      id="pinShieldGradient"
                      x1="4.75"
                      y1="2"
                      x2="19.25"
                      y2="21"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#0058BC" />
                      <stop offset="1" stopColor="#7B3FE4" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="login-pin-lock-badge">
                <i className="fa-solid fa-lock"></i>
              </div>
            </div>

            <div className="login-pin-header">
              <h2>Security Verification</h2>
              <p>Enter your Master PIN to continue</p>
            </div>

            <div className="login-pin-entry" onClick={focusPinInput}>
              <label className="login-pin-sr-only" htmlFor="login-pin">
                Master PIN
              </label>
              <input
                id="login-pin"
                ref={pinInputRef}
                className="login-pin-hidden-input"
                type="password"
                inputMode="numeric"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={4}
                value={pin}
                onChange={handlePinInputChange}
                onKeyDown={handlePinKeyDown}
                aria-label="Master PIN"
              />

              <div className="login-pin-boxes" role="group" aria-label="PIN entry boxes">
                {pinDigits.map((digit, index) => (
                  <div
                    key={index}
                    className={`login-pin-box ${
                      index === activePinIndex && !loading ? "active" : ""
                    } ${digit ? "filled" : ""}`}
                    aria-hidden="true"
                  >
                    <span className="login-pin-dot">{digit ? "•" : ""}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="login-pin-keypad" aria-label="PIN keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  className="login-pin-key"
                  onClick={() => appendPinDigit(String(digit))}
                  disabled={loading}
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                className="login-pin-key login-pin-key-icon"
                onClick={focusPinInput}
                disabled={loading}
                aria-label="Biometric verification not available"
                title="Biometric verification is not enabled in the current flow."
              >
                <i className="fa-solid fa-fingerprint" aria-hidden="true"></i>
              </button>

              <button
                type="button"
                className="login-pin-key"
                onClick={() => appendPinDigit("0")}
                disabled={loading}
              >
                0
              </button>

              <button
                type="button"
                className="login-pin-key login-pin-key-icon"
                onClick={removePinDigit}
                disabled={loading || pin.length === 0}
                aria-label="Delete last digit"
              >
                <i className="fa-solid fa-delete-left" aria-hidden="true"></i>
              </button>
            </div>

            <button
              className="login-primary-btn login-primary-btn-pin"
              onClick={handlePinLogin}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify"}
            </button>

            <div className="login-security-pill">
              <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
              <span>Protected Company Access</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
