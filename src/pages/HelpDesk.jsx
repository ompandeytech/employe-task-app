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

const helpContent = {
  "Order related issue": [
    { id: "order-1", title: "Order is not showing", solution: ["Check the order details.", "Refresh the order screen.", "Check the latest status.", "Try again."] },
    { id: "order-2", title: "Order information is incorrect", solution: ["Verify the order details.", "Contact customer if needed.", "Update the information."] },
    { id: "order-3", title: "Customer/order issue", solution: ["Check customer details.", "Review order history.", "Contact support if needed."] },
    { id: "order-4", title: "Other order problem", solution: ["Describe the specific issue.", "Check related orders.", "Contact support team."] },
  ],
  "Product related issue": [
    { id: "product-1", title: "Product information is incorrect", solution: ["Verify product details.", "Check inventory records.", "Update product information."] },
    { id: "product-2", title: "Product is not visible", solution: ["Check product status.", "Verify inventory stock.", "Refresh the product list."] },
    { id: "product-3", title: "Product related issue", solution: ["Review product details.", "Check category settings.", "Contact support."] },
    { id: "product-4", title: "Other product problem", solution: ["Describe the issue.", "Check product history.", "Raise a ticket."] },
  ],
  "Inventory issue": [
    { id: "inventory-1", title: "Stock is incorrect", solution: ["Verify current stock.", "Check recent transactions.", "Update inventory."] },
    { id: "inventory-2", title: "Inventory is not updating", solution: ["Refresh the inventory page.", "Check system status.", "Try again later."] },
    { id: "inventory-3", title: "Product stock issue", solution: ["Check stock levels.", "Review stock updates.", "Contact warehouse."] },
    { id: "inventory-4", title: "Other inventory problem", solution: ["Describe the issue.", "Check inventory logs.", "Raise a ticket."] },
  ],
  "Payment issue": [
    { id: "payment-1", title: "Payment issue", solution: ["Check payment status.", "Verify payment details.", "Contact finance team."] },
    { id: "payment-2", title: "Payment status issue", solution: ["Refresh payment page.", "Check transaction history.", "Verify with bank."] },
    { id: "payment-3", title: "Other payment problem", solution: ["Describe the payment issue.", "Check payment records.", "Contact support."] },
  ],
  "Website/app issue": [
    { id: "app-1", title: "App is not working", solution: ["Close and reopen the app.", "Check internet connection.", "Clear app cache."] },
    { id: "app-2", title: "Something is not loading", solution: ["Refresh the page.", "Check internet connection.", "Try again later."] },
    { id: "app-3", title: "Login/account issue", solution: ["Verify credentials.", "Reset password if needed.", "Contact admin."] },
    { id: "app-4", title: "Other app problem", solution: ["Describe the issue.", "Check app version.", "Raise a ticket."] },
  ],
  "Customer/order problem": [
    { id: "customer-1", title: "Customer issue", solution: ["Check customer details.", "Review customer history.", "Contact customer."] },
    { id: "customer-2", title: "Order issue", solution: ["Check order status.", "Verify order details.", "Track shipment."] },
    { id: "customer-3", title: "Other problem", solution: ["Describe the issue.", "Check related records.", "Contact support."] },
  ],
  "Other issue": [
    { id: "other-1", title: "Other issue", solution: ["Describe your problem.", "Check related information.", "Contact support team."] },
  ],
};

const getAllQuestions = () => {
  const allQuestions = [];
  Object.entries(helpContent).forEach(([category, questions]) => {
    questions.forEach((q) => {
      allQuestions.push({ ...q, category });
    });
  });
  return allQuestions;
};

