import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE, getAuthHeaders } from "../utils/apiConfig";
import RefreshWrapper from "../components/RefreshWrapper";
import "./Attendance.css";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const getUserId = (user) =>
  user?.id ?? user?.user_id ?? user?.userId ?? user?.employee_id ?? user?.employeeId ?? null;

const toDateString = (date) => date.toISOString().slice(0, 10);
const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleDateString("en-IN");
};

const formatTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  const [hours, minutes] = value.split(":");
  const h = Number(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const formattedHours = h % 12 || 12;

  return `${formattedHours}:${minutes} ${ampm}`;
};

const getLunchDurationMinutes = (entry) => {
  if (!entry?.lunch_in || !entry?.lunch_out) return null;
  const start = new Date(entry.lunch_in);
  const end = new Date(entry.lunch_out);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffMinutes = (end.getTime() - start.getTime()) / 60000;
  if (!Number.isFinite(diffMinutes) || diffMinutes < 0) return null;
  return Math.round(diffMinutes);
};

const formatLiveDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const paddedSeconds = String(secs).padStart(2, "0");
  return `${minutes}m ${paddedSeconds}s`;
};

const getCurrentTime = () => {
  return new Date().toISOString();
};

const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const getOfficeLocationStatus = (coords, locationConfig) => {
  if (!coords || !locationConfig) return null;
  const latA = Number(coords.lat);
  const lngA = Number(coords.lng);
  const latB = Number(locationConfig.latitude);
  const lngB = Number(locationConfig.longitude);
  const radiusMeters = Number(locationConfig.radius);

  if (
    Number.isNaN(latA) ||
    Number.isNaN(lngA) ||
    Number.isNaN(latB) ||
    Number.isNaN(lngB) ||
    Number.isNaN(radiusMeters)
  ) {
    return null;
  }

  const distance = calculateDistanceMeters(latA, lngA, latB, lngB);
  return distance <= radiusMeters ? "inside" : "outside";
};

