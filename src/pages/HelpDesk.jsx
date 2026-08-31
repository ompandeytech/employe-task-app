import { useCallback, useEffect, useMemo, useState } from "react";
import client from "../api/client";
import NotificationBell from "../components/NotificationBell";
import WorkspaceBottomNav from "../components/WorkspaceBottomNav";
import "./HelpDesk.css";

const categories = [
  "Order related issue",
  "Product related issue",
  "Inventory issue",
  "Payment issue",
  "Website/app issue",
  "Customer/order problem",
  "Other issue",
];

const emptyForm = {
  category: categories[0],
  title: "",
  description: "",
  attachmentName: "",
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getToday = () => new Date().toISOString().slice(0, 10);

const normalizeStatus = (status) =>
  ["Pending", "In Progress", "Done"].includes(status) ? status : "Pending";

const mapHelpDeskIssue = (issue) => ({
  id: issue.id,
  title: issue.title || "",
  category: issue.category || "Other issue",
  description: issue.description || "",
  status: normalizeStatus(issue.status),
  submittedAt: issue.created_at || issue.submittedAt || getToday(),
  attachmentName: issue.attachment_name || issue.attachmentName || "",
  attachmentUrl: issue.attachment_url || issue.attachmentUrl || "",
});

export default function HelpDesk({ setOpenMenu }) {
  const [view, setView] = useState("home");
  const [issues, setIssues] = useState([]);
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadIssues = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    setFetchError("");

    try {
      const response = await client.get("/help-desk/my");
      const payload = Array.isArray(response.data) ? response.data : [];
      const nextIssues = payload.map(mapHelpDeskIssue);
      setIssues(nextIssues);
      return nextIssues;
    } catch {
      setIssues([]);
      setFetchError("Unable to load your submitted issues. Please try again.");
      return [];
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIssues({ showLoader: true });
  }, [loadIssues]);

  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.id === selectedIssueId),
    [issues, selectedIssueId]
  );

  const openIssue = (issue) => {
    setSelectedIssueId(issue.id);
    setView("details");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim() || submitting) return;

    setSubmitting(true);
    setSubmitError("");

    const payload = {
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim(),
    };

    if (form.attachmentName) {
      payload.attachment_name = form.attachmentName;
    }

    try {
      const response = await client.post("/help-desk", payload);
      const nextIssues = await loadIssues();
      const createdId = response.data?.issue?.id || response.data?.issueId || null;
      const createdIssue =
        nextIssues.find((issue) => String(issue.id) === String(createdId)) ||
        nextIssues[0] ||
        null;
      setForm(emptyForm);
      setSelectedIssueId(createdIssue?.id || null);
      setView(createdIssue ? "details" : "home");
    } catch {
      setSubmitError("Unable to submit your issue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachment = (event) => {
    const file = event.target.files?.[0];
    setForm((currentForm) => ({
      ...currentForm,
      attachmentName: file?.name || "",
    }));
  };

  const goHome = () => {
    setView("home");
    setSelectedIssueId(null);
  };

  return (
    <>
      <div className="helpdesk-page">
        <header className="dashboard-topbar">
          <button
            type="button"
            className="dashboard-icon-button"
            onClick={() => setOpenMenu(true)}
            aria-label="Open menu"
          >
            <i className="fas fa-bars"></i>
          </button>
          <span className="dashboard-topbar-title">Help Desk</span>
          <div className="dashboard-topbar-bell">
            <NotificationBell />
          </div>
        </header>

        <main className="helpdesk-content">
          {view === "home" && (
            <>
              <section className="helpdesk-hero">
                <div>
                  <span className="helpdesk-kicker">Employee support</span>
                  <h1>Help Desk</h1>
                  <p>Need help? Report an issue and track it here.</p>
                </div>
                <button
                  type="button"
                  className="helpdesk-report-card"
                  onClick={() => setView("report")}
                >
                  <span className="helpdesk-report-icon">
                    <i className="fas fa-plus"></i>
                  </span>
                  <span>
                    <strong>Report an Issue</strong>
                    <small>Order, product, payment, app and other issues</small>
                  </span>
                </button>
              </section>

              <section className="helpdesk-section">
                <div className="helpdesk-section-head">
                  <h2>Submitted issues</h2>
                  <span>{issues.length} total</span>
                </div>

                <div className="helpdesk-issue-list">
                  {loading && <p>Loading issues...</p>}
                  {!loading && fetchError && <p>{fetchError}</p>}
                  {!loading && !fetchError && issues.length === 0 && <p>No submitted issues yet.</p>}
                  {!loading && !fetchError && issues.map((issue) => (
                    <button
                      key={issue.id}
                      type="button"
                      className="helpdesk-issue-card"
                      onClick={() => openIssue(issue)}
                    >
                      <span className="helpdesk-issue-icon">
                        <i className="fas fa-life-ring"></i>
                      </span>
                      <span className="helpdesk-issue-copy">
                        <strong>{issue.title}</strong>
                        <small>{issue.category}</small>
                        <em>{formatDate(issue.submittedAt)}</em>
                      </span>
                      <span className={`helpdesk-status helpdesk-status--${issue.status.toLowerCase().replace(" ", "-")}`}>
                        {issue.status}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {view === "report" && (
            <section className="helpdesk-panel">
              <button type="button" className="helpdesk-back-btn" onClick={goHome}>
                <i className="fas fa-chevron-left"></i>
                Back
              </button>
              <h1>Report Issue</h1>
              <p>Share the issue details so the team can review it.</p>

              <form className="helpdesk-form" onSubmit={handleSubmit}>
                {submitError && <p>{submitError}</p>}
                <label>
                  <span>Issue Category</span>
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        category: event.target.value,
                      }))
                    }
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Issue Title</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Short issue title"
                    required
                  />
                </label>

                <label>
                  <span>Description</span>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Describe what happened"
                    rows="5"
                    required
                  />
                </label>

                <label className="helpdesk-attachment">
                  <input type="file" accept="image/*" onChange={handleAttachment} />
                  <span className="helpdesk-attachment-icon">
                    <i className="fas fa-paperclip"></i>
                  </span>
                  <span>
                    <strong>{form.attachmentName || "Optional attachment/photo"}</strong>
                    <small>Tap to add a screenshot or photo</small>
                  </span>
                </label>

                <button type="submit" className="helpdesk-submit-btn" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Issue"}
                </button>
              </form>
            </section>
          )}

          {view === "details" && selectedIssue && (
            <section className="helpdesk-panel">
              <button type="button" className="helpdesk-back-btn" onClick={goHome}>
                <i className="fas fa-chevron-left"></i>
                Back
              </button>
              <div className="helpdesk-detail-head">
                <div>
                  <h1>{selectedIssue.title}</h1>
                  <p>{selectedIssue.category}</p>
                </div>
                <span className={`helpdesk-status helpdesk-status--${selectedIssue.status.toLowerCase().replace(" ", "-")}`}>
                  {selectedIssue.status}
                </span>
              </div>

              <div className="helpdesk-detail-card">
                <span>Description</span>
                <p>{selectedIssue.description}</p>
              </div>

              <div className="helpdesk-meta-grid">
                <div>
                  <span>Submitted date</span>
                  <strong>{formatDate(selectedIssue.submittedAt)}</strong>
                </div>
                <div>
                  <span>Current status</span>
                  <strong>{selectedIssue.status}</strong>
                </div>
              </div>

              {selectedIssue.attachmentName && (
                <div className="helpdesk-detail-card helpdesk-file-card">
                  <i className="fas fa-paperclip"></i>
                  <div>
                    <span>Attachment</span>
                    <p>{selectedIssue.attachmentName}</p>
                  </div>
                </div>
              )}

              <div className="helpdesk-progress" aria-label={`Issue status: ${selectedIssue.status}`}>
                {["Pending", "In Progress", "Done"].map((status) => {
                  const activeIndex = ["Pending", "In Progress", "Done"].indexOf(selectedIssue.status);
                  const itemIndex = ["Pending", "In Progress", "Done"].indexOf(status);
                  return (
                    <div
                      key={status}
                      className={`helpdesk-progress-step ${itemIndex <= activeIndex ? "active" : ""}`}
                    >
                      <span></span>
                      <small>{status}</small>
                    </div>
                  );
                })}
              </div>

              {selectedIssue.status === "Done" && (
                <div className="helpdesk-done-note">
                  <i className="fas fa-check-circle"></i>
                  Done
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      <WorkspaceBottomNav />
    </>
  );
}
