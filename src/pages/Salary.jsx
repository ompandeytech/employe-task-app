import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE, getAuthHeaders } from "../utils/apiConfig";
import RefreshWrapper from "../components/RefreshWrapper";

const getUserId = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user?.id ?? user?.user_id ?? user?.userId ?? user?.employee_id ?? user?.employeeId ?? null;
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatINR = (value) => `Rs ${toNumber(value).toLocaleString("en-IN")}`;

const monthLabel = (monthValue) => {
  if (!monthValue) return "-";
  const date = new Date(`${monthValue}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return monthValue;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

export default function Salary() {
  const navigate = useNavigate();
  const userId = getUserId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salaryRows, setSalaryRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  const loadSalaryData = useCallback(
    async ({ showLoader = false } = {}) => {
      if (showLoader) {
        setLoading(true);
      }
      setError("");

      if (!userId) {
        setError("Employee not logged in.");
        setSalaryRows([]);
        setHistoryRows([]);
        if (showLoader) {
          setLoading(false);
        }
        return;
      }

      try {
        const salaryRes = await axios.get(`${API_BASE}/salaries`, {
          headers: getAuthHeaders(),
        });
        const salaryPayload = Array.isArray(salaryRes.data) ? salaryRes.data : [];
        const employeeSalaries = salaryPayload.filter((item) => String(item.employee_id) === String(userId));
        setSalaryRows(employeeSalaries);

        const fallbackHistory = employeeSalaries.map((row) => ({
          id:
            row.id ??
            `salary-${String(row.employee_id)}-${row.salary_month ?? row.month ?? row.paid_on ?? "unknown"}`,
          salary_month: row.month,
          net_pay: row.net_pay,
          created_at: row.paid_on || row.month,
          employee_id: row.employee_id,
        }));
        setHistoryRows(fallbackHistory);
      } catch {
        setSalaryRows([]);
        setHistoryRows([]);
        setError("Failed to load salary data.");
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    loadSalaryData({ showLoader: true });
  }, [loadSalaryData]);

  const handleSalaryRefresh = useCallback(async () => {
    await loadSalaryData();
  }, [loadSalaryData]);

  const summary = useMemo(() => {
    const total = salaryRows.reduce((sum, row) => sum + toNumber(row.net_pay), 0);
    const paid = total;
    const current = salaryRows[0] || null;

    return { total, paid, current };
  }, [salaryRows]);

  if (loading) return <p style={{ padding: 16 }}>Loading salary...</p>;
  if (error) return <p style={{ padding: 16, color: "#dc2626" }}>{error}</p>;

  return (
    <RefreshWrapper onRefresh={handleSalaryRefresh}>
      <div style={{ padding: 16, paddingBottom: 90 }}>
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
      <h2 style={{ marginBottom: 12 }}>My Salary</h2>

      {!summary.current ? (
        <div style={{ textAlign: "center", background: "#fff", borderRadius: 12, padding: 16 }}>
          <h4>No salary generated yet</h4>
          <p>Admin has not created salary for your account yet.</p>
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: 0, color: "#64748b" }}>Current Salary ({monthLabel(summary.current.month)})</h4>
            <h1 style={{ margin: "8px 0" }}>{formatINR(summary.current.net_pay)}</h1>
            <span
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                background: "#16a34a",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Paid
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
            <div style={{ background: "#ecfeff", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, color: "#0e7490" }}>Total</div>
              <div style={{ fontWeight: 700 }}>{formatINR(summary.total)}</div>
            </div>
            <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, color: "#166534" }}>Paid</div>
              <div style={{ fontWeight: 700 }}>{formatINR(summary.paid)}</div>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
            <h4 style={{ marginTop: 0 }}>Salary History</h4>
            {salaryRows.length === 0 ? (
              <p>No salary history available.</p>
            ) : (
              salaryRows.map((row) => (
                <div
                  key={row.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{monthLabel(row.month)}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {row.paid_on
                        ? `Paid on ${new Date(row.paid_on).toLocaleDateString("en-US")}`
                        : "Paid"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{formatINR(row.net_pay)}</div>
                    <div style={{ fontSize: 12, color: "#16a34a" }}>
                      Paid
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", marginTop: 12 }}>
            <h4 style={{ marginTop: 0 }}>Admin Update History</h4>
            {historyRows.length === 0 ? (
              <p>No update history yet.</p>
            ) : (
              historyRows.slice(0, 10).map((row) => (
                <div key={row.id} style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 0" }}>
                  <div style={{ fontWeight: 600 }}>{monthLabel(row.salary_month)}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Net: {formatINR(row.net_pay)} | {new Date(row.created_at).toLocaleDateString("en-US")}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  </RefreshWrapper>
  );
}
