import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const normalizeRows = (value, scanType) =>
  String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((awbNumber, index) => ({
      id: `${scanType}-${Date.now()}-${index}`,
      awbNumber,
      type: scanType,
      verification: "Pending",
      date: new Date().toISOString(),
    }));

export default function RtoWarehouseScanModal({ open, onClose, onSaved, scanType = "RTO" }) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (open) setDraft("");
  }, [open]);

  const parsedRows = useMemo(() => normalizeRows(draft, scanType), [draft, scanType]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 1200,
      }}
    >
      <div
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          background: "#fff",
          borderRadius: "18px",
          padding: "20px",
          boxShadow: "0 24px 50px rgba(15, 23, 42, 0.22)",
        }}
      >
        <div className="modal-header" style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: 0 }}>Scan {scanType} AWBs</h3>
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Enter one AWB per line"
          rows={10}
          style={{
            width: "100%",
            resize: "vertical",
            borderRadius: "12px",
            border: "1px solid #cbd5e1",
            padding: "12px",
            boxSizing: "border-box",
            marginBottom: "12px",
          }}
        />
        <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "13px" }}>
          {parsedRows.length} AWB rows ready
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onSaved(parsedRows);
              onClose();
            }}
            disabled={parsedRows.length === 0}
          >
            Save Rows
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
