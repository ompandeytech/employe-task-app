import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Download, Filter, Calendar, Package, AlertTriangle, TrendingUp, MapPin, ShoppingCart, RefreshCw, Eye, Edit, Trash2, Upload, X, Check, FileText, FileSpreadsheet, Send, ScanLine } from "lucide-react";
import rtoAPI from "../api/rtoAPI";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import RtoWarehouseScanModal from "../components/rto/RtoWarehouseScanModal";
import "./Rto.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://techiohisab.com/api";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RTO_AWB_STORAGE_KEY = "rto_awb_by_order_id_v1";
const DEFAULT_TREND_POINTS = [
  { label: "Mon", value: 65 },
  { label: "Tue", value: 78 },
  { label: "Wed", value: 90 },
  { label: "Thu", value: 81 },
  { label: "Fri", value: 56 },
  { label: "Sat", value: 85 },
  { label: "Sun", value: 40 },
];
const formatDisplayDate = (d) => {
  if (!d) return "-";
  const x = new Date(d);
  if (isNaN(x)) return d;
  return `${x.getDate()} ${MONTHS[x.getMonth()]}, ${x.getFullYear()}`;
};

const buildAwbMapFromOrders = (orders) => {
  const map = {};
  if (!Array.isArray(orders)) return map;

  orders.forEach((order) => {
    const key = String(order?.id || "").trim();
    const awb = String(order?.awbNumber || order?.awb_number || "").trim();
    if (key && awb) map[key] = awb;
  });

  return map;
};

