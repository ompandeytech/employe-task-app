import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotificationContext } from "../context/NotificationContext";
import RefreshWrapper from "../components/RefreshWrapper";
import WorkspaceBottomNav from "../components/WorkspaceBottomNav";
import "./ProfilePage.css";

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
   useNotificationContext();
  const [showEditModal, setShowEditModal] = useState(false);
  
const [profileImg, setProfileImg] = useState(
  localStorage.getItem("profileImage") || ""
);  
  const initialProfile = getStoredProfile() || defaultProfile;
  // User profile data
  const [profile, setProfile] = useState(initialProfile);

  // Temporary states for forms
  const [tempProfile, setTempProfile] = useState(initialProfile);


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
    const reader = new FileReader();

    reader.onloadend = () => {
      const imageData = reader.result;

      setProfileImg(imageData);
      localStorage.setItem("profileImage", imageData);
    };

    reader.readAsDataURL(file);
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

  

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/login";
  };



  const displayProfile = profile || {};
  const displayTempProfile = tempProfile || {};

  return (
    <>
      <RefreshWrapper onRefresh={handleProfileRefresh}>
        <div className="profile-dashboard profile-container profile-page">
      {/* Header */}
      {/* Main Content */}
      <div className="profile-content">
        {/* Profile Card */}
        <div className="profile-card">

          <details className="profile-menu">
            <summary className="profile-menu-trigger" aria-label="Open profile actions">
              <i className="fas fa-ellipsis-v"></i>
            </summary>
            <div className="profile-menu-dropdown">
              <button
                type="button"
                className="profile-menu-item"
                onClick={() => {
                  setTempProfile(profile ?? {});
                  setShowEditModal(true);
                }}
              >
                <i className="fas fa-edit"></i>
                Edit Profile
              </button>
              <button
                type="button"
                className="profile-menu-item profile-menu-item--danger"
                onClick={handleLogout}
              >
                <i className="fas fa-sign-out-alt"></i>
                Logout
              </button>
            </div>
          </details>
          <div className="profile-avatar-section">
            <div 
              className="profile-avatar"
              onClick={() => document.getElementById("profileUpload").click()}
            >
              {profileImg ? (
  <img src={profileImg} alt="Profile" />
) : (
  <div className="profile-avatar-placeholder">
    <i className="fas fa-user"></i>
  </div>
)}
              <div className="camera-overlay">
                <i className="fas fa-camera"></i>
              </div>
            </div>
          <div className="profile-info">
            <div className="profile-name-row">
              <h2 className="user-name">{displayProfile.name || ""}</h2>
              <span className="profile-verified" aria-label="Verified employee">
  <i className="fas fa-check"></i>
</span>
            </div>
            <p className="user-role">{displayProfile.role || "Employee"}</p>
          </div>
          </div>
        </div>

        {/* Professional Details */}
        <div className="info-card">
          <h3 className="card-title">
            <i className="fas fa-briefcase"></i>
            Professional Details
          </h3>
          <div className="info-list">
            <div className="info-item">
              <div className="info-icon">
                <i className="fas fa-envelope"></i>
              </div>
              <div className="info-content">
                <span className="info-label">Email Address</span>
                <span className="info-value">{displayProfile.email || ""}</span>
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">
                <i className="fas fa-phone"></i>
              </div>
              <div className="info-content">
                <span className="info-label">Phone Number</span>
                <span className="info-value">{displayProfile.phone || ""}</span>
              </div>
            </div>
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

      

      </div>
      </RefreshWrapper>

      <WorkspaceBottomNav />
    </>
  );
}
