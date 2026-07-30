import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import rtoAPI from "../api/rtoAPI";
import Papa from "papaparse";
import { ClipboardList, Send, X } from "lucide-react";
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
  total_loss: "Total Loss",
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
    total_loss: "#dc2626",
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
  status: "all",
};
const MANUFACTURE_SEARCH_STORAGE_KEY = "manufacture_search_suggestions";
const MANUFACTURE_HISTORY_STORAGE_KEY = "manufacture_status_update_history";

const loadSearchSuggestions = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(MANUFACTURE_SEARCH_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 15) : [];
  } catch {
    return [];
  }
};

const loadManufactureHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(MANUFACTURE_HISTORY_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 250) : [];
  } catch {
    return [];
  }
};

const getCurrentUserName = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.name || user.email || "Admin";
  } catch {
    return "Admin";
  }
};

const formatInr = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function SearchableSelect({
  options,
  value,
  onChange,
  getOptionLabel,
  getOptionValue,
  placeholder,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const controlRef = useRef(null);

  const selected = options.find((option) => String(getOptionValue(option)) === String(value));
  const label = selected ? getOptionLabel(selected) : placeholder || "Select";
  const filteredOptions = query
    ? options.filter((option) =>
        String(getOptionLabel(option)).toLowerCase().includes(String(query).toLowerCase())
      )
    : options;

  useEffect(() => {
    const updatePos = () => {
      if (!controlRef.current) return;
      const rect = controlRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };

    if (open) {
      updatePos();
      window.addEventListener("scroll", updatePos, true);
      window.addEventListener("resize", updatePos);
    }

    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  return (
    <div className="searchable-select">
      <button
        type="button"
        ref={controlRef}
        className="ss-control"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="ss-label">{label}</span>
        <span className="ss-caret">v</span>
      </button>
      {open &&
        createPortal(
          <div
            className="ss-menu manufacture-ss-menu"
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              zIndex: 9999,
            }}
          >
            <input
              className="ss-search"
              placeholder="Search product..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="ss-options">
              {filteredOptions.map((option) => (
                <div
                  key={getOptionValue(option)}
                  className="ss-option"
                  onClick={() => {
                    onChange(getOptionValue(option));
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {getOptionLabel(option)}
                </div>
              ))}
              {filteredOptions.length === 0 && <div className="ss-empty">No match</div>}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function Manufacture() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState(loadSearchSuggestions);
  const [selectedIds, setSelectedIds] = useState([]);
  const [moveQuantities, setMoveQuantities] = useState({});
  const [bulkStatus, setBulkStatus] = useState("cleaned");
  const [bulkMoving, setBulkMoving] = useState(false);
  const [lastBulkMove, setLastBulkMove] = useState(null);
  const [statusHistory, setStatusHistory] = useState(loadManufactureHistory);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [showAddBatchMobile, setShowAddBatchMobile] = useState(false);
  const [addBatchTab, setAddBatchTab] = useState("manual");
  const [manualItem, setManualItem] = useState({
    product: "",
    qty: 1,
    base_price: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const API_BASE = "/manufacture";
  const currentUserName = getCurrentUserName();

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

  const fetchStatusHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await client.get(`${API_BASE}/history/updates`);
      const rows = Array.isArray(res.data) ? res.data : [];
      setStatusHistory(rows);
      localStorage.setItem(MANUFACTURE_HISTORY_STORAGE_KEY, JSON.stringify(rows));
    } catch (error) {
      console.error("Failed to load manufacture history:", error);
      setStatusHistory(loadManufactureHistory());
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchPendingTransfers();
    fetchStatusHistory();
  }, []);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const rememberSearchSuggestion = (value) => {
    const term = String(value || "").trim();
    if (term.length < 2) return;

    setSearchSuggestions((prev) => {
      const next = [term, ...prev.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 15);
      localStorage.setItem(MANUFACTURE_SEARCH_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleSearchChange = (value) => {
    updateFilter("search", value);
    rememberSearchSuggestion(value);
  };

  const clearAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const addStatusHistory = (entries) => {
    const nextEntries = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
    if (nextEntries.length === 0) return;

    setStatusHistory((prev) => {
      const next = [...nextEntries, ...prev].slice(0, 250);
      localStorage.setItem(MANUFACTURE_HISTORY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const filtered = useMemo(() => {
    const fromDate = filters.fromDate;
    const toDate = filters.toDate;
    const searchTerm = filters.search.trim().toLowerCase();

    return items.filter((item) => {
      if (filters.damage !== "all" && (item.damage_status || "none") !== filters.damage) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;

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

  const selectedBulkItem = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return items.find((item) => String(item.id) === String(selectedIds[0])) || null;
  }, [items, selectedIds]);

  const handleBulkUpload = (file) => {
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        try {
          const rows = result.data;

          await client.post(`${API_BASE}/bulk`, {
            updated_by: currentUserName,
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
          Promise.all([fetchItems(), fetchStatusHistory()]);
          try {
            logEmployeeActivity("manufacture_csv_upload", {
              user: currentUserName,
              source: "manufacture",
            });
          } catch (logError) {
            console.error("Activity logging failed:", logError);
          }
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
        updated_by: currentUserName,
        source_location: "Manual Add",
      });
      await Promise.all([fetchItems(), fetchStatusHistory()]);
      resetManualItem();
      alert("Returned batch added successfully");
      try {
        logEmployeeActivity("manufacture_manual_add", {
          user: currentUserName,
          orderId: generatedOrderId,
          product: manualItem.product.trim(),
          qty,
          source: "manufacture",
        });
      } catch (logError) {
        console.error("Activity logging failed:", logError);
      }
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
      await client.put(`${API_BASE}/${id}`, { ...payload, updated_by: currentUserName });
      return true;
    } catch (err) {
      console.error("Error updating item:", err);
      alert("Update failed. Check console.");
      await fetchItems();
      return false;
    }
  };

  const updateStatus = async (id, status) => {
    const currentItem = items.find((item) => item.id === id);
    const previousStatus = currentItem?.status;
    if (!currentItem || previousStatus === status) return;

    const updated = await updateField(id, { status }, () =>
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
    );
    if (!updated) return;

    addStatusHistory({
      id: `${Date.now()}-${id}`,
      at: new Date().toISOString(),
      user: getCurrentUserName(),
      action: "Status Update",
      orderid: currentItem.orderid || "-",
      product: currentItem.product || "-",
      qty: currentItem.qty || 0,
      fromStatus: previousStatus,
      toStatus: status,
    });
    try {
      logEmployeeActivity("manufacture_status_update", {
        user: currentUserName,
        orderId: currentItem.orderid,
        product: currentItem.product,
        qty: currentItem.qty,
        status,
        source: "manufacture",
      });
    } catch (logError) {
      console.error("Activity logging failed:", logError);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((rowId) => rowId !== id);
      const item = items.find((row) => row.id === id);
      setMoveQuantities((qtyPrev) => ({ ...qtyPrev, [id]: Number(item?.qty || 1) }));
      return [...prev, id];
    });
  };

  const toggleAllFiltered = () => {
    const visibleIds = filtered.map((item) => item.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) =>
      allVisibleSelected
        ? prev.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...prev, ...visibleIds]))
    );
    if (!allVisibleSelected) {
      setMoveQuantities((prev) => {
        const next = { ...prev };
        filtered.forEach((item) => {
          if (next[item.id] == null) next[item.id] = Number(item.qty || 1);
        });
        return next;
      });
    }
  };

  const updateMoveQuantity = (id, value) => {
    const item = items.find((row) => row.id === id);
    const maxQty = Number(item?.qty || 0);
    const numericValue = Math.max(1, Math.min(Number(value || 1), maxQty || 1));
    setMoveQuantities((prev) => ({ ...prev, [id]: numericValue }));
  };

  const handleBulkProductSelect = (id) => {
    const item = items.find((row) => String(row.id) === String(id));
    if (!item) {
      setSelectedIds([]);
      setMoveQuantities({});
      return;
    }

    setSelectedIds([item.id]);
    setMoveQuantities({ [item.id]: Number(item.qty || 1) });
  };

  const handleBulkMove = async () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one batch.");
      return;
    }

    const selectedItems = items.filter((item) => selectedIds.includes(item.id));
    const invalidItem = selectedItems.find((item) => {
      const moveQty = Number(moveQuantities[item.id] || item.qty || 0);
      return moveQty <= 0 || moveQty > Number(item.qty || 0);
    });
    if (invalidItem) {
      alert("Move quantity must be greater than 0 and less than/equal to available quantity.");
      return;
    }

    const changes = selectedItems.map((item) => ({
      id: item.id,
      orderid: item.orderid || "-",
      product: item.product || "-",
      qty: item.qty || 0,
      movedQty: Number(moveQuantities[item.id] || item.qty || 0),
      previousStatus: item.status,
    }));

    try {
      setBulkMoving(true);
      const moveResponses = await Promise.all(
        changes.map((change) =>
          client.put(`${API_BASE}/${change.id}`, {
            status: bulkStatus,
            moved_qty: change.movedQty,
            updated_by: currentUserName,
            history_action: "Bulk Move",
            destination_location: bulkStatus,
          })
        )
      );
      const trackedChanges = changes.map((change, index) => ({
        ...change,
        movedItemId: moveResponses[index]?.data?.moved?.id || null,
        remainingQty: moveResponses[index]?.data?.remaining?.qty ?? null,
      }));
      setLastBulkMove({ changes: trackedChanges, movedTo: bulkStatus });
      addStatusHistory(
        trackedChanges.map((change) => ({
          id: `${Date.now()}-${change.id}-bulk`,
          at: new Date().toISOString(),
          user: getCurrentUserName(),
          action: "Bulk Move",
          orderid: change.orderid,
          product: change.product,
          qty: change.qty,
          moved_qty: change.movedQty,
          fromStatus: change.previousStatus,
          toStatus: bulkStatus,
        }))
      );
      setSelectedIds([]);
      setMoveQuantities({});
      await Promise.all([fetchItems(), fetchStatusHistory()]);
      const totalMoved = trackedChanges.reduce((sum, change) => sum + Number(change.movedQty || 0), 0);
      alert(`Moved ${totalMoved} qty to ${STATUS_META[bulkStatus]}.`);
      try {
        logEmployeeActivity("manufacture_bulk_move", {
          user: currentUserName,
          selectedCount: selectedIds.length,
          status: bulkStatus,
          source: "manufacture",
        });
      } catch (logError) {
        console.error("Activity logging failed:", logError);
      }
    } catch (err) {
      console.error("Bulk status update failed:", err);
      alert("Bulk move failed. Restoring latest data.");
      await fetchItems();
    } finally {
      setBulkMoving(false);
    }
  };

  const handleRestoreBulkMove = async () => {
    if (!lastBulkMove?.changes?.length) return;

    try {
      setBulkMoving(true);
      await Promise.all(
        lastBulkMove.changes.map(async (change) => {
          if (change.movedItemId) {
            const original = items.find((item) => item.id === change.id);
            const restoredQty = Number(original?.qty || change.remainingQty || 0) + Number(change.movedQty || 0);
            await client.put(`${API_BASE}/${change.id}`, {
              qty: restoredQty,
              status: change.previousStatus,
              updated_by: currentUserName,
              history_action: "Restore",
              moved_qty: change.movedQty,
              source_location: lastBulkMove.movedTo,
              destination_location: change.previousStatus,
            });
            await client.delete(`${API_BASE}/${change.movedItemId}`);
            return;
          }

          await client.put(`${API_BASE}/${change.id}`, {
            status: change.previousStatus,
            updated_by: currentUserName,
            history_action: "Restore",
            moved_qty: change.movedQty,
            source_location: lastBulkMove.movedTo,
            destination_location: change.previousStatus,
          });
        })
      );
      addStatusHistory(
        lastBulkMove.changes.map((change) => ({
          id: `${Date.now()}-${change.id}-restore`,
          at: new Date().toISOString(),
          user: getCurrentUserName(),
          action: "Restore",
          orderid: change.orderid,
          product: change.product,
          qty: change.qty,
          moved_qty: change.movedQty,
          fromStatus: lastBulkMove.movedTo,
          toStatus: change.previousStatus,
        }))
      );
      setLastBulkMove(null);
      await Promise.all([fetchItems(), fetchStatusHistory()]);
      alert("Last bulk move restored.");
      try {
        logEmployeeActivity("manufacture_restore", {
          user: currentUserName,
          selectedCount: lastBulkMove.changes.length,
          source: "manufacture",
        });
      } catch (logError) {
        console.error("Activity logging failed:", logError);
      }
    } catch (err) {
      console.error("Bulk restore failed:", err);
      alert("Restore failed. Refreshing latest data.");
      await fetchItems();
    } finally {
      setBulkMoving(false);
    }
  };

  const updateNotes = (id, notes) => {
    updateField(id, { notes }, () =>
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, notes } : item)))
    ).then((success) => {
      if (success) {
        const item = items.find((i) => i.id === id);
        try {
          logEmployeeActivity("manufacture_notes_update", {
            user: currentUserName,
            orderId: item?.orderid,
            product: item?.product,
            source: "manufacture",
          });
        } catch (logError) {
          console.error("Activity logging failed:", logError);
        }
      }
    });
  };

  const updateDamageStatus = (id, damage_status) => {
    updateField(id, { damage_status }, () =>
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, damage_status } : item)))
    ).then((success) => {
      if (success) {
        const item = items.find((i) => i.id === id);
        try {
          logEmployeeActivity("manufacture_damage_update", {
            user: currentUserName,
            orderId: item?.orderid,
            product: item?.product,
            damage: damage_status,
            source: "manufacture",
          });
        } catch (logError) {
          console.error("Activity logging failed:", logError);
        }
      }
    });
  };

  const handleShareSelected = async () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one batch to share.");
      return;
    }

    const selectedItems = items.filter((item) => selectedIds.includes(item.id));
    const shareText = selectedItems
      .map(
        (item) =>
          `Order: ${item.orderid || "-"} | Product: ${item.product || "-"} | Qty: ${item.qty || 0} | Status: ${
            STATUS_META[item.status] || item.status
          } | Damage: ${DAMAGE_META[item.damage_status || "none"]}`
      )
      .join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Manufacture Batches",
          text: shareText,
        });
        return;
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      alert("Batch details copied to clipboard");
    } catch (err) {
      console.error("Clipboard write failed:", err);
      setShowShareModal(true);
    }
  };

  const handleShareToInventory = async () => {
    if (selectedIds.length === 0) {
      setShowShareModal(false);
      return;
    }

    try {
      setShareLoading(true);
      const response = await client.post(`${API_BASE}/share/inventory`, {
        itemIds: selectedIds,
        updated_by: getCurrentUserName(),
      });
      const movedCount = Number(response?.data?.movedCount || selectedIds.length);
      setSelectedIds([]);
      setMoveQuantities({});
      setShowShareModal(false);
      await Promise.all([fetchItems(), fetchStatusHistory()]);
      alert(`Sent ${movedCount} item(s) to inventory.`);
      try {
        logEmployeeActivity("manufacture_share", {
          user: currentUserName,
          selectedCount: selectedIds.length,
          source: "manufacture",
        });
      } catch (logError) {
        console.error("Activity logging failed:", logError);
      }
    } catch (error) {
      console.error("Share to inventory failed:", error);
      alert("Failed to send selected items to inventory.");
    } finally {
      setShareLoading(false);
    }
  };

  const handleAcceptTransfer = async (transferId) => {
    try {
      setTransferLoading(true);
      await rtoAPI.acceptTransfer(transferId, "manufacture");
      alert("Successfully moved to Manufacture table");
      await Promise.all([fetchPendingTransfers(), fetchItems(), fetchStatusHistory()]);
      try {
        logEmployeeActivity("manufacture_rto_accept", {
          user: currentUserName,
          source: "manufacture",
        });
      } catch (logError) {
        console.error("Activity logging failed:", logError);
      }
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
      try {
        logEmployeeActivity("manufacture_rto_reject", {
          user: currentUserName,
          source: "manufacture",
        });
      } catch (logError) {
        console.error("Activity logging failed:", logError);
      }
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
      await Promise.all([fetchPendingTransfers(), fetchItems(), fetchStatusHistory()]);
      try {
        logEmployeeActivity("manufacture_rto_accept_all", {
          user: currentUserName,
          selectedCount: pendingTransfers.length,
          source: "manufacture",
        });
      } catch (logError) {
        console.error("Activity logging failed:", logError);
      }
    } catch (error) {
      console.error("Accept all failed:", error);
      alert("Failed to accept all transfers");
    } finally {
      setTransferLoading(false);
    }
  };

  const summaryCards = useMemo(
    () => [{ key: "all", label: "Total Units", qty: metrics.totalQty }, ...metrics.statusCards],
    [metrics]
  );

  const handleGoToDashboard = () => {
    logEmployeeActivity("manufacture_dashboard_navigation", {
      user: currentUserName,
      source: "manufacture",
    });
    navigate("/", { replace: true });
  };

  return (
    <div className="manufacturing-container page-container">
      <div className="page-head">
        <div className="manufacture-header-content">
          <h1>Manufacture</h1>
          <p className="manufacture-header-subtitle">Manage returned batches, track status movements, and process inventory transfers</p>
        </div>
        <div className="manufacture-header-toolbar">
          <button className="btn manufacture-header-btn" onClick={handleGoToDashboard}>
            Dashboard
          </button>
          <button className="btn manufacture-header-btn" onClick={() => setShowHistoryModal(true)}>
            History
          </button>
          <button className="btn primary manufacture-header-btn" onClick={() => setShowTransferModal(true)}>
            Accept RTO Transfers ({pendingTransfers.length})
          </button>
          <button className="btn manufacture-header-btn" onClick={fetchItems} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="manufacture-summary-row">
        {summaryCards.map((card) => (
          <button
            type="button"
            key={card.key}
            className={`manufacture-summary-card ${card.key === "all" ? "is-total" : ""} ${
              filters.status === card.key ? "is-active" : ""
            }`}
            onClick={() => updateFilter("status", card.key)}
          >
            <div className="manufacture-summary-label">{card.label}</div>
            <div className="manufacture-summary-value">{card.qty}</div>
          </button>
        ))}
      </div>

      <div className="manufacture-filters-card">
        <div className="manufacture-filters-grid">
          <input
            className="filter-input manufacture-search"
            placeholder="Search order, product, notes"
            list="manufacture-search-suggestions"
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onBlur={(e) => rememberSearchSuggestion(e.target.value)}
          />
          <datalist id="manufacture-search-suggestions">
            {searchSuggestions.map((term) => (
              <option key={term} value={term} />
            ))}
          </datalist>
          <button className="btn outline filter-trigger" onClick={() => setShowFilterDrawer(true)}>
            Filters
            {(filters.damage !== "all" || filters.status !== "all" || filters.fromDate || filters.toDate) && (
              <span className="filter-badge">•</span>
            )}
          </button>
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
          <select
            className="filter-input"
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_META).map(([key, value]) => (
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

      {showFilterDrawer && (
        <>
          <div className="filter-drawer-overlay" onClick={() => setShowFilterDrawer(false)} />
          <div className="filter-drawer">
            <div className="filter-drawer-header">
              <h3>Filters</h3>
              <button className="btn outline filter-close-btn" onClick={() => setShowFilterDrawer(false)}>
                Close
              </button>
            </div>
            <div className="filter-drawer-body">
              <div className="filter-section">
                <div className="filter-section-title">Damage Level</div>
                <div className="filter-grid">
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
                </div>
              </div>
              <div className="filter-section">
                <div className="filter-section-title">Status</div>
                <div className="filter-grid">
                  <select
                    className="filter-input"
                    value={filters.status}
                    onChange={(e) => updateFilter("status", e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    {Object.entries(STATUS_META).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="filter-section">
                <div className="filter-section-title">Date Range</div>
                <div className="filter-grid two-col">
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
                </div>
              </div>
            </div>
            <div className="filter-drawer-footer">
              <button className="btn outline" onClick={clearAllFilters}>
                Clear
              </button>
              <button className="btn primary" onClick={() => setShowFilterDrawer(false)}>
                Apply
              </button>
            </div>
          </div>
        </>
      )}

      <div className="manufacture-bulk-card">
        <div className="manufacture-bulk-grid">
          <div className="manufacture-bulk-column">
            <label className="manufacture-bulk-label">Product</label>
            <SearchableSelect
              options={filtered}
              value={selectedBulkItem?.id || ""}
              onChange={handleBulkProductSelect}
              getOptionLabel={(item) =>
                `${item.product || "Unnamed Product"}${item.orderid ? ` - ${item.orderid}` : ""} (Qty: ${item.qty || 0})`
              }
              getOptionValue={(item) => String(item.id)}
              placeholder="Select product to move"
              className="manufacture-bulk-select"
            />
            {selectedIds.length > 0 && (
              <div className="manufacture-quantity-box">
                <label className="manufacture-bulk-label">Move Quantity</label>
                <div className="manufacture-quantity-list">
                  {selectedIds.map((id) => {
                    const item = items.find((row) => row.id === id);
                    if (!item) return null;
                    return (
                      <label key={id} className="manufacture-quantity-field">
                        <strong>{item.orderid || item.product}</strong>
                        <div className="manufacture-qty-control">
                          <input
                            type="number"
                            min="1"
                            max={Number(item.qty || 1)}
                            value={moveQuantities[id] ?? Number(item.qty || 1)}
                            onChange={(e) => updateMoveQuantity(id, e.target.value)}
                          />
                          <small>Total {item.qty}</small>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="manufacture-bulk-column">
            <label className="manufacture-bulk-label">Move To</label>
            <select
              className="manufacture-bulk-select"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              disabled={bulkMoving}
            >
              {Object.entries(STATUS_META).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
            {selectedBulkItem && (
              <div className="manufacture-current-status">
                <label className="manufacture-bulk-label">Current Status</label>
                <div className="manufacture-status-badge" style={{ background: statusColor(selectedBulkItem.status) }}>
                  {STATUS_META[selectedBulkItem.status] || selectedBulkItem.status || "-"}
                </div>
              </div>
            )}
          </div>

          <div className="manufacture-bulk-column">
            <label className="manufacture-bulk-label">Selected Items</label>
            <div className="manufacture-selected-card">
              <div className="manufacture-selected-count">{selectedIds.length}</div>
              <div className="manufacture-selected-label">items selected</div>
            </div>
          </div>
        </div>

        <div className="manufacture-bulk-actions">
          <button className="btn manufacture-bulk-btn" onClick={handleBulkMove} disabled={bulkMoving || selectedIds.length === 0}>
            {bulkMoving ? "Moving..." : "Move Selected"}
          </button>
          <button className="btn manufacture-bulk-btn" onClick={handleRestoreBulkMove} disabled={bulkMoving || !lastBulkMove}>
            Restore
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

      <div className="manufacture-add-batch-mobile">
        <button
          className="manufacture-add-batch-mobile-toggle"
          onClick={() => setShowAddBatchMobile(!showAddBatchMobile)}
        >
          <ClipboardList size={18} />
          {showAddBatchMobile ? "▼" : "▶"} Upload Returned Batch
        </button>
        {showAddBatchMobile && (
          <div className="manufacture-add-batch-mobile-content">
            <div className="manufacture-add-batch-tabs">
              <button
                className={`manufacture-add-batch-tab ${addBatchTab === "manual" ? "is-active" : ""}`}
                onClick={() => setAddBatchTab("manual")}
              >
                Manual
              </button>
              <button
                className={`manufacture-add-batch-tab ${addBatchTab === "csv" ? "is-active" : ""}`}
                onClick={() => setAddBatchTab("csv")}
              >
                CSV Upload
              </button>
            </div>
            {addBatchTab === "manual" && (
              <div className="manufacture-add-batch-manual">
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
            )}
            {addBatchTab === "csv" && (
              <div className="manufacture-add-batch-csv">
                <div className="upload-only-field">
                  <input type="file" accept=".csv" onChange={(e) => handleBulkUpload(e.target.files[0])} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="table-card">
        <div className="manufacture-table-head">
          <div>
            <h3>Returned Batch Table</h3>
            <p>Update damage level, workflow status, and notes from one clean structured table.</p>
          </div>
          <div className="manufacture-table-actions">
            <span>{selectedIds.length} of {filtered.length} selected</span>
            <button className="btn primary" onClick={handleShareSelected} disabled={shareLoading}>
              <Send size={16} />
              Share
            </button>
          </div>
        </div>
        <table className="manufacturing-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id))}
                  onChange={toggleAllFiltered}
                  aria-label="Select all filtered batches"
                />
              </th>
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
                <td colSpan="9" style={{ textAlign: "center", padding: 18 }}>
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: "center", padding: 18 }}>
                  No batches found
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                      aria-label={`Select ${item.orderid || item.product || "batch"}`}
                    />
                  </td>
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

        <div className="manufacture-mobile-cards">
          {loading ? (
            <div className="manufacture-mobile-loading">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="manufacture-mobile-empty">No batches found</div>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className="manufacture-mobile-card">
                <div className="manufacture-mobile-card-header">
                  <label className="manufacture-mobile-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                    />
                  </label>
                  <div className="manufacture-mobile-card-info">
                    <div className="manufacture-mobile-order">{item.orderid || "-"}</div>
                    <div className="manufacture-mobile-product">{item.product || "-"}</div>
                  </div>
                  <button
                    className="manufacture-mobile-expand-btn"
                    onClick={() => setExpandedCardId(expandedCardId === item.id ? null : item.id)}
                  >
                    {expandedCardId === item.id ? "▼" : "▶"}
                  </button>
                </div>
                <div className="manufacture-mobile-card-body">
                  <div className="manufacture-mobile-meta">
                    <span className="manufacture-mobile-qty">Qty: {item.qty || 0}</span>
                    <div
                      className="manufacture-mobile-status-pill"
                      style={{ background: statusColor(item.status), color: "#fff" }}
                    >
                      {STATUS_META[item.status] || item.status}
                    </div>
                    <div
                      className="manufacture-mobile-damage-pill"
                      style={{ background: damageColor(item.damage_status || "none"), color: "#111827" }}
                    >
                      {DAMAGE_META[item.damage_status || "none"]}
                    </div>
                  </div>
                  <div className="manufacture-mobile-updated">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString("en-IN") : "-"}
                  </div>
                </div>
                {expandedCardId === item.id && (
                  <div className="manufacture-mobile-card-expanded">
                    <div className="manufacture-mobile-detail-row">
                      <span>Base Price:</span>
                      <strong>Rs.{formatInr(item.base_price || 0)}</strong>
                    </div>
                    <div className="manufacture-mobile-detail-row">
                      <span>Repair Cost:</span>
                      <strong>Rs.{formatInr(item.extra_cost || 0)}</strong>
                    </div>
                    <div className="manufacture-mobile-detail-row">
                      <span>Total:</span>
                      <strong>Rs.{formatInr(item.final_price || 0)}</strong>
                    </div>
                    <div className="manufacture-mobile-detail-row">
                      <span>Notes:</span>
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
                    </div>
                    <div className="manufacture-mobile-detail-row">
                      <span>Status:</span>
                      <select value={item.status} onChange={(e) => updateStatus(item.id, e.target.value)}>
                        {Object.entries(STATUS_META).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="manufacture-mobile-detail-row">
                      <span>Damage:</span>
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
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="manufacture-mobile-action-bar">
          <div className="manufacture-mobile-action-count">
            {selectedIds.length} selected
          </div>
          <div className="manufacture-mobile-action-controls">
            <select
              className="manufacture-mobile-action-select"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              disabled={bulkMoving}
            >
              {Object.entries(STATUS_META).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
            <button
              className="btn primary manufacture-mobile-action-btn"
              onClick={handleBulkMove}
              disabled={bulkMoving}
            >
              Move
            </button>
            <button
              className="btn outline manufacture-mobile-action-btn"
              onClick={handleRestoreBulkMove}
              disabled={bulkMoving || !lastBulkMove}
            >
              Restore
            </button>
            <button
              className="btn outline manufacture-mobile-action-btn"
              onClick={handleShareSelected}
              disabled={shareLoading}
            >
              Share
            </button>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="modal-overlay">
          <div className="modal-card manufacture-history-modal">
            <div className="modal-header">
              <h3>Manufacture History</h3>
              <button className="btn outline" onClick={() => setShowHistoryModal(false)}>
                Close
              </button>
            </div>
            <div className="manufacture-history-subtitle">
              Stock received, status movement, restore and update audit trail.
            </div>
            <div className="manufacture-history-table-wrap">
              <table className="manufacturing-table manufacture-history-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Order</th>
                    <th>Product</th>
                    <th>Stock</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Source</th>
                    <th>Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: "center", padding: 18 }}>
                        Loading...
                      </td>
                    </tr>
                  ) : statusHistory.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: "center", padding: 18 }}>
                        No history found
                      </td>
                    </tr>
                  ) : (
                    statusHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          {entry.created_at || entry.at
                            ? new Date(entry.created_at || entry.at).toLocaleString("en-IN")
                            : "-"}
                        </td>
                        <td>{entry.updated_by || entry.user || "-"}</td>
                        <td>{entry.action || "-"}</td>
                        <td>{entry.orderid || "-"}</td>
                        <td>{entry.product || "-"}</td>
                        <td>{entry.qty || 0}</td>
                        <td>{STATUS_META[entry.from_status || entry.fromStatus] || entry.source_location || "-"}</td>
                        <td>{STATUS_META[entry.to_status || entry.toStatus] || entry.destination_location || "-"}</td>
                        <td>{entry.source_location || "-"}</td>
                        <td>{entry.destination_location || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="manufacture-history-mobile-cards">
                {historyLoading ? (
                  <div className="manufacture-mobile-loading">Loading...</div>
                ) : statusHistory.length === 0 ? (
                  <div className="manufacture-mobile-empty">No history found</div>
                ) : (
                  statusHistory.map((entry) => (
                    <div key={entry.id} className="manufacture-history-mobile-card">
                      <div className="manufacture-history-mobile-date">
                        {entry.created_at || entry.at
                          ? new Date(entry.created_at || entry.at).toLocaleString("en-IN")
                          : "-"}
                      </div>
                      <div className="manufacture-history-mobile-user">{entry.updated_by || entry.user || "-"}</div>
                      <div className="manufacture-history-mobile-action">{entry.action || "-"}</div>
                      <div className="manufacture-history-mobile-details">
                        <div className="manufacture-history-mobile-detail">
                          <span>Order:</span>
                          <strong>{entry.orderid || "-"}</strong>
                        </div>
                        <div className="manufacture-history-mobile-detail">
                          <span>Product:</span>
                          <strong>{entry.product || "-"}</strong>
                        </div>
                        <div className="manufacture-history-mobile-detail">
                          <span>Qty:</span>
                          <strong>{entry.qty || 0}</strong>
                        </div>
                        <div className="manufacture-history-mobile-detail">
                          <span>From:</span>
                          <strong>{STATUS_META[entry.from_status || entry.fromStatus] || entry.source_location || "-"}</strong>
                        </div>
                        <div className="manufacture-history-mobile-detail">
                          <span>To:</span>
                          <strong>{STATUS_META[entry.to_status || entry.toStatus] || entry.destination_location || "-"}</strong>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="modal-overlay">
          <div className="modal-card manufacture-share-modal">
            <div className="modal-header">
              <h3>Share {selectedIds.length} Selected Item(s)</h3>
              <button className="btn-close" onClick={() => setShowShareModal(false)} disabled={shareLoading}>
                <X size={18} />
              </button>
            </div>
            <p className="manufacture-share-subtext">Choose where you want to send these selected products.</p>
            <div className="manufacture-share-actions">
              <button className="btn primary" onClick={handleShareToInventory} disabled={shareLoading}>
                {shareLoading ? "Sharing..." : "Send to Inventory"}
              </button>
              <button className="btn outline" onClick={() => setShowShareModal(false)} disabled={shareLoading}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

              <div className="manufacture-transfer-mobile-cards">
                {pendingTransfers.length === 0 ? (
                  <div className="manufacture-mobile-empty">No pending transfers</div>
                ) : (
                  pendingTransfers.map((request) => (
                    <div key={request.id} className="manufacture-transfer-mobile-card">
                      <div className="manufacture-transfer-mobile-detail">
                        <span>Order:</span>
                        <strong>{request.orderId}</strong>
                      </div>
                      <div className="manufacture-transfer-mobile-detail">
                        <span>Product:</span>
                        <strong>{request?.payload?.productName || "-"}</strong>
                      </div>
                      <div className="manufacture-transfer-mobile-detail">
                        <span>Qty:</span>
                        <strong>{request?.payload?.qty || 1}</strong>
                      </div>
                      <div className="manufacture-transfer-mobile-detail">
                        <span>Value:</span>
                        <strong>Rs.{formatInr(request?.payload?.value || 0)}</strong>
                      </div>
                      <div className="manufacture-transfer-mobile-actions">
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
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
