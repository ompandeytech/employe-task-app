import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { TaskProvider } from "./context/TaskContext";
import { NotificationProvider } from "./context/NotificationContext";

import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Report from "./pages/Report";
import Profile from "./pages/Profile";
import Attendance from "./pages/Attendance";
import Salary from "./pages/Salary";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import DoneTasks from "./pages/DoneTasks";
import InProgressTasks from "./pages/InProgressTasks";
import PendingTasks from "./pages/PendingTasks";
import ReassignedTasks from "./pages/ReassignedTasks";

import ProtectedRoute from "./components/ProtectedRoute";

import Sidebar from "./components/Sidebar";

function BackButtonHandler({ enabled }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathnameRef = useRef(location.pathname);
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!enabled) return;

    let removeNativeBackListener = null;

    const goBackOrHome = () => {
      if (window.history.length > 1) {
        navigate(-1);
        return;
      }
      navigate("/", { replace: true });
    };

    const handleBack = () => {
      if (pathnameRef.current !== "/") {
        goBackOrHome();
        return;
      }
      setShowExitModal(true);
    };

    // Prevent immediate app close on root in webview.
    window.history.pushState({ appGuard: true }, "", window.location.href);

    const onPopState = () => handleBack();
    window.addEventListener("popstate", onPopState);

    const registerNativeBack = async () => {
      try {
        const listener = await CapacitorApp.addListener("backButton", () => {
          handleBack();
        });
        removeNativeBackListener = () => listener?.remove?.();
    } catch {
      // fallback handled by popstate
    }
    };

    registerNativeBack();

    return () => {
      window.removeEventListener("popstate", onPopState);
      if (removeNativeBackListener) removeNativeBackListener();
    };
  }, [enabled, navigate]);

  const handleCancelExit = () => {
    setShowExitModal(false);
    // Re-add guard entry to keep user in app after cancel.
    window.history.pushState({ appGuard: true }, "", window.location.href);
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    try {
      CapacitorApp.exitApp();
    } catch {
      window.close();
    }
  };

  return showExitModal ? (
    <div className="exit-modal-overlay" onClick={handleCancelExit}>
      <div className="exit-modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="exit-modal-title">Exit App</h3>
        <p className="exit-modal-message">Do you want to close the app?</p>
        <div className="exit-modal-actions">
          <button className="exit-btn-cancel" onClick={handleCancelExit}>Cancel</button>
          <button className="exit-btn-confirm" onClick={handleConfirmExit}>Exit</button>
        </div>
      </div>
    </div>
  ) : null;
}

function App() {
  const [openMenu, setOpenMenu] = useState(null);
  useEffect(() => {
    let active = true;

    const requestLocationPermission = () =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation API unavailable"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

    (async () => {
      try {
        await requestLocationPermission();
        if (active) {
          console.log("Location permission granted");
        }
      } catch (err) {
        console.warn("Location permission request failed", err);
        if (active) {
          alert("Please allow location permission to use this app");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // âœ… CLEAN INITIALIZATION â€” permission check hooks only when app loads
  const [loggedIn, setLoggedIn] = useState(
    () => !!localStorage.getItem("user")
  );

  return (
    <NotificationProvider>
      <TaskProvider>
        <BrowserRouter>
        <BackButtonHandler enabled={loggedIn} />
        {!loggedIn ? (
       <Routes>
  <Route 
    path="/" 
    element={
      sessionStorage.getItem("seenWelcome")
        ? <Navigate to="/login" />
        : <Welcome />
    } 
  />

  <Route 
    path="/login" 
    element={<Login onSuccess={() => setLoggedIn(true)} />} 
  />

  <Route path="*" element={<Navigate to="/" />} />
</Routes>

      ) : (
        <>
          <Sidebar openMenu={openMenu} setOpenMenu={setOpenMenu} />

          <div className="app-wrapper">
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard setOpenMenu={setOpenMenu} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute>
                    <Tasks setOpenMenu={setOpenMenu} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/report"
                element={
                  <ProtectedRoute>
                    <Report setOpenMenu={setOpenMenu} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile setOpenMenu={setOpenMenu} />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/attendance"
                element={
                  <ProtectedRoute>
                    <Attendance setOpenMenu={setOpenMenu} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/salary"
                element={
                  <ProtectedRoute>
                    <Salary setOpenMenu={setOpenMenu} />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/done"
                element={
                  <ProtectedRoute>
                    <DoneTasks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inprogress"
                element={
                  <ProtectedRoute>
                    <InProgressTasks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pending"
                element={
                  <ProtectedRoute>
                    <PendingTasks setOpenMenu={setOpenMenu} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reassigned"
                element={
                  <ProtectedRoute>
                    <ReassignedTasks />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </>
      )}
    </BrowserRouter>
    </TaskProvider>
    </NotificationProvider>
  );
}

export default App;


