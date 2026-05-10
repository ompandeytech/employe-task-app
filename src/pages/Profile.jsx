import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotificationContext } from "../context/NotificationContext";
import RefreshWrapper from "../components/RefreshWrapper";

const sanitizeProfileData = (user) => {
  if (!user) return null;
  const empId =
    user.id ??
    user.user_id ??
    user.userId ??
    user.employee_id ??
    user.employeeId ??
    "";
  return {
    name: user.name ?? user.fullName ?? "",
    role: user.role ?? "",
    department: user.department ?? "",
    empId,
    email: user.email ?? "",
    phone: user.phone ?? "",
  };
};

const getStoredProfile = () => {
  const stored = localStorage.getItem("user");
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return sanitizeProfileData(parsed);
  } catch {
    return null;
  }
};

const defaultProfile = {
  name: "",
  role: "",
  department: "",
  empId: "",
  email: "",
  phone: "",
};

export default function Profile() {
  const navigate = useNavigate();
  const {
    notifyTaskAssigned,
    showNotificationPanel,
    setShowNotificationPanel,
  } = useNotificationContext();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [profileImg, setProfileImg] = useState("https://picsum.photos/seed/employee/120/120");
  
  const initialProfile = getStoredProfile() || defaultProfile;
  // User profile data
  const [profile, setProfile] = useState(initialProfile);

  // Temporary states for forms
  const [tempProfile, setTempProfile] = useState(initialProfile);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  useEffect(() => {
    if (!getStoredProfile()) {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      const stored = getStoredProfile() || defaultProfile;
      setProfile(stored);
      setTempProfile(stored);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleProfileRefresh = useCallback(() => {
    const stored = getStoredProfile() || defaultProfile;
    setProfile(stored);
    setTempProfile(stored);
  }, []);

  // Handle profile image upload
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setProfileImg(imageUrl);
      // In real app, upload to server and save URL
    }
  };

  // Handle profile update
  const handleProfileUpdate = () => {
    if (!tempProfile) return;
    setProfile(tempProfile);
    localStorage.setItem("user", JSON.stringify(tempProfile));
    setShowEditModal(false);
    // Show success message
  };

  // Handle password change
  const handlePasswordChange = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("New passwords don't match!");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      alert("Password must be at least 6 characters!");
      return;
    }
    // In real app, validate current password and update in database
    alert("Password changed successfully!");
    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setShowPasswordModal(false);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  // Test notification function
  const handleTestNotification = () => {
    const testTask = {
      id: Date.now(),
      title: "Test Task for Notification",
      description: "This is a test notification"
    };
    notifyTaskAssigned(testTask, "Test Admin", "EMP-1024");
  };

  // Direct test function to toggle notification panel
  const handleToggleNotificationPanel = () => {
    console.log('Direct toggle test, current state:', showNotificationPanel);
    setShowNotificationPanel(!showNotificationPanel);
  };

  const displayProfile = profile || {};
  const displayTempProfile = tempProfile || {};

  return (
    <>
      <RefreshWrapper onRefresh={handleProfileRefresh}>
        <div className="profile-dashboard profile-container">
      {/* Header */}
      {/* Main Content */}
      <div className="profile-content">
        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-avatar-section">
            <div 
              className="profile-avatar"
              onClick={() => document.getElementById("profileUpload").click()}
            >
              <img src={profileImg} alt="Profile" />
              <div className="camera-overlay">
                <i className="fas fa-camera"></i>
              </div>
            </div>
          <div className="profile-info">
            <h2 className="user-name">{displayProfile.name || ""}</h2>
            <p className="user-role">{displayProfile.role || ""}</p>
          </div>
          </div>
          <button 
            className="edit-profile-btn"
            onClick={() => {
              setTempProfile(profile ?? {});
              setShowEditModal(true);
            }}
          >
            <i className="fas fa-edit"></i>
            Edit Profile
          </button>
        </div>

        {/* Professional Information */}
        <div className="info-card">
          <h3 className="card-title">
            <i className="fas fa-briefcase"></i>
            Professional Information
          </h3>
          <div className="info-list">
            <div className="info-item">
              <div className="info-icon">
                <i className="fas fa-building"></i>
              </div>
              <div className="info-content">
                <span className="info-label">Department</span>
                <span className="info-value">{displayProfile.department || ""}</span>
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">
                <i className="fas fa-id-badge"></i>
              </div>
              <div className="info-content">
                <span className="info-label">Employee ID</span>
                <span className="info-value">{displayProfile.empId || ""}</span>
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">
                <i className="fas fa-envelope"></i>
              </div>
              <div className="info-content">
                <span className="info-label">Email</span>
                <span className="info-value">{displayProfile.email || ""}</span>
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">
                <i className="fas fa-phone"></i>
              </div>
              <div className="info-content">
                <span className="info-label">Phone</span>
                <span className="info-value">{displayProfile.phone || ""}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="actions-card">
          <h3 className="card-title">
            <i className="fas fa-bolt"></i>
            Quick Actions
          </h3>
          <div className="action-buttons">
            <button 
              className="action-btn password-btn"
              onClick={() => setShowPasswordModal(true)}
            >
              <i className="fas fa-lock"></i>
              Change Password
            </button>
            <button 
              className="action-btn logout-btn"
              onClick={handleLogout}
            >
              <i className="fas fa-sign-out-alt"></i>
              Logout
            </button>
          </div>
          <div className="action-buttons" style={{ marginTop: '12px' }}>
            <button 
              className="action-btn test-btn"
              onClick={handleTestNotification}
            >
              <i className="fas fa-bell"></i>
              Test Notification
            </button>
            <button 
              className="action-btn test-btn"
              onClick={handleToggleNotificationPanel}
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' }}
            >
              <i className="fas fa-eye"></i>
              Toggle Panel
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input 
        type="file"
        accept="image/*"
        id="profileUpload"
        hidden
        onChange={handleImageChange}
      />

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit Profile</h3>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  name="name"
                  value={displayTempProfile.name || ""}
                  onChange={(e) => setTempProfile({...displayTempProfile, name: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <input 
                  name="role"
                  value={displayTempProfile.role || ""}
                  onChange={(e) => setTempProfile({...displayTempProfile, role: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input 
                  name="department"
                  value={displayTempProfile.department || ""}
                  onChange={(e) => setTempProfile({...displayTempProfile, department: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Employee ID</label>
                <input 
                  name="empId"
                  value={displayTempProfile.empId || ""}
                  onChange={(e) => setTempProfile({...displayTempProfile, empId: e.target.value})}
                  className="form-input"
                  disabled
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  name="email"
                  value={displayTempProfile.email || ""}
                  onChange={(e) => setTempProfile({...displayTempProfile, email: e.target.value})}
                  className="form-input"
                  type="email"
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input 
                  name="phone"
                  value={displayTempProfile.phone || ""}
                  onChange={(e) => setTempProfile({...displayTempProfile, phone: e.target.value})}
                  className="form-input"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-cancel"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-save"
                onClick={handleProfileUpdate}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Change Password</h3>
              <button className="close-btn" onClick={() => setShowPasswordModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Current Password</label>
                <input 
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input 
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input 
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className="form-input"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-cancel"
                onClick={() => setShowPasswordModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-save"
                onClick={handlePasswordChange}
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
      </RefreshWrapper>

      <div className="bottom-nav">
        <div className="nav-item" onClick={() => navigate("/")}>
          <i className="fas fa-home"></i>
          <span>Home</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/tasks")}>
          <i className="fas fa-tasks"></i>
          <span>Tasks</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/report")}>
          <i className="fas fa-chart-line"></i>
          <span>Report</span>
        </div>
        <div className="nav-item active" onClick={() => navigate("/profile")}>
          <i className="fas fa-user"></i>
          <span>Profile</span>
        </div>
      </div>

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
          background: #f8fafc;
          color: #1e293b;
          line-height: 1.5;
        }

        .profile-dashboard {
          min-height: 100vh;
          background: #f8fafc;
          padding: 0 16px 100px;
          max-width: 480px;
          margin: 0 auto;
        }

        .profile-container {
          padding-bottom: 100px;
        }

        /* Header */
        .profile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0 16px;
          padding-top: calc(env(safe-area-inset-top, 0px) + 10px);
          margin-bottom: 24px;
        }

        .menu-btn {
          width: 40px;
          height: 40px;
          border: none;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
        }

        .menu-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }

        .menu-btn i {
          color: #64748b;
          font-size: 16px;
        }

        .page-title {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }

        .notification-btn {
          width: 40px;
          height: 40px;
          border: none;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
          position: relative;
        }

        .notification-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }

        .notification-btn i {
          color: #64748b;
          font-size: 16px;
        }

        .notification-dot {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          border: 2px solid white;
        }

        /* Profile Card */
        .profile-card {
          background: white;
          border-radius: 24px;
          padding: 32px 24px;
          margin-bottom: 24px;
          box-shadow: 
            0 10px 30px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(255, 255, 255, 0.8);
        }

        .profile-avatar-section {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        .profile-avatar {
          position: relative;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .profile-avatar:hover {
          transform: scale(1.05);
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .camera-overlay {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .camera-overlay i {
          color: white;
          font-size: 14px;
        }

        .profile-info {
          flex: 1;
        }

        .user-name {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .user-role {
          font-size: 16px;
          color: #64748b;
          font-weight: 500;
        }

        .edit-profile-btn {
          width: 100%;
          padding: 14px 24px;
          border: none;
          border-radius: 16px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .edit-profile-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
        }

        .edit-profile-btn i {
          font-size: 14px;
        }

        /* Info Card */
        .info-card {
          background: white;
          border-radius: 24px;
          padding: 28px 24px;
          margin-bottom: 24px;
          box-shadow: 
            0 10px 30px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(255, 255, 255, 0.8);
        }

        .card-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .card-title i {
          color: #3b82f6;
          font-size: 16px;
        }

        .info-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 16px;
          transition: all 0.3s ease;
        }

        .info-item:hover {
          background: #f1f5f9;
          transform: translateX(4px);
        }

        .info-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .info-icon i {
          color: white;
          font-size: 16px;
        }

        .info-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .info-label {
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 16px;
          color: #0f172a;
          font-weight: 600;
        }

        /* Actions Card */
        .actions-card {
          background: white;
          border-radius: 24px;
          padding: 28px 24px;
          margin-bottom: 24px;
          box-shadow: 
            0 10px 30px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(255, 255, 255, 0.8);
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .action-btn {
          flex: 1;
          padding: 14px 20px;
          border: none;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .action-btn i {
          font-size: 14px;
        }

        .password-btn {
          background: #f8fafc;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .password-btn:hover {
          background: #f1f5f9;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .logout-btn {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .logout-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);
        }

        .test-btn {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .test-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-card {
          background: white;
          border-radius: 24px;
          max-width: 400px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 24px 0;
        }

        .modal-header h3 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: #f8fafc;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .close-btn:hover {
          background: #e2e8f0;
        }

        .close-btn i {
          color: #64748b;
          font-size: 14px;
        }

        .modal-body {
          padding: 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }

        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-input:disabled {
          background: #f8fafc;
          color: #64748b;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          padding: 0 24px 24px;
        }

        .btn-cancel {
          flex: 1;
          padding: 12px 20px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #64748b;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-cancel:hover {
          background: #f8fafc;
        }

        .btn-save {
          flex: 1;
          padding: 12px 20px;
          border: none;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-save:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        /* Bottom Navigation */
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 480px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          display: flex;
          justify-content: space-around;
          padding: 12px 20px;
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
          z-index: 9999;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 16px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .nav-item:hover {
          background: rgba(16, 185, 129, 0.1);
          transform: translateY(-2px);
        }

        .nav-item.active {
          background: rgba(16, 185, 129, 0.1);
        }

        .nav-item i {
          font-size: 18px;
          color: #94a3b8;
          transition: color 0.3s ease;
        }

        .nav-item.active i {
          color: #10b981;
        }

        .nav-item span {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          transition: color 0.3s ease;
        }

        .nav-item.active span {
          color: #10b981;
          font-weight: 600;
        }

        /* Responsive Design */
        @media (max-width: 480px) {
          .profile-dashboard {
            padding: 16px 12px 100px;
          }

          .profile-avatar-section {
            flex-direction: column;
            text-align: center;
            gap: 16px;
          }

          .action-buttons {
            flex-direction: column;
          }

          .modal-card {
            margin: 20px;
          }
        }
      `}</style>
    </>
  );
}
