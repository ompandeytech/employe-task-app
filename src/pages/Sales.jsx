import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SalesAwbScanModal from "../components/sales/SalesAwbScanModal";
import "./Sales.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://techiohisab.com/api";
const SALES_API = `${API_BASE}/sales`;
const INVENTORY_API = `${API_BASE}/inventory`;
const PACKAGING_API = `${API_BASE}/packaging`;
const SALES_PACKAGING_CACHE_KEY = "sales-awb-packaging-cache";
const SALES_PAGE_SIZE = 50;

const DEFAULT_FORM = {
  platform: "DIRECT",
  platform_order_id: "",
  customer_name: "",
  invoice_no: "",
  awb_no: "",
  cancel_reason: "",
  sale_date: new Date().toISOString().slice(0, 10),
  payment_mode: "CASH",
  discount_amount: "",
  account_name: "",
};

const createEmptyItem = () => ({
  inventory_id: "",
  quantity: "",
  selling_price: "",
  packaging_material: "",
  packaging_cost: "",
  awbs: [],
});

const DEFAULT_ITEMS = [createEmptyItem()];

const MODE_OPTIONS = [
  { value: "PACK", label: "Pack" },
  { value: "CANCEL", label: "Cancel" },
];

const normalizePlatformValue = (platform) =>
  String(platform || "DIRECT").trim().toUpperCase() || "DIRECT";

const STATUS_OPTIONS = [
  "Packed",
  "Picked",
  "Dispatched",
  "In Transit",
  "Delivered",
  "Cancel",
  "Return",
  "Return Inward",
  "Return Completed",
  "Settlement Pending",
  "Settlement Done",
];
const CANCEL_REASON_OPTIONS = [
  "Not picked by logistics",
  "Label issue",
  "Customer cancel",
  "Wrong packing",
  "Hold",
  "Other",
];

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
  CANCELED: "Cancel",
  RETURN: "Return",
  RETURNED: "Return",
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

const ZERO_DISPATCH_STATUSES = new Set([
  "Packed",
  "Cancel",
  "Return",
  "Return Inward",
  "Return Completed",
]);

const normalizeStatus = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "Dispatched";
  const key = rawValue.toUpperCase().replace(/[\s-]+/g, "_");
  return STATUS_MAP[key] || rawValue;
};

const getStatusBadgeClass = (status) => {
  switch (normalizeStatus(status)) {
    case "Packed":
    case "In Transit":
      return "status-blue";
    case "Picked":
    case "Dispatched":
    case "Delivered":
    case "Settlement Done":
      return "status-green";
    case "Cancel":
      return "status-red";
    case "Return":
    case "Return Inward":
    case "Return Completed":
    case "Settlement Pending":
      return "status-orange";
    default:
      return "status-gray";
  }
};

const getModeSubmitLabel = (mode, editId) => {
  if (editId) return "Update Sale";
  if (mode === "CANCEL") return "Mark Cancel";
  return "Add Sale";
};

const createDefaultItems = () => DEFAULT_ITEMS.map(() => createEmptyItem());

const normalizeAwb = (value) => String(value || "").trim();
const normalizeSaleType = (value) =>
  String(value || "SINGLE").trim().toUpperCase() === "COMBO" ? "COMBO" : "SINGLE";
const formatSaleType = (value) => (normalizeSaleType(value) === "COMBO" ? "Combo" : "Single");
const getDateKey = (value) => String(value || "").slice(0, 10);
const formatHistoryDate = (value) => {
  const dateKey = getDateKey(value);
  if (!dateKey) return "No date";

  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;

  return `${day}-${month}-${year.slice(-2)}`;
};
const isDateWithinRange = (dateValue, startDate, endDate) => {
  const dateKey = getDateKey(dateValue);
  if (!dateKey) return false;

  if (!startDate && !endDate) return true;
  if (startDate && !endDate) return dateKey >= startDate;
  if (!startDate && endDate) return dateKey <= endDate;

  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = endDate >= startDate ? endDate : startDate;

  return dateKey >= rangeStart && dateKey <= rangeEnd;
};

const toSafeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeAwbList = (awbs) => {
  const seen = new Set();
  const next = [];

  for (const awb of Array.isArray(awbs) ? awbs : []) {
    const normalized = normalizeAwb(awb);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
};

const readSalesPackagingCache = () => {
  try {
    const raw = window.localStorage.getItem(SALES_PACKAGING_CACHE_KEY);
    if (!raw) return new Map();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();

    return new Map(
      parsed
        .map((entry) => [
          normalizeAwb(entry?.awb),
          {
            packaging_material: String(entry?.packaging_material || "").trim(),
            packaging_cost: toSafeNumber(entry?.packaging_cost, 0),
          },
        ])
        .filter(([awb]) => awb)
    );
  } catch (error) {
    console.error("Failed to read sales packaging cache:", error);
    return new Map();
  }
};

const writeSalesPackagingCache = (packagingByAwb) => {
  try {
    const serialized = Array.from(packagingByAwb.entries()).map(([awb, value]) => ({
      awb,
      packaging_material: String(value?.packaging_material || "").trim(),
      packaging_cost: toSafeNumber(value?.packaging_cost, 0),
    }));

    window.localStorage.setItem(SALES_PACKAGING_CACHE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error("Failed to write sales packaging cache:", error);
  }
};

const mergeSalesPackagingDisplay = (salesData, packagingByAwb) =>
  (Array.isArray(salesData) ? salesData : []).map((sale) => {
    const awb = normalizeAwb(sale?.awb_no || sale?.awb_number || sale?.awbNumber || "");
    const fallbackPackaging = packagingByAwb.get(awb);
    const currentPackagingMaterial = String(sale?.packaging_material || "").trim();
    const currentPackagingCost = toSafeNumber(sale?.packaging_cost, 0);

    return {
      ...sale,
      packaging_material:
        currentPackagingMaterial || fallbackPackaging?.packaging_material || "",
      packaging_cost:
        currentPackagingMaterial || currentPackagingCost > 0
          ? currentPackagingCost
          : toSafeNumber(fallbackPackaging?.packaging_cost, 0),
    };
  });

const getProductPackagingDefaults = () => ({
  packaging_material: "",
  packaging_cost: "",
});

const getSingleHistoryItemLabel = (sale) => {
  const rawItems = String(sale?.items || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (rawItems.length === 0) {
    return "-";
  }

  const uniqueItems = [];
  const seen = new Set();

  for (const item of rawItems) {
    const normalized = item.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    uniqueItems.push(item);
  }

  return uniqueItems[0] || "-";
};

const buildRowsFromAwbs = (baseItem, awbs) => {
  const normalizedAwbs = normalizeAwbList(awbs);

  if (normalizedAwbs.length === 0) {
    return [
      {
        ...baseItem,
        awbs: [],
        quantity: "",
      },
    ];
  }

  return normalizedAwbs.map((awb) => ({
    ...baseItem,
    awbs: [awb],
    quantity: "1",
  }));
};

const flattenItemsForSave = (items) => {
  const nextRows = [];

  for (const item of Array.isArray(items) ? items : []) {
    const normalizedAwbs = normalizeAwbList(item?.awbs);

    if (normalizedAwbs.length <= 1) {
      nextRows.push({
        ...item,
        awbs: normalizedAwbs,
        quantity: normalizedAwbs.length === 1 ? "1" : item.quantity,
      });
      continue;
    }

    nextRows.push(...buildRowsFromAwbs(item, normalizedAwbs));
  }

  return nextRows;
};

const syncPackagingAcrossProductRows = (items) => {
  const packagingByInventory = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const inventoryId = String(item?.inventory_id || "").trim();
    if (!inventoryId) continue;

    const packagingMaterial = String(item?.packaging_material || "").trim();
    const packagingCost = String(item?.packaging_cost ?? "").trim();
    if (!packagingMaterial && !packagingCost) continue;

    packagingByInventory.set(inventoryId, {
      packaging_material: packagingMaterial,
      packaging_cost: packagingCost,
    });
  }

  return (Array.isArray(items) ? items : []).map((item) => {
    const inventoryId = String(item?.inventory_id || "").trim();
    const sharedPackaging = packagingByInventory.get(inventoryId);
    if (!sharedPackaging) return item;

    return {
      ...item,
      packaging_material: sharedPackaging.packaging_material,
      packaging_cost: sharedPackaging.packaging_cost,
    };
  });
};

const isDraftItemEmpty = (item) =>
  !String(item?.inventory_id || "").trim() &&
  !Number(item?.quantity || 0) &&
  !Number(item?.selling_price || 0) &&
  normalizeAwbList(item?.awbs).length === 0;

const buildScanResultMeta = (sale) =>
  [
    sale?.platform || null,
    sale?.platform_order_id || sale?.invoice_no || null,
    sale?.account_name || sale?.customer_name || null,
  ]
    .filter(Boolean)
    .join(" | ");

const mergeScannedSaleItems = (currentItems, scannedItems, inventory) => {
  const nextItems = (Array.isArray(currentItems) ? currentItems : [])
    .filter((item) => !isDraftItemEmpty(item))
    .map((item) => ({ ...item }));
  const resultRows = [];

  for (const scannedItem of Array.isArray(scannedItems) ? scannedItems : []) {
    const inventoryId = String(scannedItem?.inventory_id || "").trim();
    const scannedQty = Number(scannedItem?.quantity || 0);
    if (!inventoryId || !Number.isFinite(scannedQty) || scannedQty <= 0) {
      continue;
    }

    const inventoryRow = inventory.find((row) => String(row.id) === inventoryId);
    const productName =
      scannedItem?.product_name || inventoryRow?.name || `Product #${inventoryId}`;
    const scannedPrice =
      scannedItem?.selling_price ?? scannedItem?.price ?? inventoryRow?.price ?? "";
    const existingIndex = nextItems.findIndex(
      (item) => String(item.inventory_id || "") === inventoryId
    );

    if (existingIndex >= 0) {
      const currentQty = Number(nextItems[existingIndex].quantity || 0);
      nextItems[existingIndex] = {
        ...nextItems[existingIndex],
        quantity: String(currentQty + scannedQty),
        selling_price:
          nextItems[existingIndex].selling_price !== ""
            ? nextItems[existingIndex].selling_price
            : String(scannedPrice ?? ""),
      };
      resultRows.push({
        product: productName,
        qty: scannedQty,
        status: "Qty increased",
        tone: "success",
      });
      continue;
    }

    nextItems.push({
      ...createEmptyItem(),
      inventory_id: inventoryId,
      quantity: String(scannedQty),
      selling_price: String(scannedPrice ?? ""),
      ...getProductPackagingDefaults(inventoryRow),
    });
    resultRows.push({
      product: productName,
      qty: scannedQty,
      status: "Added",
      tone: "success",
    });
  }

  return {
    nextItems: nextItems.length > 0 ? nextItems : createDefaultItems(),
    resultRows,
  };
};

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
  const filtered = query
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
            className="ss-menu"
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
              {filtered.map((option) => (
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
              {filtered.length === 0 && <div className="ss-empty">No match</div>}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function Sales() {
  const navigate = useNavigate();
  const todayDate = new Date().toISOString().slice(0, 10);

  const [sales, setSales] = useState([]);
  const [editId, setEditId] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [packagingEntries, setPackagingEntries] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [items, setItems] = useState(() => createDefaultItems());
  const [barcode, setBarcode] = useState("");
  const [saleMode, setSaleMode] = useState("PACK");
  const [packType, setPackType] = useState("SINGLE");
  const [showAwbScanModal, setShowAwbScanModal] = useState(false);
  const [activeAwbItemIndex, setActiveAwbItemIndex] = useState(null);

  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterFromDate, setFilterFromDate] = useState(todayDate);
  const [filterToDate, setFilterToDate] = useState(todayDate);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAWB, setFilterAWB] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [summaryFilter, setSummaryFilter] = useState("all");
  const [salesPage, setSalesPage] = useState(1);

  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [_uploadFile, setUploadFile] = useState(null);
  const [uploadData, setUploadData] = useState([]);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState("upload");

  const resetSalesForm = () => {
    setForm({
      ...DEFAULT_FORM,
      sale_date: new Date().toISOString().slice(0, 10),
    });
    setItems(createDefaultItems());
    setBarcode("");
    setEditId(null);
    setActiveAwbItemIndex(null);
    setPackType("SINGLE");
  };

  const fetchSales = async () => {
    try {
      const [salesRes, accountsRes] = await Promise.all([
        axios.get(SALES_API),
        axios.get(`${API_BASE}/accounts`),
      ]);

      const salesData = Array.isArray(salesRes.data) ? salesRes.data : [];
      const accountsData = Array.isArray(accountsRes.data) ? accountsRes.data : [];
      const packagingByAwb = readSalesPackagingCache();
      const mergedSalesData = mergeSalesPackagingDisplay(salesData, packagingByAwb);

      setAccounts(accountsData);
      setSales(
        mergedSalesData.map((sale) => ({
          ...sale,
          invoiceNumber: sale.invoice_no || sale.invoiceNumber || "",
          awbNumber: sale.awb_no || sale.awb_number || sale.awbNumber || "",
          customer_name: sale.customer_name || sale.customerName || "",
          sale_type: normalizeSaleType(sale.sale_type || sale.saleType),
          status: normalizeStatus(sale.status || sale.tracking_status),
        }))
      );
    } catch (error) {
      console.error("Error fetching sales:", error);
      setSales([]);
    }
  };

  const fetchInventory = async () => {
    try {
      const response = await axios.get(INVENTORY_API);
      setInventory(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setInventory([]);
    }
  };

  const fetchPackagingEntries = async () => {
    try {
      const response = await axios.get(PACKAGING_API);
      setPackagingEntries(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching packaging entries:", error);
      setPackagingEntries([]);
    }
  };

  useEffect(() => {
    fetchSales();
    fetchInventory();
    fetchPackagingEntries();
  }, []);

  const packagingOptions = useMemo(() => {
    const materialMap = new Map();

    for (const entry of Array.isArray(packagingEntries) ? packagingEntries : []) {
      const materialName = String(entry.material || "").trim();
      if (!materialName) continue;

      const entryDateValue = new Date(
        entry.entry_date || entry.date || entry.created_at || 0
      ).getTime();
      const existing = materialMap.get(materialName);

      if (!existing || entryDateValue >= existing.sortValue) {
        materialMap.set(materialName, {
          name: materialName,
          cost: Number(entry.cost_per_unit || 0),
          sortValue: entryDateValue,
        });
      }
    }

    return Array.from(materialMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [packagingEntries]);

  const packagingCostMap = useMemo(
    () =>
      new Map(
        packagingOptions.map((option) => [option.name, String(Number(option.cost || 0))])
      ),
    [packagingOptions]
  );

  const platformAccounts = useMemo(() => {
    const selectedPlatform = normalizePlatformValue(form.platform);

    return accounts.filter(
      (account) => normalizePlatformValue(account.platform) === selectedPlatform
    );
  }, [accounts, form.platform]);

  useEffect(() => {
    if (!form.account_name) return;

    const selectedAccountExists = platformAccounts.some(
      (account) => account.account_name === form.account_name
    );

    if (!selectedAccountExists) {
      setForm((prev) => ({ ...prev, account_name: "" }));
    }
  }, [form.account_name, platformAccounts]);

  const itemsSubTotal = items.reduce((sum, item) => {
    const quantity =
      packType === "COMBO" && String(item.inventory_id || "").trim()
        ? 1
        : Number(item.quantity || 0);
    const price = Number(item.selling_price || 0);
    return sum + quantity * price;
  }, 0);
  const packagingTotal = items.reduce((sum, item) => {
    const quantity =
      packType === "COMBO" && String(item.inventory_id || "").trim()
        ? 1
        : Number(item.quantity || 0);
    const packagingCost = Number(item.packaging_cost || 0);
    return sum + quantity * packagingCost;
  }, 0);
  const itemsTotal = itemsSubTotal + packagingTotal;

  const discountAmount = Number(form.discount_amount || 0) || 0;
  const totalAmount = Math.max(0, itemsTotal - discountAmount);

  const handlePackSubmit = async () => {
    const syncedItems = syncPackagingAcrossProductRows(items);
    const sharedComboAwb = normalizeAwb(form.awb_no);
    const rowsForSave =
      packType === "COMBO"
        ? syncedItems.map((item) => ({
            ...item,
            quantity: "1",
            awbs: sharedComboAwb ? [sharedComboAwb] : [],
          }))
        : flattenItemsForSave(syncedItems);

    const cleanItems = rowsForSave
      .map((item) => ({
        inventory_id: Number(item.inventory_id || 0),
        quantity: normalizeAwbList(item.awbs).length || Number(item.quantity || 0),
        selling_price: Number(item.selling_price || 0),
        packaging_material: String(item.packaging_material || "").trim(),
        packaging_cost: Number(item.packaging_cost || 0),
        awbs: normalizeAwbList(item.awbs),
      }))
      .filter((item) => item.inventory_id && item.quantity > 0);

    if (!form.platform) {
      alert("Platform required");
      return;
    }
    if (!form.sale_date) {
      alert("Sale date required");
      return;
    }
    if (cleanItems.length === 0) {
      alert("Add at least 1 item");
      return;
    }
    if (packType === "COMBO") {
      if (!sharedComboAwb) {
        alert("Combo ke liye shared AWB number required hai");
        return;
      }
      if (cleanItems.length < 2) {
        alert("Combo ke liye kam se kam 2 products add karein");
        return;
      }
    }
    if (editId) {
      alert("Edit sale feature abhi enabled nahi hai");
      return;
    }

    const totalAwbs = cleanItems.reduce((sum, item) => sum + item.awbs.length, 0);
    const primaryAwb =
      form.awb_no.trim() || cleanItems.find((item) => item.awbs.length > 0)?.awbs?.[0] || "";
    const uniqueAwbs = new Set(cleanItems.flatMap((item) => item.awbs));

    if (packType !== "COMBO" && uniqueAwbs.size !== totalAwbs) {
      alert("Duplicate AWB found across selected products");
      return;
    }

    try {
      let lastResponse = null;
      const packagingByAwb = readSalesPackagingCache();

      for (const item of cleanItems) {
        for (const awb of item.awbs) {
          const normalizedAwb = normalizeAwb(awb);
          if (!normalizedAwb) continue;

          packagingByAwb.set(normalizedAwb, {
            packaging_material: String(item.packaging_material || "").trim(),
            packaging_cost: toSafeNumber(item.packaging_cost, 0),
          });
        }
      }

      if (packType === "COMBO") {
        lastResponse = await axios.post(SALES_API, {
          platform: form.platform,
          platform_order_id: form.platform_order_id || null,
          customer_name: form.account_name || form.customer_name || "Direct Sale",
          invoice_no: form.invoice_no || null,
          awb_no: primaryAwb,
          sale_date: form.sale_date,
          payment_mode: form.payment_mode || "CASH",
          discount_amount: 0,
          tax_amount: 0,
          account_name: form.account_name || null,
          items: cleanItems,
          products: cleanItems,
          mode: "PACK",
          pack_type: "COMBO",
          status: "Packed",
        });
      } else {
        for (const item of cleanItems) {
          lastResponse = await axios.post(SALES_API, {
            platform: form.platform,
            platform_order_id: form.platform_order_id || null,
            customer_name: form.account_name || form.customer_name || "Direct Sale",
            invoice_no: form.invoice_no || null,
            awb_no: item.awbs?.[0] || primaryAwb,
            sale_date: form.sale_date,
            payment_mode: form.payment_mode || "CASH",
            discount_amount: 0,
            tax_amount: 0,
            account_name: form.account_name || null,
            items: [item],
            products: [item],
            mode: "PACK",
            pack_type: "SINGLE",
            status: "Packed",
          });
        }
      }

      writeSalesPackagingCache(packagingByAwb);
      resetSalesForm();
      await Promise.all([fetchSales(), fetchInventory(), fetchPackagingEntries()]);
      alert(
        lastResponse?.data?.message ||
          (totalAwbs > 0
            ? packType === "COMBO"
              ? `Combo sale saved with ${cleanItems.length} products on AWB ${primaryAwb}`
              : `${totalAwbs} AWB row-wise sales saved successfully`
            : "Sale saved successfully")
      );
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || "Unknown error";
      console.error("Error saving sale:", error);
      alert(`Failed to save sale: ${errorMsg}`);
    }
  };

  const handleSaleTypeChange = (nextSaleType) => {
    const normalizedType = normalizeSaleType(nextSaleType);
    setPackType(normalizedType);
    setForm((prev) => ({ ...prev, awb_no: "" }));
  };

  const handleComboAwbScan = async () => {
    const awb = normalizeAwb(form.awb_no);
    if (!awb) {
      alert("Combo AWB scan / enter karein");
      return;
    }

    try {
      const response = await axios.post(`${SALES_API}/awb/lifecycle`, {
        awb_no: awb,
        mode: "PACK",
        checkOnly: true,
      });

      setForm((prev) => ({ ...prev, awb_no: awb }));
      alert(response.data?.message || "Combo AWB ready hai. Ab products add karein.");
    } catch (error) {
      const errorMsg =
        error.response?.data?.message || error.message || "Combo AWB validate nahi ho paya";
      alert(errorMsg);
    }
  };

  const handleStatusOnlySubmit = async () => {
    const awb = String(form.awb_no || "").trim();
    if (!awb) {
      alert("AWB number required");
      return;
    }
    if (saleMode === "CANCEL" && !String(form.cancel_reason || "").trim()) {
      alert("Select cancel reason first");
      return;
    }

    try {
      const response = await axios.post(`${SALES_API}/awb/lifecycle`, {
        awb_no: awb,
        mode: saleMode,
        cancel_reason: saleMode === "CANCEL" ? form.cancel_reason : undefined,
      });
      await fetchSales();
      alert(response.data?.message || "AWB updated successfully");
      setForm((prev) => ({
        ...prev,
        awb_no: "",
        cancel_reason: saleMode === "CANCEL" ? prev.cancel_reason : "",
      }));
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || "Unable to update AWB";
      console.error("Error updating AWB lifecycle:", error);
      alert(errorMsg);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saleMode === "PACK") {
      await handlePackSubmit();
      return;
    }
    await handleStatusOnlySubmit();
  };

  const handleEdit = (sale) => {
    setEditId(sale.id);
    setSaleMode("PACK");
    setForm({
      platform: sale.platform || "DIRECT",
      platform_order_id: sale.platform_order_id || "",
      customer_name: sale.customer_name || "",
      invoice_no: sale.invoice_no || "",
      awb_no: sale.awb_no || sale.awb_number || sale.awbNumber || "",
      cancel_reason: sale.cancel_reason || "",
      sale_date: sale.sale_date
        ? String(sale.sale_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      payment_mode: sale.payment_mode || "CASH",
      discount_amount: "",
      account_name: sale.account_name || "",
    });
    setItems([
      {
        ...createEmptyItem(),
        inventory_id: "",
        quantity: sale.total_qty || "",
        selling_price: "",
      },
    ]);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this sale?")) return;
    try {
      await axios.delete(`${SALES_API}/${id}`);
      fetchSales();
    } catch (error) {
      console.error("Error deleting sale:", error);
      alert("Failed to delete sale. Please try again.");
    }
  };

  const handleScan = () => {
    const code = String(barcode || "").trim();

    if (!inventory.length) {
      alert("Inventory abhi load nahi hui");
      return;
    }

    if (!code) return;

    const product = inventory.find((item) => String(item.barcode || "").trim() === code);
    if (!product) {
      alert("Product not found for this barcode");
      return;
    }

    setItems((prev) => {
      const index = prev.findIndex(
        (item) => String(item.inventory_id) === String(product.id)
      );
      const next = [...prev];

      if (index === -1) {
        if (Number(product.stock || 0) < 1) {
          alert("No stock available for this product");
          return prev;
        }
        next.push({
          ...createEmptyItem(),
          inventory_id: product.id,
          quantity: 1,
          selling_price: product.price || "",
          ...getProductPackagingDefaults(product),
        });
      } else {
        const currentQty = Number(next[index].quantity || 0);
        if (currentQty + 1 > Number(product.stock || 0)) {
          alert("Insufficient stock for this product");
          return prev;
        }
        next[index] = {
          ...next[index],
          quantity: currentQty + 1,
        };
      }

      return next.filter((item) => item.inventory_id);
    });

    setBarcode("");
  };

  const handleOpenItemAwbModal = (index) => {
    if (packType === "COMBO") {
      alert("Combo mode me AWB top field me enter karein. Ye AWB sab products par apply hoga.");
      return;
    }

    const currentItem = items[index];
    if (!String(currentItem?.inventory_id || "").trim()) {
      alert("Select product first");
      return;
    }

    setActiveAwbItemIndex(index);
    setShowAwbScanModal(true);
  };

  const handleConfirmItemAwbs = (awbs) => {
    if (activeAwbItemIndex === null || activeAwbItemIndex === undefined) {
      setShowAwbScanModal(false);
      return;
    }

    const normalizedAwbs = normalizeAwbList(awbs);
    setItems((prev) => {
      const next = [...prev];
      const currentItem = next[activeAwbItemIndex];
      if (!currentItem) return prev;

      const itemTemplate = {
        ...currentItem,
        quantity: "",
      };
      const replacementRows = buildRowsFromAwbs(itemTemplate, normalizedAwbs);

      return [
        ...next.slice(0, activeAwbItemIndex),
        ...replacementRows,
        ...next.slice(activeAwbItemIndex + 1),
      ];
    });
    setShowAwbScanModal(false);
    setActiveAwbItemIndex(null);
  };

  const handlePackagingMaterialChange = (index, materialName) => {
    const targetInventoryId = String(items[index]?.inventory_id || "").trim();
    const nextPackagingCost = materialName ? packagingCostMap.get(materialName) || "0" : "";

    setItems((prev) =>
      prev.map((item, itemIndex) => {
        if (
          itemIndex !== index &&
          (!targetInventoryId || String(item.inventory_id || "").trim() !== targetInventoryId)
        ) {
          return item;
        }

        return {
          ...item,
          packaging_material: materialName,
          packaging_cost: nextPackagingCost,
        };
      })
    );
  };

  const _handleTaxPercentChange = (index, nextTaxPercent) => {
    const targetInventoryId = String(items[index]?.inventory_id || "").trim();

    setItems((prev) =>
      prev.map((item) => {
        if (
          String(item?.inventory_id || "").trim() !== targetInventoryId ||
          !targetInventoryId
        ) {
          return item;
        }

        return {
          ...item,
          tax_percent: nextTaxPercent,
        };
      })
    );
  };

  const _handleAwbScanSubmit = async (awb) => {
    if (saleMode === "CANCEL" && !String(form.cancel_reason || "").trim()) {
      throw new Error("Select cancel reason first");
    }

    const lookupResponse = await axios.get(`${SALES_API}/awb/${encodeURIComponent(awb)}`);
    const lookupSale = lookupResponse.data?.sale || {};
    const lookupItems = Array.isArray(lookupResponse.data?.items) ? lookupResponse.data.items : [];
    const resultMeta = buildScanResultMeta(lookupSale);

    if (saleMode === "PACK") {
      const { nextItems, resultRows } = mergeScannedSaleItems(items, lookupItems, inventory);
      if (resultRows.length === 0) {
        throw new Error("No sale items found for this AWB");
      }

      const shouldSeedDraft =
        items.every((item) => isDraftItemEmpty(item)) &&
        !String(form.customer_name || form.account_name || form.invoice_no || form.awb_no).trim();

      setItems(nextItems);
      setForm((prev) => ({
        ...prev,
        platform: shouldSeedDraft ? lookupSale.platform || prev.platform : prev.platform,
        account_name: shouldSeedDraft
          ? lookupSale.account_name || prev.account_name
          : prev.account_name,
        customer_name: shouldSeedDraft
          ? lookupSale.customer_name || prev.customer_name
          : prev.customer_name,
        invoice_no: shouldSeedDraft ? lookupSale.invoice_no || prev.invoice_no : prev.invoice_no,
        awb_no: prev.awb_no || lookupSale.awb_no || awb,
      }));

      return {
        message:
          lookupItems.length === 1
            ? `${lookupItems[0]?.product_name || "Product"} added to the items table.`
            : `${lookupItems.length} item rows added to the items table.`,
        rows: resultRows.map((row) => ({
          awb,
          product: row.product,
          qty: row.qty,
          status: row.status,
          tone: row.tone,
          meta: resultMeta,
        })),
      };
    }

    const response = await axios.post(`${SALES_API}/awb/lifecycle`, {
      awb_no: awb,
      mode: saleMode,
      cancel_reason: saleMode === "CANCEL" ? form.cancel_reason : undefined,
    });
    await fetchSales();

    const updatedStatus =
      response.data?.status || (saleMode === "PICKUP" ? "Picked" : "Cancel");
    return {
      message: response.data?.message || "AWB updated successfully.",
      rows:
        lookupItems.length > 0
          ? lookupItems.map((item) => ({
              awb,
              product: item.product_name || `Product #${item.inventory_id}`,
              qty: Number(item.quantity || 0) || "-",
              status: updatedStatus,
              tone: "success",
              meta: resultMeta,
            }))
          : [
              {
                awb,
                product: lookupSale.customer_name || lookupSale.account_name || "-",
                qty: "-",
                status: updatedStatus,
                tone: "success",
                meta: resultMeta,
              },
            ],
    };
  };

  const resetFilters = () => {
    setFilterPlatform("");
    setFilterFromDate("");
    setFilterToDate("");
    setFilterStatus("");
    setFilterAWB("");
    setFilterProduct("");
    setFilterCustomer("");
    setFilterAccount("");
    setSummaryFilter("all");
  };

  const baseFilteredSales = useMemo(() => {
    return (sales || [])
      .map((sale) => {
        const status = normalizeStatus(sale.status);

        return {
          ...sale,
          _itemLabel: getSingleHistoryItemLabel(sale),
          _status: status,
        };
      })
      .filter((sale) => {
        if (
          filterPlatform &&
          String(sale.platform || "DIRECT").toUpperCase() !== filterPlatform.toUpperCase()
        ) {
          return false;
        }
        if (filterStatus && normalizeStatus(sale._status) !== normalizeStatus(filterStatus)) {
          return false;
        }
        if (
          filterAWB &&
          !String(sale.awbNumber || sale.awb_no || "")
            .toLowerCase()
            .includes(filterAWB.toLowerCase())
        ) {
          return false;
        }
        if (
          filterCustomer &&
          !String(sale.customer_name || sale.customerName || "")
            .toLowerCase()
            .includes(filterCustomer.toLowerCase())
        ) {
          return false;
        }
        if (
          filterAccount &&
          !String(sale.account_name || sale.accountName || "")
            .toLowerCase()
            .includes(filterAccount.toLowerCase())
        ) {
          return false;
        }
        if (
          filterProduct &&
          !String(sale._itemLabel || "").toLowerCase().includes(filterProduct.toLowerCase())
        ) {
          return false;
        }
        if (!isDateWithinRange(sale.sale_date, filterFromDate, filterToDate)) {
          return false;
        }
        return true;
      });
  }, [
    sales,
    filterPlatform,
    filterStatus,
    filterAWB,
    filterCustomer,
    filterProduct,
    filterFromDate,
    filterToDate,
    filterAccount,
  ]);

  const summaryCards = useMemo(() => {
    const normalizedSales = baseFilteredSales.map((sale) => ({
      ...sale,
      _status: normalizeStatus(sale.status || sale.tracking_status),
    }));

    return [
      {
        key: "all",
        label: "Gross Total Scan",
        value: normalizedSales.length,
        tone: "blue",
      },
      {
        key: "sales",
        label: "Gross Sales",
        value: `Rs.${normalizedSales
          .filter((sale) => normalizeStatus(sale._status) !== "Cancel")
          .reduce((sum, sale) => sum + toSafeNumber(sale.amount, 0), 0)
          .toFixed(2)}`,
        tone: "green",
      },
      {
        key: "cancelled",
        label: "Cancelled",
        value: normalizedSales.filter((sale) => normalizeStatus(sale._status) === "Cancel").length,
        tone: "red",
      },
    ];
  }, [baseFilteredSales]);

  const filteredSales = useMemo(() => {
    return baseFilteredSales.filter((sale) => {
        if (summaryFilter === "sales" && normalizeStatus(sale._status) === "Cancel") {
          return false;
        }
        if (summaryFilter === "cancelled" && normalizeStatus(sale._status) !== "Cancel") {
          return false;
        }
        return true;
      });
  }, [baseFilteredSales, summaryFilter]);

  useEffect(() => {
    setSalesPage(1);
  }, [
    filterPlatform,
    filterFromDate,
    filterToDate,
    filterStatus,
    filterAWB,
    filterProduct,
    filterCustomer,
    filterAccount,
    summaryFilter,
  ]);

  const salesPageCount = Math.max(1, Math.ceil(filteredSales.length / SALES_PAGE_SIZE));
  const paginatedSales = filteredSales.slice(
    (salesPage - 1) * SALES_PAGE_SIZE,
    salesPage * SALES_PAGE_SIZE
  );

  useEffect(() => {
    if (salesPage > salesPageCount) {
      setSalesPage(salesPageCount);
    }
  }, [salesPage, salesPageCount]);

  const downloadSampleExcel = () => {
    const csvContent = [
      "date,platform,customer_name,invoice_no,awb_number,payment_method,product_name,quantity,selling_price,discount,status",
      "2024-01-15,Flipkart,John Doe,INV-001,AWB123456,Cash,Product Name,1,100,0,Packed",
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sample_sales_upload.csv";
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ];

    if (!validTypes.includes(file.type)) {
      alert("Please upload a valid Excel (.xlsx) or CSV file");
      return;
    }


    setUploadFile(file);
    setUploadLoading(true);
    setUploadErrors([]);

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const processedData = [];
      const errors = [];
      const awbNumbers = new Set();

      jsonData.forEach((row, index) => {
        const rowNum = index + 1;

        if (!row.awb_number && !row.product_name && !row.quantity) {
          return;
        }

        const validationErrors = [];

        if (!row.awb_number) validationErrors.push("AWB number is required");
        if (!row.product_name) validationErrors.push("Product name is required");
        if (!row.quantity || Number(row.quantity) <= 0) {
          validationErrors.push("Quantity must be greater than 0");
        }
        if (!row.selling_price || Number(row.selling_price) <= 0) {
          validationErrors.push("Selling price must be greater than 0");
        }

        if (row.awb_number && awbNumbers.has(row.awb_number)) {
          validationErrors.push("Duplicate AWB number");
        } else if (row.awb_number) {
          awbNumbers.add(row.awb_number);
        }

        let saleDate = new Date().toISOString().slice(0, 10);
        if (row.date) {
          const parsedDate = new Date(row.date);
          if (!Number.isNaN(parsedDate.getTime())) {
            saleDate = parsedDate.toISOString().slice(0, 10);
          }
        }

        const processedRow = {
          date: saleDate,
          platform: row.platform || "Direct",
          customer_name: row.customer_name || "",
          invoice_no: row.invoice_no || "",
          awb_number: row.awb_number || "",
          payment_method: row.payment_method || "Cash",
          product_name: row.product_name || "",
          quantity: Number(row.quantity) || 0,
          selling_price: Number(row.selling_price) || 0,
          discount: Number(row.discount) || 0,
          status: normalizeStatus(row.status || "Packed"),
        };

        if (validationErrors.length > 0) {
          errors.push({
            row: rowNum,
            errors: validationErrors,
            data: processedRow,
          });
          return;
        }

        processedData.push({
          ...processedRow,
          total:
            processedRow.quantity * processedRow.selling_price - processedRow.discount,
        });
      });

      setUploadData(processedData);
      setUploadErrors(errors);
      setUploadStep("preview");
    } catch (error) {
      console.error("Bulk upload read error:", error);
      alert("Failed to read file. Please ensure it is a valid Excel file.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleBulkUploadConfirm = async () => {
    if (uploadErrors.length > 0) {
      alert("Please fix all validation errors before uploading");
      return;
    }

    setUploadLoading(true);

    try {
      for (const sale of uploadData) {
        const inventoryItem = inventory.find(
          (item) => item.name?.toLowerCase() === sale.product_name.toLowerCase()
        );

        if (!inventoryItem) {
          console.warn("Product not found:", sale.product_name);
          continue;
        }

        await axios.post(SALES_API, {
          platform: sale.platform.toUpperCase(),
          platform_order_id: "",
          customer_name: sale.customer_name || "Direct Sale",
          invoice_no: sale.invoice_no,
          awb_no: sale.awb_number,
          sale_date: sale.date,
          payment_mode: sale.payment_method.toUpperCase(),
          discount_amount: sale.discount,
          tax_amount: 0,
          items: [
            {
              inventory_id: inventoryItem.id,
              quantity: sale.quantity,
              selling_price: sale.selling_price,
            },
          ],
          status: sale.status,
          mode: "PACK",
          upsertIfExists: true,
          source: "bulk_upload",
        });
      }

      setUploadStep("success");
      await Promise.all([fetchSales(), fetchInventory(), fetchPackagingEntries()]);
    } catch (error) {
      console.error("Bulk upload error:", error);
      alert("Failed to upload sales: " + (error.response?.data?.message || error.message));
    } finally {
      setUploadLoading(false);
    }
  };

  const resetBulkUpload = () => {
    setShowBulkUploadModal(false);
    setUploadFile(null);
    setUploadData([]);
    setUploadErrors([]);
    setUploadLoading(false);
    setUploadStep("upload");
  };

  const modeDescription =
    saleMode === "PACK"
      ? packType === "COMBO"
        ? "Combo mode me ek AWB multiple products par apply hoga. Single mode purani product-wise scanning jaisa hi rahega."
        : "Pack mode now supports product-wise AWB scanning with packaging cost auto calculation."
      : saleMode === "PICKUP"
      ? "Pickup mode updates a Packed AWB to Picked and records the dispatch date."
      : "Cancel mode updates the existing AWB to Cancel and stores the selected cancel reason.";

  return (
    <div className="page-container">
      <div className="purchase-top-bar">
        <h2>Sales Management (Vyapar Style)</h2>
        <div className="sales-header-actions">
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="sales-top-btn sales-top-btn-history"
          >
            Back
          </button>

          <button
            type="button"
            onClick={() => navigate("/sales/history")}
            className="sales-top-btn sales-top-btn-history"
          >
            Sales History
          </button>

          <button
            type="button"
            onClick={() => navigate("/sales/accounts")}
            className="sales-top-btn sales-top-btn-history"
          >
            Add Account
          </button>

          

          <button
            type="button"
            className="sales-top-btn sales-top-btn-upload"
            onClick={() => setShowBulkUploadModal(true)}
          >
            Bulk Upload (Excel)
          </button>
        </div>
      </div>

      <div className="sales-mode-note">{modeDescription}</div>

      <div className="sales-summary-cards">
        {summaryCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`sales-summary-card sales-summary-card-${card.tone} ${
              summaryFilter === card.key ? "active" : ""
            }`}
            onClick={() => setSummaryFilter(card.key)}
          >
            <span className="sales-summary-card-label">{card.label}</span>
            <span className="sales-summary-card-value">{card.value}</span>
          </button>
        ))}
      </div>

      <div className="inventory-card">
        {saleMode !== "PACK" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
            <input
              placeholder="Scan / Enter Barcode"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleScan();
                }
              }}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <button type="button" className="edit-btn" onClick={handleScan}>
              Scan and Add
            </button>
          </div>
        )}

        <form
          className={`inventory-form ${saleMode === "PACK" ? "sales-pack-form" : ""}`}
          onSubmit={handleSubmit}
        >
          {saleMode === "PACK" ? (
            <>
              <select
                className="sales-pack-mode-select"
                value={saleMode}
                onChange={(event) => setSaleMode(event.target.value)}
              >
                {MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={form.platform}
                onChange={(event) => setForm({ ...form, platform: event.target.value })}
              >
                <option value="DIRECT">Direct</option>
                <option value="FLIPKART">Flipkart</option>
                <option value="AMAZON">Amazon</option>
                <option value="MEESHO">Meesho</option>
                <option value="WEBSITE">Website</option>
              </select>

              <select
                value={form.account_name}
                onChange={(event) => setForm({ ...form, account_name: event.target.value })}
              >
                <option value="">Select Account</option>
                {platformAccounts.map((account) => (
                  <option key={account.id} value={account.account_name}>
                    {account.account_name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={form.sale_date}
                onChange={(event) => setForm({ ...form, sale_date: event.target.value })}
                required
              />

              {packType === "COMBO" && (
                <div className="sales-combo-awb-scan">
                  <input
                    placeholder="Scan / Enter Shared AWB"
                    value={form.awb_no}
                    onChange={(event) => setForm({ ...form, awb_no: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleComboAwbScan();
                      }
                    }}
                    required
                  />
                  <button type="button" onClick={handleComboAwbScan}>
                    Scan AWB
                  </button>
                </div>
              )}

              <button
                type="submit"
                id="sales-add-sale-btn"
                className="sales-submit-btn"
              >
                Add Sale
              </button>
            </>
          ) : (
            <>
              <div className="sales-mode-inline-field">
                <label htmlFor="sales-mode-select">Mode</label>
                <select
                  id="sales-mode-select"
                  value={saleMode}
                  onChange={(event) => setSaleMode(event.target.value)}
                >
                  {MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={form.platform}
                onChange={(event) => setForm({ ...form, platform: event.target.value })}
              >
                <option value="DIRECT">Direct</option>
                <option value="FLIPKART">Flipkart</option>
                <option value="AMAZON">Amazon</option>
                <option value="MEESHO">Meesho</option>
                <option value="WEBSITE">Website</option>
              </select>

              <select
                value={form.account_name}
                onChange={(event) => setForm({ ...form, account_name: event.target.value })}
              >
                <option value="">Select Account</option>
                {platformAccounts.map((account) => (
                  <option key={account.id} value={account.account_name}>
                    {account.account_name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={form.sale_date}
                onChange={(event) => setForm({ ...form, sale_date: event.target.value })}
                required
              />

              <input
                placeholder="AWB Number"
                value={form.awb_no}
                onChange={(event) => setForm({ ...form, awb_no: event.target.value })}
                required
              />

              {saleMode === "CANCEL" && (
                <select
                  value={form.cancel_reason}
                  onChange={(event) => setForm({ ...form, cancel_reason: event.target.value })}
                  required
                >
                  <option value="">Select Cancel Reason</option>
                  {CANCEL_REASON_OPTIONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              )}

              <button type="submit" className="primary-btn">
                {getModeSubmitLabel(saleMode, editId)}
              </button>
            </>
          )}
        </form>

        {saleMode !== "PACK" && (
          <div className="sales-inline-note">
            Cancel mode me submit existing AWB ko selected cancel reason ke saath update karega.
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: "10px 0" }}>Items</h4>
          {packagingOptions.length === 0 ? (
            <div className="sales-inline-note" style={{ marginBottom: 10 }}>
              Packaging materials abhi Packaging module se load nahi huye. Pehle Packaging section me
              material add karein.
            </div>
          ) : null}
          <div className="sales-items-table-wrap">
            <table className="inventory-table sales-items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Available</th>
                <th>Sale Type</th>
                <th>Qty</th>
                <th>Packaging Material</th>
                <th>Packaging Cost</th>
                <th>Total</th>
                <th>Scan</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const selected = inventory.find(
                  (product) => String(product.id) === String(item.inventory_id)
                );
                const available = selected ? Number(selected.stock || 0) : 0;
                const scannedAwbs = normalizeAwbList(item.awbs);
                const quantityValue =
                  packType === "COMBO" ? 1 : scannedAwbs.length || Number(item.quantity || 0);
                const rowTotal =
                  quantityValue * Number(item.selling_price || 0) +
                  quantityValue * Number(item.packaging_cost || 0);

                return (
                  <tr key={index}>
                    <td>
                      <SearchableSelect
                        options={inventory}
                        value={item.inventory_id}
                        onChange={(inventoryId) => {
                          const product = inventory.find(
                            (inventoryItem) => String(inventoryItem.id) === String(inventoryId)
                          );
                          const next = [...items];
                          next[index] = {
                            ...next[index],
                            inventory_id: inventoryId,
                            selling_price: product
                              ? String(product.price || "")
                              : next[index].selling_price,
                          };
                          setItems(next);
                        }}
                        getOptionLabel={(product) => `${product.name} (${product.category})`}
                        getOptionValue={(product) => String(product.id)}
                        placeholder="Select Item"
                      />
                    </td>
                    <td style={{ fontWeight: 800 }}>{available}</td>
                    <td>
                      <select
                        className="sales-row-sale-type-select"
                        value={packType}
                        onChange={(event) => handleSaleTypeChange(event.target.value)}
                      >
                        <option value="SINGLE">Single</option>
                        <option value="COMBO">Combo</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        placeholder="Qty"
                        value={packType === "COMBO" ? 1 : scannedAwbs.length ? quantityValue : item.quantity}
                        onChange={(event) => {
                          const next = [...items];
                          next[index] = { ...next[index], quantity: event.target.value };
                          setItems(next);
                        }}
                        readOnly={packType === "COMBO" || scannedAwbs.length > 0}
                        required={index === 0}
                      />
                    </td>
                    <td>
                      <select
                        value={item.packaging_material}
                        onChange={(event) =>
                          handlePackagingMaterialChange(index, event.target.value)
                        }
                      >
                        <option value="">Select Packaging</option>
                        {packagingOptions.map((option) => (
                          <option key={option.name} value={option.name}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        placeholder="Cost"
                        value={item.packaging_cost}
                        readOnly
                      />
                    </td>
                    <td className="total-cell">
                      Rs.{rowTotal.toFixed(2)}
                      {Number(item.packaging_cost || 0) > 0 && quantityValue > 0 ? (
                        <div className="sales-table-subtext">
                          Inc. packaging Rs.
                          {(quantityValue * Number(item.packaging_cost || 0)).toFixed(2)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="scan-awb-btn"
                        disabled={packType === "COMBO"}
                        onClick={() => handleOpenItemAwbModal(index)}
                      >
                        {packType === "COMBO" ? "Shared AWB" : "Scan AWB"}
                      </button>
                      {scannedAwbs.length > 0 ? (
                        <div className="sales-table-subtext">{scannedAwbs.length} scanned</div>
                      ) : packType === "COMBO" && form.awb_no ? (
                        <div className="sales-table-subtext">{normalizeAwb(form.awb_no)}</div>
                      ) : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => {
                          if (items.length === 1) return;
                          setItems(items.filter((_, itemIndex) => itemIndex !== index));
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>

          <button
            type="button"
            className="add-item-btn"
            style={{ marginTop: 10 }}
            onClick={() => setItems([...items, createEmptyItem()])}
          >
            + Add Item
          </button>
        </div>

        <div style={{ marginTop: 14, fontWeight: 800, color: "#1e40af" }}>
          Product Total: Rs.{itemsSubTotal.toFixed(2)} | Packaging Total: Rs.
          {packagingTotal.toFixed(2)} | Discount: Rs.{discountAmount.toFixed(2)} | Total: Rs.
          {totalAmount.toFixed(2)}
        </div>

        <div className="inventory-form sales-filters-form" style={{ marginTop: 16 }}>
          <select
            value={filterPlatform}
            onChange={(event) => setFilterPlatform(event.target.value)}
          >
            <option value="">All Platforms</option>
            <option value="DIRECT">Direct</option>
            <option value="FLIPKART">Flipkart</option>
            <option value="AMAZON">Amazon</option>
            <option value="MEESHO">Meesho</option>
            <option value="WEBSITE">Website</option>
          </select>

          <input
            type="date"
            value={filterFromDate}
            onChange={(event) => setFilterFromDate(event.target.value)}
            placeholder="From"
          />
          <input
            type="date"
            value={filterToDate}
            onChange={(event) => setFilterToDate(event.target.value)}
            placeholder="To"
          />

          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={filterAccount}
            onChange={(event) => setFilterAccount(event.target.value)}
          >
            <option value="">All Accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.account_name}>
                {account.account_name}
              </option>
            ))}
          </select>

          <input
            placeholder="Filter by AWB"
            value={filterAWB}
            onChange={(event) => setFilterAWB(event.target.value)}
          />
          <input
            placeholder="Filter by Product"
            value={filterProduct}
            onChange={(event) => setFilterProduct(event.target.value)}
          />
          <input
            placeholder="Filter by Customer"
            value={filterCustomer}
            onChange={(event) => setFilterCustomer(event.target.value)}
          />

          <button
            type="button"
            id="sales-reset-filters-btn"
            className="sales-filters-reset-btn"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>

        <div className="sales-history-scroll">
          <table className="inventory-table sales-history-table" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Platform</th>
                <th>Account</th>
                <th>AWB</th>
                <th>Sale Type</th>
                <th>Items</th>
                <th>Packaging Material</th>
                <th>Packaging Cost</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSales.map((sale) => (
                <tr key={`${sale.id}-${sale.sales_awb_id || sale.awb_no || sale.awbNumber || "sale"}`}>
                  <td className="sales-history-date-cell">{formatHistoryDate(sale.sale_date)}</td>
                  <td>{sale.platform || "DIRECT"}</td>
                  <td>{sale.account_name || "-"}</td>
                  <td style={{ fontWeight: 800 }}>
                    {sale.awbNumber || sale.awb_no || sale.awb || "N/A"}
                  </td>
                  <td>{formatSaleType(sale.sale_type || sale.saleType)}</td>
                  <td className="sales-history-items-cell">{sale._itemLabel || "-"}</td>
                  <td>{sale.packaging_material || "-"}</td>
                  <td>Rs.{Number(sale.packaging_cost || 0).toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(sale._status)}`}>
                      {normalizeStatus(sale._status)}
                    </span>
                  </td>
                  <td className="sales-history-actions-cell">
                    <button className="edit-btn" onClick={() => handleEdit(sale)}>
                      Edit
                    </button>
                    <button className="delete-btn" onClick={() => handleDelete(sale.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center" }}>
                    No sales found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredSales.length > SALES_PAGE_SIZE && (
          <div className="sales-pagination">
            <button
              type="button"
              className="sales-pagination-btn"
              disabled={salesPage === 1}
              onClick={() => setSalesPage((page) => Math.max(1, page - 1))}
            >
              Prev
            </button>
            {Array.from({ length: salesPageCount }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                className={`sales-pagination-btn ${salesPage === page ? "active" : ""}`}
                onClick={() => setSalesPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              className="sales-pagination-btn"
              disabled={salesPage === salesPageCount}
              onClick={() => setSalesPage((page) => Math.min(salesPageCount, page + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <SalesAwbScanModal
        open={showAwbScanModal}
        productName={
          activeAwbItemIndex !== null && activeAwbItemIndex !== undefined
            ? inventory.find(
                (product) =>
                  String(product.id) === String(items[activeAwbItemIndex]?.inventory_id || "")
              )?.name || "Selected product"
            : "Selected product"
        }
        packagingMaterial={
          activeAwbItemIndex !== null && activeAwbItemIndex !== undefined
            ? items[activeAwbItemIndex]?.packaging_material || ""
            : ""
        }
        packagingCost={
          activeAwbItemIndex !== null && activeAwbItemIndex !== undefined
            ? items[activeAwbItemIndex]?.packaging_cost || 0
            : 0
        }
        initialAwbs={
          activeAwbItemIndex !== null && activeAwbItemIndex !== undefined
            ? items[activeAwbItemIndex]?.awbs || []
            : []
        }
        onClose={() => {
          setShowAwbScanModal(false);
          setActiveAwbItemIndex(null);
        }}
        onConfirm={handleConfirmItemAwbs}
      />

      {showBulkUploadModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: "white",
              padding: "0",
              borderRadius: "16px",
              maxWidth: "900px",
              width: "95%",
              maxHeight: "85vh",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid rgba(229, 231, 235, 0.2)",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                padding: "24px 32px",
                borderRadius: "16px 16px 0 0",
                position: "relative",
              }}
            >
              <h3
                style={{
                  margin: "0",
                  color: "white",
                  fontSize: "24px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                  }}
                >
                  XL
                </div>
                Bulk Upload Sales (Excel)
              </h3>
              <p
                style={{
                  margin: "8px 0 0 0",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "14px",
                  fontWeight: "400",
                }}
              >
                Import multiple sales from Excel or CSV file
              </p>
            </div>

            <div style={{ padding: "32px" }}>
              {uploadStep === "upload" && (
                <div>
                  <div style={{ marginBottom: "32px", textAlign: "center" }}>
                    <button
                      onClick={downloadSampleExcel}
                      style={{
                        padding: "16px 32px",
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: "12px",
                        cursor: "pointer",
                        fontWeight: "700",
                        fontSize: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        boxShadow: "0 6px 20px rgba(16, 185, 129, 0.3)",
                        transition: "all 0.3s ease",
                      }}
                      onMouseOver={(event) => {
                        event.target.style.transform = "translateY(-2px)";
                        event.target.style.boxShadow = "0 8px 24px rgba(16, 185, 129, 0.4)";
                      }}
                      onMouseOut={(event) => {
                        event.target.style.transform = "translateY(0)";
                        event.target.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.3)";
                      }}
                    >
                      <span style={{ fontSize: "20px" }}>DL</span>
                      Download Sample Excel
                    </button>
                  </div>

                  <div style={{ marginBottom: "32px" }}>
                    <div
                      style={{
                        border: "3px dashed #3b82f6",
                        borderRadius: "16px",
                        padding: "40px",
                        textAlign: "center",
                        backgroundColor: "#eff6ff",
                        transition: "all 0.3s ease",
                      }}
                    >
                      <input
                        type="file"
                        accept=".xlsx,.csv"
                        onChange={handleFileUpload}
                        style={{
                          padding: "16px 24px",
                          border: "2px solid #3b82f6",
                          borderRadius: "8px",
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "#1e40af",
                          backgroundColor: "white",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                        }}
                      />
                      <p
                        style={{
                          margin: "16px 0 0 0",
                          color: "#64748b",
                          fontSize: "14px",
                          fontWeight: "500",
                        }}
                      >
                        Choose Excel or CSV file to upload
                      </p>
                    </div>
                  </div>

                  {uploadLoading && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px",
                        backgroundColor: "#f0f9ff",
                        borderRadius: "12px",
                        border: "1px solid #bae6fd",
                      }}
                    >
                      <div
                        style={{
                          color: "#0284c7",
                          fontSize: "18px",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: "24px",
                            height: "24px",
                            border: "3px solid #0284c7",
                            borderTop: "3px solid transparent",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        Processing your file...
                      </div>
                    </div>
                  )}
                </div>
              )}

              {uploadStep === "preview" && (
                <div>
                  <div style={{ marginBottom: "24px" }}>
                    <h4
                      style={{
                        color: "#1e293b",
                        fontSize: "18px",
                        fontWeight: "700",
                        marginBottom: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span style={{ fontSize: "22px" }}>PR</span>
                      Preview ({uploadData.length} valid sales)
                    </h4>
                    {uploadErrors.length > 0 && (
                      <div
                        style={{
                          marginBottom: "20px",
                          padding: "16px",
                          backgroundColor: "#fef2f2",
                          borderRadius: "10px",
                          border: "1px solid #fecaca",
                        }}
                      >
                        <strong
                          style={{
                            color: "#dc2626",
                            fontSize: "15px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "12px",
                          }}
                        >
                          <span style={{ fontSize: "18px" }}>!</span>
                          Validation Errors ({uploadErrors.length}):
                        </strong>
                        <ul
                          style={{
                            marginLeft: "20px",
                            color: "#dc2626",
                            fontSize: "13px",
                            lineHeight: "1.6",
                          }}
                        >
                          {uploadErrors.map((error, index) => (
                            <li key={index}>
                              <strong>Row {error.row}:</strong> {error.errors.join(", ")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      maxHeight: "350px",
                      overflow: "auto",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                      }}
                    >
                      <thead
                        style={{
                          backgroundColor: "#f8fafc",
                          position: "sticky",
                          top: 0,
                          borderBottom: "2px solid #e2e8f0",
                        }}
                      >
                        <tr>
                          {["Row", "Customer", "Product", "Qty", "Price", "Total", "AWB"].map(
                            (heading) => (
                              <th
                                key={heading}
                                style={{
                                  padding: "14px 12px",
                                  border: "1px solid #e2e8f0",
                                  fontWeight: "600",
                                  color: "#374151",
                                  textAlign:
                                    heading === "Qty" || heading === "Price" || heading === "Total"
                                      ? "right"
                                      : "left",
                                  background: "#f9fafb",
                                }}
                              >
                                {heading}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {uploadData.map((row, index) => (
                          <tr
                            key={index}
                            style={{
                              backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                            }}
                          >
                            <td
                              style={{
                                padding: "12px",
                                border: "1px solid #e2e8f0",
                                fontWeight: "600",
                                color: "#6b7280",
                              }}
                            >
                              {index + 1}
                            </td>
                            <td style={{ padding: "12px", border: "1px solid #e2e8f0" }}>
                              {row.customer_name}
                            </td>
                            <td style={{ padding: "12px", border: "1px solid #e2e8f0" }}>
                              {row.product_name}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                border: "1px solid #e2e8f0",
                                textAlign: "right",
                                fontWeight: "600",
                              }}
                            >
                              {row.quantity}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                border: "1px solid #e2e8f0",
                                textAlign: "right",
                              }}
                            >
                              Rs.{row.selling_price}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                border: "1px solid #e2e8f0",
                                textAlign: "right",
                                color: "#059669",
                                fontWeight: "700",
                              }}
                            >
                              Rs.{row.total.toFixed(2)}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                border: "1px solid #e2e8f0",
                                fontWeight: "600",
                              }}
                            >
                              {row.awb_number}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      marginTop: "24px",
                      display: "flex",
                      gap: "12px",
                      justifyContent: "flex-end",
                      padding: "16px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                    }}
                  >
                    <button
                      onClick={() => setUploadStep("upload")}
                      style={{
                        padding: "12px 20px",
                        backgroundColor: "#6b7280",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "14px",
                        transition: "all 0.3s ease",
                      }}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleBulkUploadConfirm}
                      disabled={uploadErrors.length > 0 || uploadLoading}
                      style={{
                        padding: "12px 24px",
                        backgroundColor: uploadErrors.length > 0 ? "#9ca3af" : "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: uploadErrors.length > 0 ? "not-allowed" : "pointer",
                        fontWeight: "600",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        transition: "all 0.3s ease",
                      }}
                    >
                      {uploadLoading ? "Uploading..." : `Upload ${uploadData.length} Sales`}
                    </button>
                  </div>
                </div>
              )}

              {uploadStep === "success" && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "48px 32px",
                    backgroundColor: "#f0fdf4",
                    borderRadius: "16px",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <div
                    style={{
                      fontSize: "64px",
                      color: "#10b981",
                      marginBottom: "24px",
                      animation: "bounce 1s ease-in-out",
                    }}
                  >
                    OK
                  </div>
                  <h4
                    style={{
                      color: "#059669",
                      marginBottom: "12px",
                      fontSize: "24px",
                      fontWeight: "700",
                    }}
                  >
                    Sales Processed Successfully!
                  </h4>
                  <p
                    style={{
                      marginBottom: "32px",
                      color: "#047857",
                      fontSize: "16px",
                      lineHeight: "1.6",
                    }}
                  >
                    {uploadData.length} sales rows have been processed in your system.
                  </p>
                  <button
                    onClick={resetBulkUpload}
                    style={{
                      padding: "14px 28px",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontWeight: "700",
                      fontSize: "16px",
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                      transition: "all 0.3s ease",
                    }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={resetBulkUpload}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                background: "rgba(255,255,255,0.2)",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "white",
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              X
            </button>

            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes bounce {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-20px); }
                60% { transform: translateY(-10px); }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}