export default function Attendance() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = getUserId(user);
  const userName = user?.name || "Employee";

  const [time, setTime] = useState(new Date());
  const [lunchActive, setLunchActive] = useState(false);
  const [lunchStartTime, setLunchStartTime] = useState(null);
  const [lunchEndTime, setLunchEndTime] = useState(null);
  const [liveTimer, setLiveTimer] = useState(0);
  const [lunchSaving, setLunchSaving] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [history, setHistory] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [pendingPunchType, setPendingPunchType] = useState("");
  const [locationForPunch, setLocationForPunch] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [preparingPunch, setPreparingPunch] = useState(false);
  const [attendanceLocation, setAttendanceLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState("user");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [punchHint, setPunchHint] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const lunchTimerRef = useRef(null);
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      const video = videoRef.current;
      video.srcObject = cameraStream;
      setTimeout(() => {
        video.play().catch(() => {});
      }, 200);
    }
  }, [cameraStream]);

  const loadAttendanceLocation = useCallback(
    async ({ throwOnError = false } = {}) => {
      try {
        const res = await axios.get(`${API_BASE}/attendance/location`, {
          headers: getAuthHeaders(),
          timeout: 10000,
        });
        const location = res.data || null;
        setAttendanceLocation(location);
        return location;
      } catch (err) {
        console.error("Failed to load attendance location:", err);
        setAttendanceLocation(null);
        if (throwOnError) {
          throw err;
        }
        return null;
      }
    },
    []
  );

  useEffect(() => {
    loadAttendanceLocation();
  }, [loadAttendanceLocation]);

  const loadTodayAttendance = useCallback(async () => {
    if (!userId) {
      console.warn("No userId available for today's attendance");
      setTodayAttendance(null);
      return null;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/attendance/today/${userId}`, {
        headers: getAuthHeaders(),
        timeout: 10000,
      });
      const record = res.data || null;
      setTodayAttendance(record);
      return record;
    } catch (err) {
      console.error("Failed to load today's attendance:", err);
      const message =
        err?.code === "ECONNABORTED"
          ? "Unable to load attendance. Check internet connection."
          : err.response?.data?.error || err.message || "Unknown error";
      setError(`Failed to load today's attendance: ${message}`);
      setTodayAttendance(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadEmployeeHistory = useCallback(
    async ({ showLoading = true } = {}) => {
      if (!userId) {
        console.warn("No userId available for attendance history");
        if (showLoading) {
          setLoading(false);
        }
        setHistory([]);
        return [];
      }

      if (showLoading) {
        setLoading(true);
      }

      try {
        const res = await axios.get(`${API_BASE}/attendance/employee/${userId}`, {
          headers: getAuthHeaders(),
          timeout: 10000,
        });
        const rows = Array.isArray(res.data) ? res.data : [];
        setHistory(rows);
        setError("");
        return rows;
      } catch (err) {
        console.error("Failed to load attendance history:", err);
        const message =
          err?.code === "ECONNABORTED"
            ? "Unable to load attendance. Check internet connection."
            : err.response?.data?.error || err.message || "Unknown error";
        setError(`Failed to load attendance history: ${message}`);
        setHistory([]);
        return [];
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    loadTodayAttendance();
    loadEmployeeHistory();
  }, [userId, loadTodayAttendance, loadEmployeeHistory]);

  const refreshAttendanceData = useCallback(async () => {
    await Promise.all([
      loadTodayAttendance(),
      loadEmployeeHistory({ showLoading: false }),
    ]);
  }, [loadTodayAttendance, loadEmployeeHistory]);

  useEffect(() => {
    if (!todayAttendance) {
      setLunchActive(false);
      setLunchStartTime(null);
      setLunchEndTime(null);
      return;
    }
    const start = todayAttendance.lunch_in || null;
    const end = todayAttendance.lunch_out || null;
    setLunchStartTime(start);
    setLunchEndTime(end);
    setLunchActive(Boolean(start && !end));
  }, [todayAttendance]);

  useEffect(() => {
    if (lunchActive && lunchStartTime) {
      const startMs = new Date(lunchStartTime).getTime();
      const updateTimer = () => {
        const diffSeconds = Math.floor((Date.now() - startMs) / 1000);
        setLiveTimer(diffSeconds >= 0 ? diffSeconds : 0);
      };
      updateTimer();
      if (lunchTimerRef.current) {
        clearInterval(lunchTimerRef.current);
      }
      lunchTimerRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (lunchTimerRef.current) {
          clearInterval(lunchTimerRef.current);
          lunchTimerRef.current = null;
        }
      };
    }
    setLiveTimer(0);
    return undefined;
  }, [lunchActive, lunchStartTime]);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  const todayIso = useMemo(() => toDateString(new Date()), [time]);
  const hasCheckedIn = Boolean(todayAttendance?.in_time);
  const hasCheckedOut = Boolean(todayAttendance?.out_time);
  const checkInDisabled = hasCheckedIn;
  const checkOutDisabled = !hasCheckedIn || hasCheckedOut;

  const saveAttendance = async (payload) => {
    console.log("Saving attendance with payload:", payload);
    setSaving(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await axios.post(`${API_BASE}/attendance/upsert`, payload, {
        headers: getAuthHeaders(),
      });
      console.log("Attendance saved successfully:", response.data);
      await loadTodayAttendance();
      await loadEmployeeHistory({ showLoading: false });
      setStatusMessage("Attendance record updated.");
      return response.data;
    } catch (err) {
      console.error("Failed to save attendance:", err);
      const errorMessage = err.response?.data?.error || err.message || "Unknown error";
      setError(`Failed to save attendance: ${errorMessage}`);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const getLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not available on this device."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
          });
        },
        (error) => {
          let message = error.message || "Unable to fetch location.";
          if (error.code === error.PERMISSION_DENIED) {
            message = "Please enable location permission from app settings.";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = "Unable to determine your location right now.";
          } else if (error.code === error.TIMEOUT) {
            message = "Location request timed out. Please try again.";
          }
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });

  const stopCameraTracks = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  const cleanupCamera = () => {
    stopCameraTracks();
    setModalOpen(false);
    setPendingPunchType("");
    setLocationForPunch(null);
    setLocationStatus(null);
    setCameraError("");
    setCameraFacingMode("user");
    setPunchHint("");
  };

  useEffect(() => {
    if (!modalOpen && cameraStream) {
      stopCameraTracks();
    }
  }, [modalOpen, cameraStream, stopCameraTracks]);

  const startCameraStream = async (mode = "user") => {
    console.log("Camera start");
    if (!navigator.mediaDevices?.getUserMedia) {
      const unsupportedMessage =
        "Camera not supported on this device. Please use a modern browser.";
      setCameraStream(null);
      setCameraError(unsupportedMessage);
      console.log("Camera failed", unsupportedMessage);
      return null;
    }
    setCameraLoading(true);
    stopCameraTracks();

    const permissionDeniedNames = ["NotAllowedError", "PermissionDeniedError"];
    const handleCameraFailure = (error) => {
      const permissionDenied = permissionDeniedNames.includes(error?.name);
      const message = permissionDenied
        ? error?.message || "Camera permission denied. Please allow camera access to continue."
        : error?.message || "Unable to access the camera. Please try again.";
      setCameraStream(null);
      setCameraError(message);
      console.log("Camera failed", message);
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
        },
      });
      setCameraStream(stream);
      setCameraError("");
      console.log("Camera success");
      return stream;
    } catch (primaryError) {
      if (permissionDeniedNames.includes(primaryError?.name)) {
        handleCameraFailure(primaryError);
        return null;
      }
      console.debug("Preferred camera not available, trying fallback", primaryError);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraStream(fallbackStream);
        setCameraError("");
        console.log("Camera success");
        return fallbackStream;
      } catch (fallbackError) {
        handleCameraFailure(fallbackError);
        return null;
      }
    } finally {
      setCameraLoading(false);
    }
  };

  const handleSwitchCamera = async () => {
    if (cameraLoading) return;
    const nextMode = cameraFacingMode === "user" ? "environment" : "user";
    setCameraError("");
    try {
      await startCameraStream(nextMode);
      setCameraFacingMode(nextMode);
    } catch (err) {
      const message = err?.message || "Unable to switch camera.";
      setCameraError(message);
    }
  };

  const handleCameraCancel = () => {
    cleanupCamera();
  };

  const sendLunchPunch = async (lunchType, lunchTime) => {
    if (!userId) {
      setError("User not logged in properly");
      return false;
    }
    setError("");
    setStatusMessage("");

    try {
      const payload = {
        employee_id: userId,
        employee_name: userName,
        type: lunchType,
        date: todayIso,
        ...(lunchType === "lunch_in" ? { lunch_in: lunchTime } : { lunch_out: lunchTime }),
      };
      await axios.post(`${API_BASE}/attendance/punch`, payload, {
        headers: getAuthHeaders(),
      });
      setStatusMessage("Lunch time recorded successfully.");
      await loadTodayAttendance();
      await loadEmployeeHistory({ showLoading: false });
      return true;
    } catch (err) {
      console.error(`Failed to record ${lunchType}:`, err);
      const message = err.response?.data?.error || err.message || "Unknown error";
      setError(`Failed to record lunch time: ${message}`);
      return false;
    }
  };

  const handleLunchToggle = async () => {
    if (lunchSaving) return;
    const type = lunchActive ? "lunch_out" : "lunch_in";
    const now = new Date();
    const iso = now.toISOString();
    const formattedTime = now.toTimeString().slice(0, 5);
    setLunchSaving(true);
    if (type === "lunch_in") {
      setLunchActive(true);
      setLunchStartTime(iso);
    }

    const success = await sendLunchPunch(type, formattedTime);
    if (success) {
      if (type === "lunch_out") {
        setLunchActive(false);
        setLunchEndTime(iso);
      } else {
        setLunchEndTime(null);
      }
    } else if (type === "lunch_in") {
      setLunchActive(false);
      setLunchStartTime(null);
    }
    setLunchSaving(false);
  };

  const sendPunchWithPhoto = async (type, coords, photo) => {
    if (!coords || !photo) return;
    setStatusMessage("");
    setError("");
    setSaving(true);
    try {
      console.log("Submitting punch type:", type);
      const currentTime = getCurrentTime();
      const payload = {
        employee_id: userId,
        employee_name: userName,
        type,
        date: todayIso,
        in_time: type === "checkin" ? currentTime : undefined,
        out_time: type === "checkout" ? currentTime : undefined,
        lunch_in: type === "lunch_in" ? currentTime : lunchStartTime,
        lunch_out: type === "lunch_out" ? currentTime : lunchEndTime,
        latitude: coords.lat,
        longitude: coords.lng,
        photo,
      };
      const response = await axios.post(`${API_BASE}/attendance/punch`, payload, {
        headers: getAuthHeaders(),
      });
      console.log("Punch response:", response.data);
      setStatusMessage("Punch recorded successfully.");
      const updatedAttendance = response.data?.attendance ?? response.data;
      if (updatedAttendance) {
        setTodayAttendance(updatedAttendance);
        console.log("Today attendance updated:", updatedAttendance);
        const updatedDate = updatedAttendance.date ? String(updatedAttendance.date).slice(0, 10) : null;
        setHistory((prev) => {
          if (!updatedDate) {
            return [updatedAttendance, ...prev];
          }
          const filtered = prev.filter(
            (record) => String(record?.date || "").slice(0, 10) !== updatedDate
          );
          return [updatedAttendance, ...filtered];
        });
        await loadTodayAttendance();
        await loadEmployeeHistory({ showLoading: false });
      }
      if (type === "lunch_in") {
        setLunchActive(true);
        setLunchStartTime(currentTime);
        setLunchEndTime(null);
      } else if (type === "lunch_out") {
        setLunchActive(false);
        setLunchEndTime(currentTime);
      }
    } catch (err) {
      console.error("Punch request failed:", err);
      const message = err.response?.data?.error || err.message || "Unknown error";
      const normalized = (message || "").toLowerCase();
      if (normalized.includes("office location")) {
        alert("You are not in office location");
        setError("You are not in office location.");
      } else {
        setError(`Failed to punch attendance: ${message}`);
      }
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  };

  const capturePhotoAndSubmit = async () => {
    if (!locationForPunch || !pendingPunchType) return;
    if (locationStatus !== "inside") {
      setError(
        locationStatus === "outside"
          ? "You are outside office location."
          : "Waiting for office location verification."
      );
      return;
    }
    console.log("Pending punch type:", pendingPunchType);
    const photo = capturePhoto();
    const type = pendingPunchType;
    console.log("Submitting punch type:", type);
    const coords = locationForPunch;
    if (!photo) {
      setError("Unable to capture the photo.");
      return;
    }
    cleanupCamera();
    try {
      await sendPunchWithPhoto(type, coords, photo);
    } catch (_error) {
      console.debug("Punch submission flow stopped after error handling", _error);
    }
  };

    const handleCheckPunch = async (type) => {
      console.log("Checkin clicked", type);
      if (!userId) {
        alert("User not logged in properly");
        return;
      }
      if (saving || preparingPunch) return;
      setError("");
      setStatusMessage("");
      setCameraError("");
      setLocationStatus(null);
      setLocationForPunch(null);
      setPendingPunchType("");
      setPunchHint("");
      setPreparingPunch(true);
      let slowNetworkTimer;
      try {
        slowNetworkTimer = setTimeout(() => {
          setPunchHint("Preparing camera and location. This may take a bit longer on slower networks.");
        }, 5000);

        const officeLocation =
          attendanceLocation || (await loadAttendanceLocation({ throwOnError: true }));
        if (!officeLocation) {
          throw new Error(
            "Office location configuration is not available. Please contact your administrator."
          );
        }

        console.log("Location fetch start");
        const coords = await getLocation();
        const status = getOfficeLocationStatus(coords, officeLocation);
        if (!status) {
          throw new Error(
            "Unable to verify office radius. Please try again once your location is stable."
          );
        }

        setLocationForPunch(coords);
        setLocationStatus(status);
        if (status === "outside") {
          setError("You are outside office location.");
        }
        setPendingPunchType(type);
        setModalOpen(true);

        setTimeout(async () => {
          const stream = await startCameraStream("user");
          if (stream) {
            setCameraFacingMode("user");
          }
        }, 300);

      } catch (err) {
        console.error("Failed to prepare punch:", err);
        const message =
          err?.message ||
          "Unable to prepare camera or location. Please check your network and permissions.";
        setCameraError(message);
        setError(message);
        cleanupCamera();
      } finally {
        if (slowNetworkTimer) {
          clearTimeout(slowNetworkTimer);
        }
        setPunchHint("");
        setPreparingPunch(false);
      }
    };

  useEffect(() => () => cleanupCamera(), []);

  const submitLeave = async () => {
    if (!userId || saving || !leaveReason.trim()) return;
    console.log("Submitting leave request", { userId, leaveReason });

    try {
      await saveAttendance({
        employee_id: userId,
        employee_name: userName,
        date: todayIso,
        in_time: null,
        out_time: null,
        lunch_in: null,
        lunch_out: null,
        status: "Absent",
        remarks: leaveReason.trim(),
      });
      setLeaveReason("");
      console.log("Leave request submitted successfully");
    } catch (error) {
      console.error("Leave submission failed:", error);
      setError("Failed to submit leave request. Please try again.");
    }
  };

  return (
    <RefreshWrapper onRefresh={refreshAttendanceData}>
      <div className="attendance-page">
      <header className="att-header">
        <button
          type="button"
          onClick={handleBack}
          style={{
            border: "1px solid #e2e8f0",
            background: "#fff",
            color: "#0f172a",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 10,
            cursor: "pointer",
          }}
        >
          Back
        </button>
        <h2>My Attendance</h2>
      </header>

      <div className="greeting">
        <h3>Good Morning, {userName} 👋</h3>
        <p>
          {formatDate(new Date())} • {time.toLocaleTimeString()}
        </p>
      </div>

      <div className="punch-wrapper">
        <button
          className="punch-btn"
          onClick={() => {
            console.log("Button clicked:", "checkin");
            handleCheckPunch("checkin");
          }}
          disabled={checkInDisabled}
        >
          Check In
        </button>
        <button
          className="punch-btn checkout"
          onClick={() => {
            console.log("Button clicked:", "checkout");
            handleCheckPunch("checkout");
          }}
          disabled={checkOutDisabled}
        >
          Check Out
        </button>
      </div>
      <div className="punch-feedback">
        {statusMessage && <p className="status success">{statusMessage}</p>}
        {error && <p className="status error">{error}</p>}
        {loading && !statusMessage && !error && (
          <p className="status info" aria-live="polite">
            Loading attendance data...
          </p>
        )}
        {punchHint && !statusMessage && !error && !loading && (
          <p className="status info">{punchHint}</p>
        )}
        <p className="location-readout">
          {locationForPunch
            ? `Current GPS: ${locationForPunch.lat.toFixed(6)}, ${locationForPunch.lng.toFixed(6)}`
            : "Current latitude and longitude will appear once you initiate a punch."}
        </p>
      </div>

      <div className="report-box lunch-tracker">
        <h3>Track Lunch</h3>
        <div className="lunch-action">
          <button
            type="button"
            className={`lunch-toggle-btn ${lunchActive ? "lunch-out" : "lunch-in"}`}
            onClick={handleLunchToggle}
            disabled={lunchSaving || saving || preparingPunch}
          >
            {lunchActive ? "Lunch Out" : "Lunch In"}
          </button>
        </div>
        {lunchActive && lunchStartTime && (
          <>
            <p className="lunch-status">Lunch started at {formatTime(lunchStartTime)}...</p>
            <p className="lunch-status timer">Running timer: {formatLiveDuration(liveTimer)}</p>
          </>
        )}
        {!lunchActive && lunchStartTime && lunchEndTime && (
          <p className="lunch-status secondary">
            Last session {formatTime(lunchStartTime)} - finished at {formatTime(lunchEndTime)}.
          </p>
        )}
      </div>

      <div className="history-section">
        <h3>Attendance History</h3>
        {history.length === 0 ? <p>No attendance records.</p> : null}
        {history.map((item) => {
          const durationMinutes = getLunchDurationMinutes(item);
          return (
            <div className="history-card" key={item.id}>
              <div className="history-top">
                <strong>{formatDate(item.date)}</strong>
                <span className={`badge ${String(item.status).toLowerCase()}`}>{item.status}</span>
              </div>

              <p>
                <b>Name:</b> {item.employee_name || userName}
              </p>

              {String(item.status).toLowerCase() === "present" ? (
                <>
                  <p>
                    <b>Check In:</b> {formatTime(item.in_time)}
                  </p>
                  <p>
                    <b>Check Out:</b> {formatTime(item.out_time)}
                  </p>
                  <p>
                    <b>Lunch In:</b> {formatTime(item.lunch_in)}
                  </p>
                  <p>
                    <b>Lunch Out:</b> {formatTime(item.lunch_out)}
                  </p>
                  <p>
                    <b>Lunch Duration:</b>{" "}
                    {durationMinutes !== null ? `${durationMinutes} min` : "-"}
                  </p>
                  <p>
                    <b>Remarks:</b> {item.remarks || "-"}
                  </p>
                </>
              ) : (
                <p>
                  <b>Leave Reason:</b> {item.remarks || "-"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="report-box">
        <h3>Apply Leave</h3>
        <textarea
          placeholder="Enter leave reason..."
          value={leaveReason}
          onChange={(e) => setLeaveReason(e.target.value)}
        />
        <button className="leave-btn" onClick={submitLeave} disabled={saving || !leaveReason.trim()}>
          {saving ? "Saving..." : "Submit Leave"}
        </button>
      </div>
      {modalOpen && (
        <div className="camera-modal">
          <div className="camera-dialog">
            <h3>Capture Attendance Photo</h3>
        {cameraError && <p className="camera-error">{cameraError}</p>}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`camera-video ${
                locationStatus === "inside"
                  ? "inside"
                  : locationStatus === "outside"
                  ? "outside"
                  : ""
              }`}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <p className="camera-hint">
              Location:{" "}
              {locationForPunch
                ? `${locationForPunch.lat.toFixed(6)}, ${locationForPunch.lng.toFixed(6)}`
                : "Waiting for GPS..."}
            </p>
            {locationStatus === "outside" && (
              <p className="camera-warning">You are outside office location</p>
            )}
            <div className="camera-actions">
            <button
              className="punch-btn"
              onClick={capturePhotoAndSubmit}
              disabled={saving || cameraLoading || locationStatus !== "inside"}
            >
              Capture & Submit
            </button>
              <button className="punch-btn secondary" onClick={handleCameraCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="camera-switch-btn"
                onClick={handleSwitchCamera}
                disabled={cameraLoading}
              >
                Switch to {cameraFacingMode === "user" ? "Back" : "Front"} Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </RefreshWrapper>
  );
}