const emptyForm = {
  category: categories[0],
  title: "",
  description: "",
  attachmentName: "",
  attachmentFile: null,
  selected_question_id: null,
  selected_question_title: "",
  guided_solution: "",
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [createdTicketId, setCreatedTicketId] = useState(null);

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

    let uploadAttachmentName = null;
    let uploadAttachmentUrl = null;

    try {
      if (form.attachmentFile) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", form.attachmentFile);

        const uploadResponse = await client.post("/help-desk/upload", uploadFormData);

        uploadAttachmentName = uploadResponse.data?.attachment_name || form.attachmentName;
        uploadAttachmentUrl = uploadResponse.data?.attachment_url || null;

        if (!uploadAttachmentUrl) {
          throw new Error("Upload response missing attachment_url");
        }
      }
    } catch {
      setSubmitError("Photo upload failed. Please try again.");
      setSubmitting(false);
      return;
    }

    const payload = {
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim(),
    };

    if (form.selected_question_id) {
      payload.selected_question_id = form.selected_question_id;
    }
    if (form.selected_question_title) {
      payload.selected_question_title = form.selected_question_title;
    }
    if (form.guided_solution) {
      payload.guided_solution = form.guided_solution;
    }

    if (uploadAttachmentName) {
      payload.attachment_name = uploadAttachmentName;
    }
    if (uploadAttachmentUrl) {
      payload.attachment_url = uploadAttachmentUrl;
    }

    try {
      const response = await client.post("/help-desk", payload);
      const createdId = response.data?.issue?.id || response.data?.issueId || null;
      setCreatedTicketId(createdId);
      setForm(emptyForm);
      setView("success");
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
      attachmentFile: file || null,
    }));
  };

  const goHome = () => {
    setView("home");
    setSelectedIssueId(null);
    setSelectedCategory(null);
    setSelectedQuestion(null);
    setSearchQuery("");
    setCreatedTicketId(null);
  };

  const goToCategories = () => {
    setView("categories");
  };

  const goToMyTickets = () => {
    setView("my-tickets");
  };

  const goToRaiseTicket = (
    prefillCategory = null,
    prefillTitle = "",
    prefillQuestionId = null,
    prefillQuestionTitle = "",
    prefillGuidedSolution = ""
  ) => {
    setForm({
      ...emptyForm,
      category: prefillCategory || categories[0],
      title: prefillTitle,
      selected_question_id: prefillQuestionId,
      selected_question_title: prefillQuestionTitle,
      guided_solution: prefillGuidedSolution,
    });
    setView("report");
  };

  const selectCategory = (category) => {
    setSelectedCategory(category);
    setView("questions");
  };

  const selectQuestion = (question) => {
    setSelectedQuestion(question);
    setView("solution");
  };

  const handleProblemSolved = () => {
    goHome();
  };

  const handleStillNeedHelp = () => {
    if (selectedQuestion) {
      goToRaiseTicket(
        selectedQuestion.category,
        selectedQuestion.title,
        selectedQuestion.id,
        selectedQuestion.title,
        Array.isArray(selectedQuestion.solution)
          ? selectedQuestion.solution.join(" ")
          : ""
      );
    } else {
      goToRaiseTicket();
    }
  };

  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) return getAllQuestions();
    const query = searchQuery.toLowerCase();
    return getAllQuestions().filter(
      (q) =>
        q.title.toLowerCase().includes(query) ||
        q.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

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
              <section className="helpdesk-hero-new">
                <div className="helpdesk-hero-content">
                  <span className="helpdesk-kicker">Employee Support</span>
                  <h1>Help Desk</h1>
                  <p>We're here to help. Find answers or raise a ticket.</p>
                </div>
                
                <div className="helpdesk-search-box">
                  <i className="fas fa-search"></i>
                  <input
                    type="text"
                    placeholder="Search for a topic or problem"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setView("search")}
                  />
                </div>
              </section>

              <section className="helpdesk-quick-actions">
                <button
                  type="button"
                  className="helpdesk-quick-card"
                  onClick={goToCategories}
                >
                  <span className="helpdesk-quick-icon">
                    <i className="fas fa-book"></i>
                  </span>
                  <span>Browse Help</span>
                </button>
                <button
                  type="button"
                  className="helpdesk-quick-card"
                  onClick={goToMyTickets}
                >
                  <span className="helpdesk-quick-icon">
                    <i className="fas fa-ticket-alt"></i>
                  </span>
                  <span>My Tickets</span>
                  {issues.length > 0 && (
                    <span className="helpdesk-quick-badge">{issues.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  className="helpdesk-quick-card helpdesk-quick-card--primary"
                  onClick={() => goToRaiseTicket()}
                >
                  <span className="helpdesk-quick-icon">
                    <i className="fas fa-plus"></i>
                  </span>
                  <span>Raise a Ticket</span>
                </button>
              </section>

              <section className="helpdesk-section">
                <div className="helpdesk-section-head">
                  <h2>Recent Tickets</h2>
                  <button type="button" className="helpdesk-link-btn" onClick={goToMyTickets}>
                    View All
                  </button>
                </div>

                <div className="helpdesk-issue-list">
                  {loading && <p>Loading tickets...</p>}
                  {!loading && fetchError && <p>{fetchError}</p>}
                  {!loading && !fetchError && issues.length === 0 && (
                    <div className="helpdesk-empty-state">
                      <i className="fas fa-inbox"></i>
                      <p>No tickets yet</p>
                      <button type="button" onClick={() => goToRaiseTicket()}>
                        Raise your first ticket
                      </button>
                    </div>
                  )}
                  {!loading && !fetchError && issues.slice(0, 3).map((issue) => (
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
                        <strong>#{issue.id} - {issue.title}</strong>
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

          {view === "search" && (
            <section className="helpdesk-panel">
              <button type="button" className="helpdesk-back-btn" onClick={goHome}>
                <i className="fas fa-chevron-left"></i>
                Back
              </button>
              <h1>Search Help</h1>
              
              <div className="helpdesk-search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder="Search for a topic or problem"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="helpdesk-search-results">
                {filteredQuestions.length === 0 ? (
                  <div className="helpdesk-empty-state">
                    <i className="fas fa-search"></i>
                    <p>No results found</p>
                    <button type="button" onClick={() => goToRaiseTicket()}>
                      Still need help? Raise a Ticket
                    </button>
                  </div>
                ) : (
                  filteredQuestions.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className="helpdesk-question-card"
                      onClick={() => selectQuestion(q)}
                    >
                      <span>{q.title}</span>
                      <small>{q.category}</small>
                    </button>
                  ))
                )}
              </div>
            </section>
          )}

          {view === "categories" && (
            <section className="helpdesk-panel">
              <button type="button" className="helpdesk-back-btn" onClick={goHome}>
                <i className="fas fa-chevron-left"></i>
                Back
              </button>
              <h1>Browse Help Categories</h1>
              <p>Select a category to find common problems and solutions.</p>

              <div className="helpdesk-category-grid">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="helpdesk-category-card"
                    onClick={() => selectCategory(category)}
                  >
                    <span className="helpdesk-category-icon">
                      <i className="fas fa-folder"></i>
                    </span>
                    <span>{category}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {view === "questions" && selectedCategory && (
            <section className="helpdesk-panel">
              <button type="button" className="helpdesk-back-btn" onClick={goToCategories}>
                <i className="fas fa-chevron-left"></i>
                Back
              </button>
              <h1>{selectedCategory}</h1>
              <p>Common problems and questions</p>

              <div className="helpdesk-question-list">
                {helpContent[selectedCategory]?.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    className="helpdesk-question-card"
                    onClick={() => selectQuestion(q)}
                  >
                    <span>{q.title}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {view === "solution" && selectedQuestion && (
            <section className="helpdesk-panel">
              <button type="button" className="helpdesk-back-btn" onClick={() => setSelectedCategory(null)}>
                <i className="fas fa-chevron-left"></i>
                Back
              </button>
              <h1>{selectedQuestion.title}</h1>
              <p className="helpdesk-solution-category">{selectedQuestion.category}</p>

              <div className="helpdesk-solution-content">
                <h3>Try these steps</h3>
                <ol className="helpdesk-solution-steps">
                  {selectedQuestion.solution.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>

              <div className="helpdesk-solution-actions">
                <p>Did this solve your problem?</p>
                <div className="helpdesk-solution-buttons">
                  <button
                    type="button"
                    className="helpdesk-solution-btn helpdesk-solution-btn--success"
                    onClick={handleProblemSolved}
                  >
                    <i className="fas fa-check"></i>
                    Yes, Problem Solved
                  </button>
                  <button
                    type="button"
                    className="helpdesk-solution-btn helpdesk-solution-btn--help"
                    onClick={handleStillNeedHelp}
                  >
                    <i className="fas fa-question-circle"></i>
                    Still Need Help
                  </button>
                </div>
              </div>
            </section>
          )}

          {view === "my-tickets" && (
            <section className="helpdesk-panel">
              <button type="button" className="helpdesk-back-btn" onClick={goHome}>
                <i className="fas fa-chevron-left"></i>
                Back
              </button>
              <h1>My Tickets</h1>
              <p>Track all your submitted support tickets.</p>

              <div className="helpdesk-issue-list">
                {loading && <p>Loading tickets...</p>}
                {!loading && fetchError && <p>{fetchError}</p>}
                {!loading && !fetchError && issues.length === 0 && (
                  <div className="helpdesk-empty-state">
                    <i className="fas fa-inbox"></i>
                    <p>No tickets yet</p>
                    <button type="button" onClick={() => goToRaiseTicket()}>
                      Raise your first ticket
                    </button>
                  </div>
                )}
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
                      <strong>#{issue.id} - {issue.title}</strong>
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
          )}

          {view === "report" && (
            <section className="helpdesk-panel">
              <button type="button" className="helpdesk-back-btn" onClick={goHome}>
                <i className="fas fa-chevron-left"></i>
                Back
              </button>
              <h1>Raise a Ticket</h1>
              <p>Describe your issue and we'll help you resolve it.</p>

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

          {view === "success" && createdTicketId && (
            <section className="helpdesk-panel">
              <div className="helpdesk-success-state">
                <span className="helpdesk-success-icon">
                  <i className="fas fa-check-circle"></i>
                </span>
                <h1>Ticket Created Successfully</h1>
                <p>Your issue has been submitted to the support team.</p>
                <div className="helpdesk-ticket-id">
                  <span>Ticket #{createdTicketId}</span>
                </div>
                <div className="helpdesk-success-actions">
                  <button
                    type="button"
                    className="helpdesk-success-btn"
                    onClick={() => {
                      const createdIssue = issues.find((i) => String(i.id) === String(createdTicketId));
                      if (createdIssue) {
                        setSelectedIssueId(createdTicketId);
                        setView("details");
                      } else {
                        loadIssues({ showLoader: true }).then((nextIssues) => {
                          const found = nextIssues.find((i) => String(i.id) === String(createdTicketId));
                          if (found) {
                            setSelectedIssueId(createdTicketId);
                            setView("details");
                          } else {
                            goToMyTickets();
                          }
                        });
                      }
                    }}
                  >
                    View Ticket
                  </button>
                  <button
                    type="button"
                    className="helpdesk-success-btn helpdesk-success-btn--secondary"
                    onClick={goToMyTickets}
                  >
                    My Tickets
                  </button>
                </div>
              </div>
            </section>
          )}

          {view === "details" && selectedIssue && (
            <section className="helpdesk-panel">
              <button type="button" className="helpdesk-back-btn" onClick={goToMyTickets}>
                <i className="fas fa-chevron-left"></i>
                Back
              </button>
              <div className="helpdesk-detail-head">
                <div>
                  <span className="helpdesk-ticket-number">Ticket #{selectedIssue.id}</span>
                  <h1>{selectedIssue.title}</h1>
                  <p>{selectedIssue.category}</p>
                </div>
                <span className={`helpdesk-status helpdesk-status--${selectedIssue.status.toLowerCase().replace(" ", "-")}`}>
                  {selectedIssue.status}
                </span>
              </div>

              <div className="helpdesk-detail-card">
                <span>Your Description</span>
                <p>{selectedIssue.description}</p>
              </div>

              <div className="helpdesk-meta-grid">
                <div>
                  <span>Submitted on</span>
                  <strong>{formatDate(selectedIssue.submittedAt)}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{selectedIssue.status}</strong>
                </div>
              </div>

              {selectedIssue.attachmentName && (
                <div className="helpdesk-detail-card helpdesk-file-card">
                  <i className="fas fa-paperclip"></i>
                  <div>
                    <span>Attachment</span>
                    {selectedIssue.attachmentUrl ? (
                      <a
                        href={selectedIssue.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {selectedIssue.attachmentName}
                      </a>
                    ) : (
                      <p>{selectedIssue.attachmentName}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="helpdesk-status-message">
                {selectedIssue.status === "Pending" && (
                  <p>Your request has been received. Our support team will review it shortly.</p>
                )}
                {selectedIssue.status === "In Progress" && (
                  <p>Our support team is working on your issue. You'll be notified when there's an update.</p>
                )}
                {selectedIssue.status === "Done" && (
                  <p>Your issue has been resolved.</p>
                )}
              </div>

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
                  <span>Issue Resolved</span>
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
