import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./SalesHistory.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://techiohisab.com/api";
const API = `${API_BASE}/sales`;
const SALES_PAGE_SIZE = 50;

const STATUS_MAP = {
  PACK: "Packed",
  PACKED: "Packed",
  ORDERED: "Packed",
  PICKUP: "Picked",
  PICKED: "Picked",
  DISPATCH: "Dispatched",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In Transit",
  INTRANSIT: "In Transit",
  DELIVERED: "Delivered",
  CANCEL: "Cancel",
  CANCELLED: "Cancel",
  RETURN: "Return",
  RETURN_INWARD: "Return Inward",
  RETURNINWARD: "Return Inward",
  RETURN_COMPLETED: "Return Completed",
  RETURNCOMPLETED: "Return Completed",
  SETTLEMENT_PENDING: "Settlement Pending",
  SETTLEMENTPENDING: "Settlement Pending",
  SETTLEMENT_DONE: "Settlement Done",
  SETTLEMENTDONE: "Settlement Done",
  RTO: "Return",
  DTO: "Return",
};

const normalizeStatus = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "Dispatched";
  const key = rawValue.toUpperCase().replace(/[\s-]+/g, "_");
  return STATUS_MAP[key] || rawValue;
};

const getStatusClassName = (status) => {
  switch (normalizeStatus(status)) {
    case "Packed":
    case "In Transit":
      return "sales-history-status-blue";
    case "Picked":
    case "Dispatched":
    case "Delivered":
    case "Settlement Done":
      return "sales-history-status-green";
    case "Cancel":
      return "sales-history-status-red";
    case "Return":
    case "Return Inward":
    case "Return Completed":
    case "Settlement Pending":
      return "sales-history-status-orange";
    default:
      return "sales-history-status-gray";
  }
};

const getDateKey = (value) => String(value || "").slice(0, 10);

const formatHistoryDate = (value) => {
  const dateKey = getDateKey(value);
  if (!dateKey) return "-";

  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;

  return `${day}-${month}-${year.slice(-2)}`;
};

const formatCurrency = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

const normalizeRowsPayload = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.sales)) return data.sales;
  if (Array.isArray(data?.value)) return data.value;
  return [];
};

const normalizeSaleRow = (sale, index) => ({
  ...sale,
  id: sale?.id ?? `${sale?.sales_awb_id || "sale"}-${index}`,
  platform: sale?.platform || "DIRECT",
  account_name: sale?.account_name || sale?.customer_name || "-",
  awbNumber: sale?.awb_no || sale?.awb_number || sale?.awbNumber || sale?.awb || "",
  itemLabel: String(sale?.items || "").trim() || "-",
  amount: Number(sale?.amount || 0) || 0,
  status: normalizeStatus(sale?.status || sale?.tracking_status),
});

function SalesHistory() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetchSalesHistory = async () => {
    setLoading(true);

    try {
      const res = await axios.get(API);
      console.log("Sales History API Response:", res.data);

      const nextRows = normalizeRowsPayload(res.data);
      setRows(
        (Array.isArray(nextRows) ? nextRows : []).map((sale, index) =>
          normalizeSaleRow(sale, index)
        )
      );
    } catch (error) {
      console.error("Error fetching sales history:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesHistory();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const totalPages = Math.max(1, Math.ceil(rows.length / SALES_PAGE_SIZE));
  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * SALES_PAGE_SIZE, page * SALES_PAGE_SIZE),
    [page, rows]
  );

  return (
    <div className="sales-history-page">
      <div className="sales-history-topbar">
        <div>
          <h2>Sales History</h2>
          <p>Track packed, dispatched, delivered, cancelled, and return sales.</p>
        </div>

        <div className="sales-history-topbar-actions">
          <button
            type="button"
            className="sales-history-top-btn sales-history-refresh-btn"
            onClick={fetchSalesHistory}
          >
            Refresh
          </button>
          <button
            type="button"
            className="sales-history-top-btn sales-history-back-btn"
            onClick={() => navigate("/sales")}
          >
            Back
          </button>
        </div>
      </div>

      <div className="sales-history-note">
        Showing {rows.length} sales records from the live sales API.
      </div>

      <div className="sales-history-card">
        <div className="sales-history-scroll">
          <table className="sales-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Platform</th>
                <th>Account</th>
                <th>AWB</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="sales-history-empty">
                    Loading sales history...
                  </td>
                </tr>
              ) : paginatedRows.length > 0 ? (
                paginatedRows.map((sale) => (
                  <tr key={`${sale.id}-${sale.awbNumber || sale.sale_date || "sale"}`}>
                    <td className="sales-history-date-cell">
                      {formatHistoryDate(sale.sale_date)}
                    </td>
                    <td>{sale.platform || "DIRECT"}</td>
                    <td>{sale.account_name || "-"}</td>
                    <td className="sales-history-awb-cell">{sale.awbNumber || "N/A"}</td>
                    <td className="sales-history-item-cell">{sale.itemLabel}</td>
                    <td className="sales-history-total-cell">{formatCurrency(sale.amount)}</td>
                    <td>
                      <span
                        className={`sales-history-status ${getStatusClassName(sale.status)}`}
                      >
                        {normalizeStatus(sale.status)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="sales-history-empty">
                    No sales history available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {rows.length > SALES_PAGE_SIZE && (
          <div className="sales-history-pagination">
            <button
              type="button"
              className="sales-history-pagination-btn"
              disabled={page === 1}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={`sales-history-pagination-btn ${
                  page === pageNumber ? "active" : ""
                }`}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              className="sales-history-pagination-btn"
              disabled={page === totalPages}
              onClick={() =>
                setPage((currentPage) => Math.min(totalPages, currentPage + 1))
              }
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SalesHistory;
