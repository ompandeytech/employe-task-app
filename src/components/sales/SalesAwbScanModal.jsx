import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const normalizeAwbList = (awbs) => {
  const seen = new Set();
  return String(Array.isArray(awbs) ? awbs.join("\n") : awbs || "")
    .split(/\r?\n|,/)
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

export default function SalesAwbScanModal({
  open,
  productName,
  packagingMaterial,
  packagingCost,
  initialAwbs,
  onClose,
  onConfirm,
}) {
  const [draftValue, setDraftValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraftValue((Array.isArray(initialAwbs) ? initialAwbs : []).join("\n"));
  }, [open, initialAwbs]);

  const parsedAwbs = useMemo(() => normalizeAwbList(draftValue), [draftValue]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.62)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 1200,
      }}
    >
      <div
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          background: "#fff",
          borderRadius: "18px",
          boxShadow: "0 24px 50px rgba(15, 23, 42, 0.22)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
              Scan AWB
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#475569" }}>
              {productName || "Selected product"}
            </p>
            {(packagingMaterial || Number(packagingCost || 0) > 0) && (
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#64748b" }}>
                Packaging: {packagingMaterial || "-"} | Cost: Rs.
                {Number(packagingCost || 0).toFixed(2)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "#f1f5f9",
              color: "#0f172a",
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            X
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          <label
            htmlFor="sales-awb-input"
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#334155",
            }}
          >
            Enter or paste AWB numbers
          </label>
          <textarea
            id="sales-awb-input"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            placeholder="One AWB per line"
            rows={10}
            style={{
              width: "100%",
              resize: "vertical",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              padding: "12px 14px",
              fontSize: "14px",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#64748b" }}>
            {parsedAwbs.length} unique AWB{parsedAwbs.length === 1 ? "" : "s"} ready
          </p>
        </div>

        <div
          style={{
            padding: "16px 20px 20px",
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: "44px",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#0f172a",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(parsedAwbs)}
            style={{
              minHeight: "44px",
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Confirm AWB
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