const loadAwbMapFromStorage = () => {
  try {
    const raw = localStorage.getItem(RTO_AWB_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const normalized = {};
    Object.entries(parsed).forEach(([key, value]) => {
      const safeKey = String(key || "").trim();
      const safeValue = String(value || "").trim();
      if (safeKey && safeValue && safeValue !== "-") normalized[safeKey] = safeValue;
    });
    return normalized;
  } catch {
    return {};
  }
};

const mergeAwbMaps = (...maps) => {
  const merged = {};
  maps.forEach((map) => {
    if (!map || typeof map !== "object") return;
    Object.entries(map).forEach(([key, value]) => {
      const safeKey = String(key || "").trim();
      const safeValue = String(value || "").trim();
      if (safeKey && safeValue && safeValue !== "-") merged[safeKey] = safeValue;
    });
  });
  return merged;
};

const isMissingDisplayValue = (value) => {
  const text = String(value ?? "").trim();
  return !text || text === "-" || /^order\s*#\s*\d+$/i.test(text);
};

const fetchSalesCatalog = async () => {
  const response = await fetch(`${API_BASE_URL}/sales`);
  if (!response.ok) {
    throw new Error("Failed to fetch sales catalog");
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
};

const normalizeRtoOrders = (orders = [], sourceSales = []) => {
  const salesByAwb = new Map();
  const salesByOrderId = new Map();

  (Array.isArray(sourceSales) ? sourceSales : []).forEach((sale) => {
    const awbKey = String(sale?.awb_no || sale?.awb_number || sale?.awbNumber || "").trim().toLowerCase();
    const orderIdKey = String(sale?.platform_order_id || sale?.platformOrderId || "").trim();
    if (awbKey && !salesByAwb.has(awbKey)) salesByAwb.set(awbKey, sale);
    if (orderIdKey && !salesByOrderId.has(orderIdKey)) salesByOrderId.set(orderIdKey, sale);
  });

  return (Array.isArray(orders) ? orders : []).map((order) => {
    const awbKey = String(order?.awbNumber || order?.awb_number || "").trim().toLowerCase();
    const orderIdKey = String(order?.id || "").trim();
    const sale = salesByAwb.get(awbKey) || salesByOrderId.get(orderIdKey);

    return {
      ...order,
      productName: isMissingDisplayValue(order?.productName)
        ? String(sale?.items || order?.product || "-").trim() || "-"
        : order.productName,
      product: isMissingDisplayValue(order?.product)
        ? String(sale?.items || order?.productName || "-").trim() || "-"
        : order.product,
      platform:
        isMissingDisplayValue(order?.platform) || String(order?.platform).trim().toLowerCase() === "unknown"
          ? String(sale?.platform || "Unknown").trim() || "Unknown"
          : order.platform,
      accountName: isMissingDisplayValue(order?.accountName)
        ? String(sale?.account_name || sale?.customer_name || order?.customerName || "-").trim() || "-"
        : order.accountName,
      awbNumber: String(order?.awbNumber || order?.awb_number || sale?.awb_no || sale?.awb_number || "").trim() || "-",
      dispatchDate: order?.dispatchDate || order?.dispatch_date || sale?.dispatch_date || sale?.dispatchDate || null,
      value: Number(order?.value ?? sale?.amount ?? 0) || 0,
    };
  });
};

export default function Rto() {
  const navigate = useNavigate();
  const [rtoOrders, setRtoOrders] = useState([]);
  const [awbByOrderId, setAwbByOrderId] = useState(() => loadAwbMapFromStorage());
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [activeType, setActiveType] = useState("RTO");
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [marketplace, setMarketplace] = useState("");
  const [courierPartner, setCourierPartner] = useState("");
  
  // Verification state
  const [productCondition, setProductCondition] = useState("");
  const [returnType, setReturnType] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [uploadedImages, setUploadedImages] = useState([]);

  const [showScanModal, setShowScanModal] = useState(false);

  // Bulk verification modal state
  const [showBulkVerifyModal, setShowBulkVerifyModal] = useState(false);
  const [bulkVerifyData, setBulkVerifyData] = useState({
    productCondition: "",
    returnType: "",
    verificationNotes: ""
  });
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  // Load RTO orders from API
  useEffect(() => {
    try {
      localStorage.setItem(RTO_AWB_STORAGE_KEY, JSON.stringify(awbByOrderId || {}));
    } catch {
      // Ignore browser storage write errors.
    }
  }, [awbByOrderId]);

  useEffect(() => {
    setSelectedOrders(new Set());
    setSelectedOrder(null);

    const loadRtoData = async () => {
      setLoading(true);
      try {
        const [ordersData, summaryData, courierData, fraudData, marketplaceData, trendData, sourceSales] = await Promise.all([
          rtoAPI.getRtoOrders({ type: activeType }),
          rtoAPI.getRtoSummary({ type: activeType }),
          rtoAPI.getCourierStats({ type: activeType }),
          rtoAPI.getFraudZones({ type: activeType }),
          rtoAPI.getMarketplaceSplit({ type: activeType }),
          rtoAPI.getLossTrend({ type: activeType }),
          fetchSalesCatalog().catch(() => [])
        ]);
        
        const safeOrders = normalizeRtoOrders(ordersData, sourceSales);
        setRtoOrders(safeOrders);
        setAwbByOrderId((prev) => mergeAwbMaps(prev, buildAwbMapFromOrders(safeOrders)));
        setApiSummary(summaryData && typeof summaryData === 'object' ? summaryData : {});
        setCourierRtoData(Array.isArray(courierData) ? courierData : []);
        setFraudZones(Array.isArray(fraudData) ? fraudData : []);
        setMarketplaceData(Array.isArray(marketplaceData) ? marketplaceData : []);
        setTrendData(Array.isArray(trendData) ? trendData : []);
      } catch (error) {
        console.error('Error loading RTO data:', error);
        // Set empty data to prevent crashes
        setRtoOrders([]);
        setApiSummary({});
        setCourierRtoData([]);
        setFraudZones([]);
        setMarketplaceData([]);
        setTrendData([]);
        
        if (import.meta.env.PROD) {
          alert('Unable to connect to server. Please check your internet connection.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadRtoData();
  }, [activeType]);

  // State for analytics data from API
  const [apiSummary, setApiSummary] = useState({});
  const [courierRtoData, setCourierRtoData] = useState([]);
  const [fraudZones, setFraudZones] = useState([]);
  const [marketplaceData, setMarketplaceData] = useState([]);
  const [trendData, setTrendData] = useState([]);

  // Summary calculations - use API data if available, otherwise calculate from orders
  const summary = useMemo(() => {
    if (apiSummary && apiSummary.total !== undefined) {
      return {
        total: apiSummary.total || 0,
        rtoCount: apiSummary.rto_count || 0,
        dtoCount: apiSummary.dto_count || 0,
        fraudCount: apiSummary.fraud_count || 0,
        totalLoss: apiSummary.total_loss || 0
      };
    }
    const scopedOrders = rtoOrders.filter(o => o.type === activeType);
    const total = scopedOrders.length;
    const rtoCount = activeType === "RTO" ? scopedOrders.length : 0;
    const dtoCount = activeType === "DTO" ? scopedOrders.length : 0;
    const fraudCount = scopedOrders.filter(o => o.returnType === "Fraud").length;
    const totalLoss = scopedOrders.reduce((sum, o) => sum + (o.value || 0), 0);
    
    return { total, rtoCount, dtoCount, fraudCount, totalLoss };
  }, [rtoOrders, apiSummary, activeType]);

  const activeOrderLabel = activeType === "RTO" ? "RTO Orders" : "DTO Orders";
  const activeOrderCount = activeType === "RTO" ? summary.rtoCount : summary.dtoCount;

  // Filter orders
  const filteredOrders = useMemo(() => {
    return rtoOrders.filter(order => {
      if (order.type !== activeType) return false;
      const searchValue = searchQuery.toLowerCase();
      const productName = String(order.productName || order.product || "").toLowerCase();
      const platform = String(order.platform || order.store || "").toLowerCase();
      const accountName = String(order.accountName || order.customerName || "").toLowerCase();
      const orderAwb = String(
        order.awbNumber ||
          order.awb_number ||
          awbByOrderId[String(order.id || "").trim()] ||
          ""
      ).toLowerCase();
      if (
        searchQuery &&
        !productName.includes(searchValue) &&
        !platform.includes(searchValue) &&
        !accountName.includes(searchValue) &&
        !orderAwb.includes(searchValue)
      ) {
        return false;
      }
      if (marketplace && (order.platform || order.store) !== marketplace) return false;
      if (courierPartner && order.courier !== courierPartner) return false;
      return true;
    });
  }, [rtoOrders, searchQuery, marketplace, courierPartner, awbByOrderId, activeType]);

  const lossTrendPoints = useMemo(() => {
    const sourcePoints = Array.isArray(trendData) && trendData.length > 0 ? trendData : DEFAULT_TREND_POINTS;
    const normalizedPoints = sourcePoints
      .map((item, index) => {
        const rawLabel =
          item?.label ??
          item?.day ??
          item?.name ??
          item?.date ??
          item?.month ??
          DEFAULT_TREND_POINTS[index]?.label ??
          `P${index + 1}`;
        const rawValue = Number(
          item?.value ??
            item?.percentage ??
            item?.loss_recovery ??
            item?.recovery ??
            item?.amount ??
            item?.count ??
            0
        );

        return {
          label: String(rawLabel).slice(0, 3),
          value: Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0,
        };
      })
      .filter((item) => item.label);

    if (normalizedPoints.length === 0) {
      return DEFAULT_TREND_POINTS.map((item) => ({ ...item, height: item.value }));
    }

    const maxValue = Math.max(...normalizedPoints.map((item) => item.value), 1);

    return normalizedPoints.map((item) => ({
      ...item,
      height: Math.max(8, (item.value / maxValue) * 100),
    }));
  }, [trendData]);

  const handleOrderSelection = (orderId) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrders(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleVerification = async () => {
    if (!selectedOrder || !productCondition || !returnType) {
      alert("Please select order, product condition, and return type");
      return;
    }

    try {
      await rtoAPI.updateVerification(selectedOrder.id, {
        productCondition,
        returnType,
        verificationNotes,
      });
      const [ordersData, summaryData, sourceSales] = await Promise.all([
        rtoAPI.getRtoOrders({ type: activeType }),
        rtoAPI.getRtoSummary({ type: activeType }),
        fetchSalesCatalog().catch(() => []),
      ]);
      const safeOrders = normalizeRtoOrders(ordersData, sourceSales);
      setRtoOrders(safeOrders);
      setAwbByOrderId((prev) => mergeAwbMaps(prev, buildAwbMapFromOrders(safeOrders)));
      setApiSummary(summaryData && typeof summaryData === "object" ? summaryData : {});

      alert("Order verified successfully!");
      setSelectedOrder(null);
      setProductCondition("");
      setReturnType("");
      setVerificationNotes("");
      setUploadedImages([]);
      
      alert("Order verified successfully!");
    } catch (error) {
      console.error('Error verifying order:', error);
      if (import.meta.env.PROD) {
        alert("Failed to verify order. Please check your connection and try again.");
      } else {
        alert("Failed to verify order. Please try again.");
      }
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedImages(prev => [...prev, ...files]);
  };

  const removeImage = (index) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const openScanModal = () => {
    setShowScanModal(true);
  };

  const closeScanModal = () => {
    setShowScanModal(false);
  };

  const getOrderAwbValue = (order) => {
    const directAwb = String(order?.awbNumber || order?.awb_number || "").trim();
    if (directAwb) return directAwb;
    const orderKey = String(order?.id || "").trim();
    return orderKey ? awbByOrderId[orderKey] || "-" : "-";
  };

  const handleWarehouseScanSaved = async (savedRows = []) => {
    try {
      const rowsToSave = Array.isArray(savedRows) ? savedRows : [];
      if (rowsToSave.length === 0) return;

      await rtoAPI.saveScanEntries(rowsToSave);
      const [ordersData, summaryData, sourceSales] = await Promise.all([
        rtoAPI.getRtoOrders({ type: activeType }),
        rtoAPI.getRtoSummary({ type: activeType }),
        fetchSalesCatalog().catch(() => []),
      ]);
      const safeOrders = normalizeRtoOrders(ordersData, sourceSales);
      setRtoOrders(safeOrders);
      setAwbByOrderId((prev) => mergeAwbMaps(prev, buildAwbMapFromOrders(safeOrders)));
      setApiSummary(summaryData && typeof summaryData === "object" ? summaryData : {});

      const awbsToReturn = Array.from(
        new Set(
          (Array.isArray(savedRows) ? savedRows : [])
            .map((row) => String(row?.awbNumber || "").trim())
            .filter((awb) => awb && awb !== "-")
        )
      );

      if (awbsToReturn.length > 0) {
        const results = await Promise.allSettled(
          awbsToReturn.map(async (awb) => {
            const response = await fetch(`${API_BASE_URL}/sales/awb/lifecycle`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ awb_no: awb, mode: "RETURN" }),
            });

            if (response.ok || response.status === 404) {
              return response;
            }

            const payload = await response.json().catch(() => ({}));
            throw new Error(payload?.message || `Failed to update sales status for ${awb}`);
          })
        );

        const failed = results.filter((result) => result.status === "rejected");
        if (failed.length > 0) {
          console.error("RTO to sales status sync failed for some AWBs:", failed);
        }
      }
    } catch (error) {
      console.error("Error refreshing RTO data after scan save:", error);
      try {
        const [ordersData, sourceSales] = await Promise.all([
          rtoAPI.getRtoOrders({ type: activeType }),
          fetchSalesCatalog().catch(() => []),
        ]);
        const safeOrders = normalizeRtoOrders(ordersData, sourceSales);
        setRtoOrders(safeOrders);
        setAwbByOrderId((prev) => mergeAwbMaps(prev, buildAwbMapFromOrders(safeOrders)));
      } catch (fallbackError) {
        console.error("Fallback RTO refresh failed:", fallbackError);
      }
    }
  };

  // Export functions
  const exportToExcel = () => {
    const data = filteredOrders.map(order => ({
      'Product Name': order.productName || order.product || "-",
      'AWB Number': getOrderAwbValue(order),
      'Platform': order.platform || order.store || "-",
      'Account Name': order.accountName || order.customerName || "-",
      'Value': order.value,
      'Type': order.type,
      'Verification': order.verification,
      'Date': order.date,
      'Product Condition': order.productCondition,
      'Return Type': order.returnType,
      'Notes': order.notes
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const fileName = `RTO_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.utils.book_append_sheet(wb, ws, "RTO Orders");
    try {
      const workbookBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const workbookBlob = new Blob([workbookBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(workbookBlob, fileName);
    } catch (error) {
      console.error("Blob export failed, falling back to XLSX.writeFile:", error);
      XLSX.writeFile(wb, fileName);
    }
  };

  const exportToPDF = () => {
    // Simple PDF export using window.print for now
    // In production, you'd use a library like jsPDF
    window.print();
  };

  // Bulk verification functions
  const handleBulkVerify = () => {
    if (selectedOrders.size === 0) {
      alert("Please select orders to verify");
      return;
    }
    setShowBulkVerifyModal(true);
  };

  const handleBulkVerifySubmit = async () => {
    if (!bulkVerifyData.productCondition || !bulkVerifyData.returnType) {
      alert("Please fill all verification fields");
      return;
    }

    try {
      const orderIds = Array.from(selectedOrders);

      await rtoAPI.bulkVerifyRtoOrders({
        orderIds,
        productCondition: bulkVerifyData.productCondition,
        returnType: bulkVerifyData.returnType,
        verificationNotes: bulkVerifyData.verificationNotes,
      });

      const [ordersData, summaryData, sourceSales] = await Promise.all([
        rtoAPI.getRtoOrders({ type: activeType }),
        rtoAPI.getRtoSummary({ type: activeType }),
        fetchSalesCatalog().catch(() => []),
      ]);
      const safeOrders = normalizeRtoOrders(ordersData, sourceSales);
      setRtoOrders(safeOrders);
      setAwbByOrderId((prev) => mergeAwbMaps(prev, buildAwbMapFromOrders(safeOrders)));
      setApiSummary(summaryData && typeof summaryData === "object" ? summaryData : {});

      setBulkVerifyData({
        productCondition: "",
        returnType: "",
        verificationNotes: ""
      });
      setShowBulkVerifyModal(false);
      setSelectedOrders(new Set());
      
      alert(`Successfully verified ${orderIds.length} orders!`);
    } catch (error) {
      console.error('Error in bulk verification:', error);
      alert("Failed to verify orders. Please try again.");
    }
  };

  // Bulk update status
  const handleBulkUpdateStatus = () => {
    if (selectedOrders.size === 0) {
      alert("Please select orders to update");
      return;
    }
    
    const newStatus = prompt("Enter new status (Pending/Verified/Rejected):", "Verified");
    if (!newStatus) return;
    
    const orderIds = Array.from(selectedOrders);
    setRtoOrders(prev => prev.map(order => {
      if (orderIds.includes(order.id)) {
        return { ...order, verification: newStatus };
      }
      return order;
    }));
    
    alert(`Updated status for ${orderIds.length} orders`);
  };

  const handleShareToManufacturing = (orderId) => {
    setSelectedOrders(new Set([orderId]));
    setShowShareModal(true);
  };

  const handleShareSelected = () => {
    if (selectedOrders.size === 0) {
      alert("Please select at least one order to share");
      return;
    }
    setShowShareModal(true);
  };

  const handleShareConfirm = async (destination) => {
    if (selectedOrders.size === 0) {
      setShowShareModal(false);
      return;
    }

    try {
      setShareLoading(true);
      const orderIds = Array.from(selectedOrders);
      const response = await rtoAPI.shareOrders({ orderIds, destination });
      const created = Number(response?.createdCount || 0);
      const skipped = Number(response?.skippedCount || 0);
      const [ordersData, sourceSales] = await Promise.all([
        rtoAPI.getRtoOrders({ type: activeType }),
        fetchSalesCatalog().catch(() => []),
      ]);
      const safeOrders = normalizeRtoOrders(ordersData, sourceSales);
      setRtoOrders(safeOrders);
      setAwbByOrderId((prev) => mergeAwbMaps(prev, buildAwbMapFromOrders(safeOrders)));
      alert(`Successfully shared ${created} order(s) to ${destination}.${skipped ? ` ${skipped} already pending.` : ""}`);
      setSelectedOrders(new Set());
      setShowShareModal(false);
    } catch (error) {
      console.error("Error sharing orders:", error);
      alert("Failed to share orders. Please try again.");
    } finally {
      setShareLoading(false);
    }
  };

  const handleShareCancel = () => {
    setShowShareModal(false);
    alert("Share canceled");
  };

  return (
    <div className="rto-container">
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {/* Header */}
      <div className="rto-header">
        <div className="rto-header-left">
          <div className="rto-dto-toggle">
            <button
              type="button"
              className={activeType === "RTO" ? "active" : ""}
              onClick={() => setActiveType("RTO")}
            >
              RTO
            </button>
            <button
              type="button"
              className={activeType === "DTO" ? "active" : ""}
              onClick={() => setActiveType("DTO")}
            >
              DTO
            </button>
          </div>
          <div className="rto-header-title">
            <h1 className="rto-title">
              {activeType === "RTO" ? "RTO Management" : "DTO Management"}
            </h1>
            <p className="rto-subtitle">Manage returned orders and verify product conditions</p>
          </div>
        </div>
        <div className="rto-header-actions">
          <button className="btn btn-outline" onClick={openScanModal}>
            <ScanLine size={18} />
            {`Scan ${activeType}`}
          </button>
          <button className="btn btn-outline">
            <RefreshCw size={18} />
            Refresh
          </button>
          <button className="btn btn-outline" onClick={exportToExcel}>
            <FileSpreadsheet size={18} />
            Export Excel
          </button>
          <button className="btn btn-outline" onClick={exportToPDF}>
            <FileText size={18} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-icon">
            <Package size={24} />
          </div>
          <div className="summary-content">
            <div className="summary-value">{summary.total}</div>
            <div className="summary-label">Total Orders</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className={`summary-icon ${activeType === "RTO" ? "rto" : "dto"}`}>
            {activeType === "RTO" ? <AlertTriangle size={24} /> : <X size={24} />}
          </div>
          <div className="summary-content">
            <div className="summary-value">{activeOrderCount}</div>
            <div className="summary-label">{activeOrderLabel}</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-icon fraud">
            <TrendingUp size={24} />
          </div>
          <div className="summary-content">
            <div className="summary-value">{summary.fraudCount}</div>
            <div className="summary-label">Fraud Returns</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-icon loss">
            <AlertTriangle size={24} />
          </div>
          <div className="summary-content">
            <div className="summary-value">₹{Number(summary.totalLoss || 0).toLocaleString('en-IN')}</div>
            <div className="summary-label">Total Loss Amount</div>
          </div>
        </div>
      </div>

      <div className="rto-main-content">
        <div className="rto-left-section">
          {/* Filters */}
          <div className="filters-card">
            <div className="filters-header">
              <h3>Filters</h3>
              <Filter size={18} />
            </div>
            <div className="filters-grid">
              <div className="filter-group">
                <label>Date Range</label>
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                  <option value="">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Marketplace</label>
                <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
                  <option value="">All Marketplaces</option>
                  <option value="Amazon">Amazon</option>
                  <option value="Flipkart">Flipkart</option>
                  <option value="Meesho">Meesho</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Courier Partner</label>
                <select value={courierPartner} onChange={(e) => setCourierPartner(e.target.value)}>
                  <option value="">All Couriers</option>
                  <option value="Blue Dart">Blue Dart</option>
                  <option value="FedEx">FedEx</option>
                  <option value="XpressBees">XpressBees</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>RTO/DTO Type</label>
                <select value={activeType} onChange={(e) => setActiveType(e.target.value)}>
                  <option value="RTO">RTO</option>
                  <option value="DTO">DTO</option>
                </select>
              </div>
              
              <div className="filter-group search-group">
                <label>Search</label>
                <div className="search-input-wrapper">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search by Order ID, AWB or Customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className={`orders-table-card ${loading ? "loading" : ""}`}>
            <div className="table-header">
              <div className="rto-table-heading">
                <h3>RTO/DTO Orders</h3>
                <p>Warehouse scanned entries saved from the RTO scan modal appear here.</p>
              </div>
              <div className="table-actions">
                <span className="selected-count">
                  {selectedOrders.size} of {filteredOrders.length} selected
                </span>
                <button className="btn btn-primary btn-share-top" onClick={handleShareSelected}>
                  <Send size={16} />
                  Share
                </button>
              </div>
            </div>

            <div className="rto-table-shell">
              <div className="rto-table-summary-row">
                <div className="rto-mini-stat">
                  <span>Total Rows</span>
                  <strong>{filteredOrders.length}</strong>
                </div>
                <div className="rto-mini-stat">
                  <span>Selected</span>
                  <strong>{selectedOrders.size}</strong>
                </div>
                <div className="rto-mini-stat">
                  <span>Current Type</span>
                  <strong>{activeType}</strong>
                </div>
              </div>

              <div className="table-wrapper rto-sales-table-wrapper">
                <table className="rto-table rto-sales-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th>Date</th>
                      <th>Platform</th>
                      <th>Account</th>
                      <th>AWB</th>
                      <th>Items</th>
                      <th>Amount</th>
                      <th>Dispatch Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="rto-table-empty">
                          No RTO/DTO records found
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr
                          key={order.id}
                          className={selectedOrders.has(order.id) ? "selected" : ""}
                          onClick={() => setSelectedOrder(order)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedOrders.has(order.id)}
                              onChange={() => handleOrderSelection(order.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td>{formatDisplayDate(order.date)}</td>
                          <td>{order.platform || order.store || "-"}</td>
                          <td>{order.accountName || order.customerName || "-"}</td>
                          <td className="rto-awb-cell">{getOrderAwbValue(order)}</td>
                          <td>
                            <div className="rto-item-cell">
                              <span className="order-id">{order.productName || order.product || "-"}</span>
                              <span className="rto-item-subtext">{order.type} warehouse scan</span>
                            </div>
                          </td>
                          <td className="amount">Rs.{Number(order.value || 0).toLocaleString("en-IN")}</td>
                          <td>{formatDisplayDate(order.dispatchDate || order.dispatch_date)}</td>
                          <td>
                            <div className="rto-status-stack">
                              <span className={`type-badge ${order.type.toLowerCase()}`}>
                                {order.type}
                              </span>
                              <span className={`verification-badge ${order.verification.toLowerCase()}`}>
                                {order.verification}
                              </span>
                            </div>
                          </td>
                          <td className="rto-actions-cell">
                            <button
                              className="edit-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(order);
                              }}
                              title="View Details"
                            >
                              <Eye size={15} />
                              View
                            </button>
                            <button
                              className="delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareToManufacturing(order.id);
                              }}
                              title="Share"
                            >
                              <Send size={15} />
                              Share
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

          {/* Analytics Section */}
          <div className="analytics-section">
            <div className={`analytics-card ${loading ? "loading" : ""}`}>
              <h4>Courier RTO %</h4>
              <div className="bar-chart">
                {courierRtoData.map((item, index) => (
                  <div key={index} className="bar-item">
                    <div className="bar-label">{item.courier}</div>
                    <div className="bar-wrapper">
                      <div
                        className="bar-fill"
                        style={{ width: `${item.percentage * 5}%` }}
                      ></div>
                    </div>
                    <div className="bar-value">{item.percentage}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`analytics-card ${loading ? "loading" : ""}`}>
              <h4>High Fraud Zones</h4>
              <div className="fraud-zones-list">
                {fraudZones.map((zone, index) => (
                  <div key={index} className="fraud-zone-item">
                    <MapPin size={14} />
                    <span>{zone.city}</span>
                    <span className="fraud-percentage">{zone.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`analytics-card ${loading ? "loading" : ""}`}>
              <h4>Marketplace Split</h4>
              <div className="pie-chart">
                {marketplaceData.map((item, index) => (
                  <div key={index} className="pie-segment" style={{ 
                    width: `${item.value}%`,
                    backgroundColor: index === 0 ? '#4f46e5' : index === 1 ? '#06b6d4' : '#10b981'
                  }}>
                    {item.name} ({item.value}%)
                  </div>
                ))}
              </div>
            </div>

            <div className={`analytics-card ${loading ? "loading" : ""}`}>
              <h4>Loss Recovery Trend</h4>
              <div className="trend-chart">
                <div className="trend-bars">
                  {lossTrendPoints.map((item, index) => (
                    <div
                      key={`${item.label}-${index}`}
                      className="trend-bar"
                      style={{ height: `${item.height}%` }}
                      title={`${item.label}: ${item.value}`}
                    ></div>
                  ))}
                </div>
                <div className="trend-labels">
                  {lossTrendPoints.map((item, index) => (
                    <span key={`${item.label}-label-${index}`}>{item.label}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="rto-footer">
        <div className="footer-left">
          <span className="selected-info">
            {selectedOrders.size} orders selected
          </span>
        </div>
        <div className="footer-actions">
          <button className="btn btn-outline" onClick={exportToExcel}>
            <FileSpreadsheet size={18} />
            Export Excel
          </button>
          <button className="btn btn-outline" onClick={exportToPDF}>
            <FileText size={18} />
            Download PDF
          </button>
          <button className="btn btn-outline" onClick={handleBulkUpdateStatus}>
            Bulk Update Status
          </button>
          <button className="btn btn-outline" onClick={handleShareSelected}>
            <Send size={16} />
            Share Selected
          </button>
          <button className="btn btn-primary" onClick={handleBulkVerify}>
            Bulk Verification
          </button>
        </div>
      </div>

      {showShareModal && (
        <div className="modal-overlay">
          <div className="modal-card share-modal">
            <div className="modal-header">
              <h3>Share {selectedOrders.size} Selected Order(s)</h3>
              <button className="btn-close" onClick={handleShareCancel}>
                <X size={18} />
              </button>
            </div>
            <p className="share-modal-subtext">Choose where you want to send these selected products.</p>
            <div className="share-modal-actions">
              <button
                className="btn btn-primary"
                onClick={() => handleShareConfirm("inventory")}
                disabled={shareLoading}
              >
                {shareLoading ? "Sharing..." : "Send to Inventory"}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleShareConfirm("manufacture")}
                disabled={shareLoading}
              >
                {shareLoading ? "Sharing..." : "Send to Manufacture"}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleShareConfirm(activeType === "RTO" ? "dto" : "rto")}
                disabled={shareLoading}
              >
                {shareLoading ? "Sharing..." : activeType === "RTO" ? "Send to DTO" : "Send to RTO"}
              </button>
              <button className="btn btn-outline" onClick={handleShareCancel} disabled={shareLoading}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <RtoWarehouseScanModal
        open={showScanModal}
        onClose={closeScanModal}
        onSaved={handleWarehouseScanSaved}
        scanType={activeType}
      />

      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-card rto-view-modal">
            <div className="modal-header">
              <h3>Order Verification</h3>
              <button className="btn-close" onClick={() => setSelectedOrder(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="order-details">
              <div className="detail-row">
                <span className="label">Product Name:</span>
                <span className="value">{selectedOrder.productName || selectedOrder.product || "-"}</span>
              </div>
              <div className="detail-row">
                <span className="label">AWB Number:</span>
                <span className="value">{getOrderAwbValue(selectedOrder)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Platform:</span>
                <span className="value">{selectedOrder.platform || selectedOrder.store || "-"}</span>
              </div>
              <div className="detail-row">
                <span className="label">Account Name:</span>
                <span className="value">{selectedOrder.accountName || selectedOrder.customerName || "-"}</span>
              </div>
              <div className="detail-row">
                <span className="label">Value:</span>
                <span className="value">Rs.{(selectedOrder.value || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="detail-row">
                <span className="label">Type:</span>
                <span className={`type-badge ${selectedOrder.type.toLowerCase()}`}>
                  {selectedOrder.type}
                </span>
              </div>
            </div>

            <div className="verification-form">
              <div className="form-section">
                <h4>Product Condition</h4>
                <div className="radio-group">
                  <label className="radio-item">
                    <input
                      type="radio"
                      name="condition"
                      value="Good Condition"
                      checked={productCondition === "Good Condition"}
                      onChange={(e) => setProductCondition(e.target.value)}
                    />
                    <span>Good Condition</span>
                  </label>
                  <label className="radio-item">
                    <input
                      type="radio"
                      name="condition"
                      value="Damaged/Used"
                      checked={productCondition === "Damaged/Used"}
                      onChange={(e) => setProductCondition(e.target.value)}
                    />
                    <span>Damaged/Used</span>
                  </label>
                  <label className="radio-item">
                    <input
                      type="radio"
                      name="condition"
                      value="Missing Items"
                      checked={productCondition === "Missing Items"}
                      onChange={(e) => setProductCondition(e.target.value)}
                    />
                    <span>Missing Items</span>
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h4>Return Type</h4>
                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${returnType === "Genuine" ? "active" : ""}`}
                    onClick={() => setReturnType("Genuine")}
                  >
                    Genuine
                  </button>
                  <button
                    className={`toggle-btn ${returnType === "Fraud" ? "active" : ""}`}
                    onClick={() => setReturnType("Fraud")}
                  >
                    Fraud
                  </button>
                </div>
              </div>

              <div className="form-section">
                <h4>Image Upload (Proof)</h4>
                <div className="upload-area">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    id="image-upload"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="image-upload" className="upload-label">
                    <Upload size={24} />
                    <span>Drag & drop or browse files</span>
                  </label>
                  {uploadedImages.length > 0 && (
                    <div className="uploaded-images">
                      {uploadedImages.map((file, index) => (
                        <div key={index} className="image-preview">
                          <span>{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-section">
                <h4>Verification Notes</h4>
                <textarea
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Add verification notes..."
                  rows={4}
                />
              </div>

              <button
                className="btn btn-primary verify-btn"
                onClick={handleVerification}
                disabled={!productCondition || !returnType}
              >
                <Check size={18} />
                Mark as Verified
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Verification Modal */}
      {showBulkVerifyModal && (
        <div className="modal-overlay">
          <div className="modal-card bulk-verify-modal">
            <div className="modal-header">
              <h3>Bulk Verification ({selectedOrders.size} orders)</h3>
              <button className="btn-close" onClick={() => setShowBulkVerifyModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="bulk-verify-form">
              <div className="form-section">
                <h4>Product Condition</h4>
                <div className="radio-group">
                  <label className="radio-item">
                    <input
                      type="radio"
                      name="bulk-condition"
                      value="Good Condition"
                      checked={bulkVerifyData.productCondition === "Good Condition"}
                      onChange={(e) => setBulkVerifyData({...bulkVerifyData, productCondition: e.target.value})}
                    />
                    <span>Good Condition</span>
                  </label>
                  <label className="radio-item">
                    <input
                      type="radio"
                      name="bulk-condition"
                      value="Damaged/Used"
                      checked={bulkVerifyData.productCondition === "Damaged/Used"}
                      onChange={(e) => setBulkVerifyData({...bulkVerifyData, productCondition: e.target.value})}
                    />
                    <span>Damaged/Used</span>
                  </label>
                  <label className="radio-item">
                    <input
                      type="radio"
                      name="bulk-condition"
                      value="Missing Items"
                      checked={bulkVerifyData.productCondition === "Missing Items"}
                      onChange={(e) => setBulkVerifyData({...bulkVerifyData, productCondition: e.target.value})}
                    />
                    <span>Missing Items</span>
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h4>Return Type</h4>
                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${bulkVerifyData.returnType === "Genuine" ? "active" : ""}`}
                    onClick={() => setBulkVerifyData({...bulkVerifyData, returnType: "Genuine"})}
                  >
                    Genuine
                  </button>
                  <button
                    className={`toggle-btn ${bulkVerifyData.returnType === "Fraud" ? "active" : ""}`}
                    onClick={() => setBulkVerifyData({...bulkVerifyData, returnType: "Fraud"})}
                  >
                    Fraud
                  </button>
                </div>
              </div>

              <div className="form-section">
                <h4>Verification Notes</h4>
                <textarea
                  value={bulkVerifyData.verificationNotes}
                  onChange={(e) => setBulkVerifyData({...bulkVerifyData, verificationNotes: e.target.value})}
                  placeholder="Add verification notes for all selected orders..."
                  rows={4}
                />
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowBulkVerifyModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleBulkVerifySubmit}>
                Verify All Orders
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
