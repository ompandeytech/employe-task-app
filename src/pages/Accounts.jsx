import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import "./Accounts.css";

const defaultForm = () => ({
  account_name: "",
  platform: "DIRECT",
});

const PLATFORM_OPTIONS = ["DIRECT", "FLIPKART", "AMAZON", "MEESHO", "WEBSITE", "OTHER"];

export default function Accounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(defaultForm());
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await client.get("/accounts");
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setAccounts([]);
    }
  };

  const resetForm = () => {
    setForm(defaultForm());
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const accountName = form.account_name.trim();
    if (!accountName) {
      alert("Account name required");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        account_name: accountName,
        platform: form.platform,
      };

      if (editingId) {
        await client.put(`/accounts/${editingId}`, payload);
      } else {
        await client.post("/accounts", payload);
      }

    
       resetForm();
       fetchAccounts();
    
    } catch (error) {
      console.error("Error saving account:", error);
      alert(error.response?.data?.message || "Failed to save account");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account) => {
    setForm({
      account_name: account.account_name || "",
      platform: account.platform || "DIRECT",
    });
    setEditingId(account.id);
  };

  const handleDelete = async (account) => {
    if (!window.confirm("Are you sure you want to delete this account?")) return;

    try {
      await client.delete(`/accounts/${account.id}`);
      if (editingId === account.id) resetForm();
      fetchAccounts();
    } catch (error) {
      console.error("Error deleting account:", error);
      alert(error.response?.data?.message || "Failed to delete account");
    }
  };

  return (
    <div className="accounts-page">
      <div className="accounts-header">
        <div>
          <h2>Accounts Management</h2>
          <p>Add and manage platform-wise accounts used in sales.</p>
        </div>
        <button
          type="button"
          className="accounts-back-btn"
          onClick={() => navigate("/sales", { replace: true })}
        >
          Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="accounts-card accounts-form-card">
        <div className="accounts-section-title">
          <h3>{editingId ? "Edit Account" : "Add New Account"}</h3>
        </div>

        <div className="accounts-form-grid">
          <div className="accounts-field">
            <label htmlFor="sales-account-name">Account Name</label>
            <input
              id="sales-account-name"
              type="text"
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              placeholder="Account Name"
              required
            />
          </div>

          <div className="accounts-field">
            <label htmlFor="sales-account-platform">Platform</label>
            <select
              id="sales-account-platform"
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
            >
              {PLATFORM_OPTIONS.map((platform) => (
                <option key={platform} value={platform}>
                  {platform.charAt(0) + platform.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="accounts-form-actions">
            <button type="submit" disabled={loading} className="accounts-save-btn">
              {loading ? "Saving..." : editingId ? "Update Account" : "Add Account"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="accounts-cancel-btn">
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>

      <div className="accounts-card accounts-list-card">
        <div className="accounts-table-head">
          <div>
            <h3>Accounts</h3>
            <p>Manage platform-wise accounts used in packaging and sales.</p>
          </div>
        </div>

        <div className="accounts-table-container">
          <table className="accounts-table">
            <thead>
              <tr>
                <th>Account Name</th>
                <th>Platform</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan="3" className="accounts-empty-state">
                    No accounts found
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id}>
                    <td className="accounts-table-strong">{account.account_name}</td>
                    <td>
                      <span className="accounts-platform-badge">
                        {account.platform || "DIRECT"}
                      </span>
                    </td>
                    <td>
                      <div className="accounts-actions-cell">
                        <button
                          type="button"
                          onClick={() => handleEdit(account)}
                          className="accounts-edit-btn"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(account)}
                          className="accounts-delete-btn"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
