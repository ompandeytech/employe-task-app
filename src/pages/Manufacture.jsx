import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import rtoAPI from "../api/rtoAPI";
import Papa from "papaparse";
import { ClipboardList } from "lucide-react";
import { logEmployeeActivity } from "../utils/activityLogger";
import "./Manufacture.css";

const STATUS_META = {
  returned_mid_transit: "Returned Mid-Transit",
  to_clean: "To Clean",
  cleaned: "Cleaned",
  repair_needed: "Repair Needed",
  in_repair: "In Repair",
  repaired: "Repaired",
  repack_pending: "Repack Pending",
  repacked: "Repacked",
  qa_check: "QA Check",
  ready_for_storage: "Ready for Storage",
};

const DAMAGE_META = {
  none: "None",
  minor: "Minor",
  moderate: "Moderate",
  severe: "Severe",
  total_loss: "Total Loss",
};

const statusColor = (status) => {
  const map = {
    returned_mid_transit: "#ff7f7f",
    to_clean: "#facc15",
    cleaned: "#22c55e",
    repair_needed: "#f97316",
    in_repair: "#fb923c",
    repaired: "#16a34a",
    repack_pending: "#3b82f6",
    repacked: "#2563eb",
    qa_check: "#6366f1",
    ready_for_storage: "#6b7280",
  };
  return map[status] || "#6b7280";
};

const damageColor = (ds) => {
  const map = {
    none: "#e6f9f0",
    minor: "#fff7ed",
    moderate: "#fff3e0",
    severe: "#fff5f7",
    total_loss: "#fee2e2",
  };
  return map[ds] || "#f3f4f6";
};

const DEFAULT_FILTERS = {
  search: "",
  fromDate: "",
  toDate: "",
  damage: "all",
};

