import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import "./SalesAwbScanModal.css";

const normalizeAwb = (value) => String(value || "").trim();

const buildUniqueAwbs = (awbs) => {
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

const createPreviewRow = (awb, type = "ordered") => ({
  id: `${type}-${awb}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  awb,
  type,
});

export default function SalesAwbScanModal({
  open,
  productName = "",
  packagingMaterial = "",
  packagingCost = 0,
  initialAwbs = [],
  onClose,
  onConfirm,
}) {
  const uniqueInitialAwbs = useMemo(() => buildUniqueAwbs(initialAwbs), [initialAwbs]);
  const resetKey = useMemo(
    () => [productName, packagingMaterial, packagingCost, ...uniqueInitialAwbs].join("||"),
    [packagingCost, packagingMaterial, productName, uniqueInitialAwbs]
  );

  if (!open) return null;

  return (
    <SalesAwbScanModalContent
      key={resetKey}
      productName={productName}
      packagingMaterial={packagingMaterial}
      packagingCost={packagingCost}
      initialAwbs={uniqueInitialAwbs}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function SalesAwbScanModalContent({
  productName,
  packagingMaterial,
  packagingCost,
  initialAwbs,
  onClose,
  onConfirm,
}) {
  const inputRef = useRef(null);
  const awbSetRef = useRef(new Set(initialAwbs));
  const audioContextRef = useRef(null);

  const [inputValue, setInputValue] = useState("");
  const [scannedAwbs, setScannedAwbs] = useState(() => initialAwbs);
  const [previewRows, setPreviewRows] = useState(() =>
    initialAwbs.map((awb) => createPreviewRow(awb, "ordered"))
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [totalScanCount, setTotalScanCount] = useState(() => initialAwbs.length);
  const [duplicateScanCount, setDuplicateScanCount] = useState(0);

  const formattedPackagingCost = useMemo(
    () => Number(packagingCost || 0).toFixed(2),
    [packagingCost]
  );

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const playBeep = (type = "success") => {
    if (typeof window === "undefined") return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const context = audioContextRef.current;
    const now = context.currentTime;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type === "duplicate" ? "square" : "sine";
    oscillator.frequency.setValueAtTime(type === "duplicate" ? 220 : 880, now);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + (type === "duplicate" ? 0.2 : 0.12));

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + (type === "duplicate" ? 0.22 : 0.14));
  };

  const handleAddAwb = () => {
    const normalized = normalizeAwb(inputValue);
    if (!normalized) {
      setErrorMessage("Scan a valid AWB number.");
      return;
    }

    setTotalScanCount((prev) => prev + 1);

    if (awbSetRef.current.has(normalized)) {
      setDuplicateScanCount((prev) => prev + 1);
      setPreviewRows((prev) => [createPreviewRow(normalized, "duplicate"), ...prev]);
      setErrorMessage(`${normalized} is already scanned.`);
      setInputValue("");
      playBeep("duplicate");
      return;
    }

    awbSetRef.current.add(normalized);
    setScannedAwbs((prev) => [...prev, normalized]);
    setPreviewRows((prev) => [createPreviewRow(normalized, "ordered"), ...prev]);
    setInputValue("");
    setErrorMessage("");
    playBeep("success");
  };

  const successfulScanCount = scannedAwbs.length;

  return (
    <div className="sales-awb-modal-overlay">
      <div className="sales-awb-modal-card compact">
        <div className="sales-awb-modal-header">
          <div>
            <h3>Scan AWB Numbers</h3>
            <p>{productName || "Selected product"}</p>
          </div>
          <button type="button" className="sales-awb-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="sales-awb-modal-body compact">
          <div className="sales-awb-product-strip">
            <div>
              <span className="sales-awb-product-label">Product</span>
              <strong>{productName || "-"}</strong>
            </div>
            <div>
              <span className="sales-awb-product-label">Packaging</span>
              <strong>{packagingMaterial || "Not set"}</strong>
            </div>
            <div>
              <span className="sales-awb-product-label">Cost / Unit</span>
              <strong>Rs.{formattedPackagingCost}</strong>
            </div>
            <div>
              <span className="sales-awb-product-label">Scanned Qty</span>
              <strong>{scannedAwbs.length}</strong>
            </div>
          </div>

          <div className="sales-awb-stats-strip">
            <div className="sales-awb-stat-card">
              <span className="sales-awb-product-label">Total Scan</span>
              <strong>{totalScanCount}</strong>
            </div>
            <div className="sales-awb-stat-card success">
              <span className="sales-awb-product-label">Successfully Scanned</span>
              <strong>{successfulScanCount}</strong>
            </div>
            <div className="sales-awb-stat-card warning">
              <span className="sales-awb-product-label">Duplicate Scan</span>
              <strong>{duplicateScanCount}</strong>
            </div>
          </div>

          <form
            className="sales-awb-manual-form single-row"
            onSubmit={(event) => {
              event.preventDefault();
              handleAddAwb();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Scan AWB here"
              autoFocus
            />
            <button type="submit">Add</button>
          </form>

          <div className={`sales-awb-feedback ${errorMessage ? "error" : "info"}`}>
            {errorMessage || "Duplicate AWBs are blocked automatically. You can keep scanning continuously."}
          </div>

          <div className="sales-awb-results-panel compact">
            <div className="sales-awb-panel-title">
              <span>Scanned AWB List</span>
              <span className="sales-awb-scan-count">{scannedAwbs.length} scanned</span>
            </div>

            <div className="sales-awb-simple-list">
              {previewRows.length === 0 ? (
                <div className="sales-awb-empty-state">No AWB scanned yet.</div>
              ) : (
                previewRows.map((row) => (
                  <div key={row.id} className="sales-awb-simple-item">
                    <span>{row.awb}</span>
                    <span
                      className={`sales-awb-simple-status ${
                        row.type === "duplicate" ? "duplicate" : ""
                      }`}
                    >
                      {row.type === "duplicate" ? "DUPLICATE" : "ORDERED"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="sales-awb-footer">
          <button
            type="button"
            className="sales-awb-footer-btn muted"
            onClick={() => {
              awbSetRef.current = new Set();
              setScannedAwbs([]);
              setPreviewRows([]);
              setInputValue("");
              setErrorMessage("");
              setTotalScanCount(0);
              setDuplicateScanCount(0);
              inputRef.current?.focus();
            }}
          >
            Clear List
          </button>
          <button type="button" className="sales-awb-footer-btn muted" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sales-awb-footer-btn primary"
            onClick={() => onConfirm?.(scannedAwbs)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