const formatInr = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Manufacture() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [manualItem, setManualItem] = useState({
    product: "",
    qty: 1,
    base_price: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const API_BASE = "/manufacture";

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await client.get(API_BASE);
      const data = Array.isArray(res.data)
        ? res.data.map((it) => ({
            ...it,
            damage_status: it.damage_status || "none",
            qty: it.qty == null ? 1 : Number(it.qty),
          }))
        : [];
      setItems(data);
    } catch (err) {
      console.error("Error fetching items:", err);
      alert("Failed to fetch batches. Check backend.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingTransfers = async () => {
    try {
      const data = await rtoAPI.getTransferRequests("manufacture");
      setPendingTransfers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load pending manufacture transfers:", error);
      setPendingTransfers([]);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchPendingTransfers();
  }, []);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const filtered = useMemo(() => {
    const fromDate = filters.fromDate;
    const toDate = filters.toDate;
    const searchTerm = filters.search.trim().toLowerCase();

    return items.filter((item) => {
      if (filters.damage !== "all" && (item.damage_status || "none") !== filters.damage) return false;

      if (fromDate && new Date(item.updatedAt) < new Date(fromDate)) return false;
      if (toDate && new Date(item.updatedAt) > new Date(`${toDate}T23:59:59`)) return false;

      if (searchTerm) {
        const joinedText = [
          item.orderid,
          item.product,
          item.notes,
          DAMAGE_META[item.damage_status || "none"],
        ]
          .join(" ")
          .toLowerCase();
        if (!joinedText.includes(searchTerm)) return false;
      }

      return true;
    });
  }, [items, filters]);

  const metrics = useMemo(() => {
    const totalQty = filtered.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const totalValue = filtered.reduce((sum, item) => sum + (Number(item.final_price) || 0), 0);
    const statusCards = Object.entries(STATUS_META).map(([key, label]) => ({
      key,
      label,
      qty: filtered.reduce(
        (sum, item) => sum + (item.status === key ? Number(item.qty) || 0 : 0),
        0
      ),
    }));
    return { totalQty, totalValue, statusCards };
  }, [filtered]);

  const handleBulkUpload = (file) => {
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        try {
          const rows = result.data;

          await client.post(`${API_BASE}/bulk`, {
            items: rows.map((r) => ({
              orderid: r.orderid,
              product: r.product,
              qty: Number(r.qty) || 1,
              base_price: Number(r.base_price) || 0,
              extra_cost: Number(r.extra_cost) || 0,
              final_price: (Number(r.base_price) || 0) + (Number(r.extra_cost) || 0),
              damage_status: r.damage_status || "none",
              status: r.status || "returned_mid_transit",
              notes: r.notes || "",
            })),
          });

          alert("Bulk upload successful");
          fetchItems();
        } catch (error) {
          alert("Bulk upload failed");
          console.error(error);
        }
      },
    });
  };

  const resetManualItem = () => {
    setManualItem({
      product: "",
      qty: 1,
      base_price: "",
      date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
  };

  const createManualItem = async () => {
    if (!manualItem.product.trim()) {
      alert("Product name required");
      return;
    }

    if (!Number.isFinite(Number(manualItem.qty)) || Number(manualItem.qty) <= 0) {
      alert("Quantity must be greater than 0");
      return;
    }

    if (!Number.isFinite(Number(manualItem.base_price)) || Number(manualItem.base_price) < 0) {
      alert("Base price must be valid");
      return;
    }

    const qty = Number(manualItem.qty);
    const basePricePerUnit = Number(manualItem.base_price);
    const totalPrice = qty * basePricePerUnit;
    const generatedOrderId = `MANUAL-${manualItem.date}-${Date.now()}`;

    try {
      setCreating(true);
      await client.post(API_BASE, {
        orderid: generatedOrderId,
        product: manualItem.product.trim(),
        qty,
        base_price: basePricePerUnit,
        extra_cost: 0,
        final_price: totalPrice,
        damage_status: "none",
        status: "returned_mid_transit",
        notes: manualItem.notes?.trim() || "",
        date: manualItem.date,
        entry_date: manualItem.date,
      });
      await fetchItems();
      resetManualItem();
      alert("Returned batch added successfully");
    } catch (error) {
      console.error("Error creating manual manufacture item:", error);
      alert("Failed to add returned batch");
    } finally {
      setCreating(false);
    }
  };

  const updateField = async (id, payload, optimisticFn) => {
    try {
      if (optimisticFn) optimisticFn();
      await client.put(`${API_BASE}/${id}`, payload);
    } catch (err) {
      console.error("Error updating item:", err);
      alert("Update failed. Check console.");
      await fetchItems();
    }
  };

  const updateStatus = (id, status) => {
    updateField(id, { status }, () =>
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
    );
  };

  const updateNotes = (id, notes) => {
    updateField(id, { notes }, () =>
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, notes } : item)))
    );
  };

  const updateDamageStatus = (id, damage_status) => {
    updateField(id, { damage_status }, () =>
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, damage_status } : item)))
    );
  };

  const handleAcceptTransfer = async (transferId) => {
    try {
      setTransferLoading(true);
      await rtoAPI.acceptTransfer(transferId, "manufacture");
      alert("Successfully moved to Manufacture table");
      await Promise.all([fetchPendingTransfers(), fetchItems()]);
    } catch (error) {
      console.error("Accept transfer failed:", error);
      alert("Failed to accept transfer");
    } finally {
      setTransferLoading(false);
    }
  };

  const handleRejectTransfer = async (transferId) => {
    try {
      setTransferLoading(true);
      await rtoAPI.rejectTransfer(transferId, "manufacture");
      alert("Canceled");
      await fetchPendingTransfers();
    } catch (error) {
      console.error("Reject transfer failed:", error);
      alert("Failed to reject transfer");
    } finally {
      setTransferLoading(false);
    }
  };

  const handleAcceptAllTransfers = async () => {
    if (pendingTransfers.length === 0) return;
    try {
      setTransferLoading(true);
      const result = await rtoAPI.acceptAllTransfers("manufacture");
      alert(result?.message || "All transfers accepted");
      await Promise.all([fetchPendingTransfers(), fetchItems()]);
    } catch (error) {
      console.error("Accept all failed:", error);
      alert("Failed to accept all transfers");
    } finally {
      setTransferLoading(false);
    }
  };

  const summaryCards = useMemo(
    () => [{ key: "total_units", label: "Total Units", qty: metrics.totalQty }, ...metrics.statusCards],
    [metrics]
  );

  return (
    <div className="manufacturing-container page-container">
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="page-head">
        <h2>Manufacturing - Returned Batches</h2>
        <div className="manufacture-top-actions">
          <div className="transfer-banner">
            <button className="btn primary" onClick={() => setShowTransferModal(true)}>
              Accept RTO Transfers ({pendingTransfers.length})
            </button>
          </div>
          <div className="controls">
            <button className="btn outline" onClick={fetchItems} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="manufacture-summary-row">
        {summaryCards.map((card) => (
          <div
            key={card.key}
            className={`manufacture-summary-card ${card.key === "total_units" ? "is-total" : ""}`}
          >
            <div className="manufacture-summary-label">{card.label}</div>
            <div className="manufacture-summary-value">{card.qty}</div>
          </div>
        ))}
      </div>

      <div className="manufacture-filters-card">
        <div className="manufacture-filters-grid">
          <input
            className="filter-input manufacture-search"
            placeholder="Search order, product, notes"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
          />
          <select
            className="filter-input"
            value={filters.damage}
            onChange={(e) => updateFilter("damage", e.target.value)}
          >
            <option value="all">All Damage Levels</option>
            {Object.entries(DAMAGE_META).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="filter-input"
            value={filters.fromDate}
            onChange={(e) => updateFilter("fromDate", e.target.value)}
          />
          <input
            type="date"
            className="filter-input"
            value={filters.toDate}
            onChange={(e) => updateFilter("toDate", e.target.value)}
          />
          <button className="btn outline manufacture-filter-clear" onClick={clearAllFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      <div className="form-card">
        <div className="form-card-head">
          <h3>
            <ClipboardList size={18} /> Upload Returned Batch
          </h3>
        </div>
        <div className="manual-entry-panel">
          <div className="manual-entry-head">
            <h4>Manual Add</h4>
            <p>
              Base price ko single quantity ka price maana jayega. Total automatically quantity x
              base price se calculate hoga.
            </p>
          </div>
          <div className="manual-entry-grid">
            <input
              placeholder="Product Name"
              value={manualItem.product}
              onChange={(e) => setManualItem((prev) => ({ ...prev, product: e.target.value }))}
              disabled={creating}
            />
            <input
              type="number"
              min="1"
              placeholder="Quantity"
              value={manualItem.qty}
              onChange={(e) => setManualItem((prev) => ({ ...prev, qty: e.target.value }))}
              disabled={creating}
            />
            <input
              type="number"
              min="0"
              placeholder="Base Price Per Unit (Rs.)"
              value={manualItem.base_price}
              onChange={(e) => setManualItem((prev) => ({ ...prev, base_price: e.target.value }))}
              disabled={creating}
            />
            <input
              type="date"
              value={manualItem.date}
              onChange={(e) => setManualItem((prev) => ({ ...prev, date: e.target.value }))}
              disabled={creating}
            />
            <input
              className="manual-entry-notes"
              placeholder="Notes"
              value={manualItem.notes}
              onChange={(e) => setManualItem((prev) => ({ ...prev, notes: e.target.value }))}
              disabled={creating}
            />
            <div className="manual-entry-total">
              Total Value: Rs.{formatInr((Number(manualItem.qty) || 0) * (Number(manualItem.base_price) || 0))}
            </div>
          </div>
          <div className="manual-entry-actions">
            <button className="btn primary" onClick={createManualItem} disabled={creating}>
              {creating ? "Adding..." : "Add Batch"}
            </button>
            <button className="btn outline" onClick={resetManualItem} disabled={creating}>
              Reset
            </button>
          </div>
        </div>
        <div className="upload-only-panel">
          <div className="upload-only-field">
            <input type="file" accept=".csv" onChange={(e) => handleBulkUpload(e.target.files[0])} />
          </div>
        </div>
      </div>

      <div className="table-card">
        <table className="manufacturing-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Cost</th>
              <th>Damage Level</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: 18 }}>
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: 18 }}>
                  No batches found
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.orderid}</td>
                  <td>{item.product}</td>
                  <td>{item.qty}</td>
                  <td>
                    <div>Base: Rs.{formatInr(item.base_price || 0)}</div>
                    <div>Repair: Rs.{formatInr(item.extra_cost || 0)}</div>
                    <strong>Total: Rs.{formatInr(item.final_price || 0)}</strong>
                  </td>
                  <td>
                    <select
                      value={item.damage_status || "none"}
                      onChange={(e) => updateDamageStatus(item.id, e.target.value)}
                    >
                      {Object.entries(DAMAGE_META).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <div
                      className="status-pill"
                      style={{
                        background: damageColor(item.damage_status || "none"),
                        color: "#111827",
                        marginTop: 6,
                      }}
                    >
                      {DAMAGE_META[item.damage_status || "none"]}
                    </div>
                  </td>
                  <td>
                    <select value={item.status} onChange={(e) => updateStatus(item.id, e.target.value)}>
                      {Object.entries(STATUS_META).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <div
                      className="status-pill"
                      style={{ background: statusColor(item.status), color: "#fff", marginTop: 6 }}
                    >
                      {STATUS_META[item.status]}
                    </div>
                  </td>
                  <td>
                    <input
                      value={item.notes || ""}
                      onBlur={(e) => updateNotes(item.id, e.target.value)}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row) => (row.id === item.id ? { ...row, notes: e.target.value } : row))
                        )
                      }
                      placeholder="Notes"
                    />
                  </td>
                  <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString("en-IN") : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showTransferModal && (
        <div className="modal-overlay">
          <div className="modal-card transfer-modal">
            <div className="modal-header">
              <h3>Pending Manufacture Transfers</h3>
              <button className="btn outline" onClick={() => setShowTransferModal(false)}>
                Close
              </button>
            </div>
            <div className="transfer-actions">
              <button
                className="btn primary"
                onClick={handleAcceptAllTransfers}
                disabled={transferLoading || pendingTransfers.length === 0}
              >
                {transferLoading ? "Processing..." : "Accept All"}
              </button>
            </div>
            <div className="transfer-table-wrap">
              <table className="manufacturing-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Value</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTransfers.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: 16 }}>
                        No pending transfers
                      </td>
                    </tr>
                  ) : (
                    pendingTransfers.map((request) => (
                      <tr key={request.id}>
                        <td>{request.orderId}</td>
                        <td>{request?.payload?.productName || "-"}</td>
                        <td>{request?.payload?.qty || 1}</td>
                        <td>Rs.{formatInr(request?.payload?.value || 0)}</td>
                        <td style={{ display: "flex", gap: 8 }}>
                          <button
                            className="btn primary"
                            onClick={() => handleAcceptTransfer(request.id)}
                            disabled={transferLoading}
                          >
                            Accept
                          </button>
                          <button
                            className="btn outline"
                            onClick={() => handleRejectTransfer(request.id)}
                            disabled={transferLoading}
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
