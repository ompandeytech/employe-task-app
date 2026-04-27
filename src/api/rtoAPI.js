import { API_BASE, getAuthHeaders } from "../utils/apiConfig";

const buildUrl = (path, params) => {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null || value === "") return;
    url.searchParams.set(key, value);
  });
  return url.toString();
};

const request = async (path, options = {}, params) => {
  const response = await fetch(buildUrl(path, params), {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json().catch(() => null);
};

const rtoAPI = {
  getRtoOrders: (params = {}) => request("/rto/orders", {}, params),
  getRtoSummary: (params = {}) => request("/rto/summary", {}, params),
  getCourierStats: (params = {}) => request("/rto/courier-stats", {}, params),
  getFraudZones: (params = {}) => request("/rto/fraud-zones", {}, params),
  getMarketplaceSplit: (params = {}) => request("/rto/marketplace-split", {}, params),
  getLossTrend: (params = {}) => request("/rto/loss-trend", {}, params),
  updateVerification: (orderId, payload) =>
    request(`/rto/orders/${orderId}/verification`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  saveScanEntries: (rows) =>
    request("/rto/scan-entries", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
  bulkVerifyRtoOrders: (payload) =>
    request("/rto/bulk-verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  shareOrders: (payload) =>
    request("/rto/share", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getTransferRequests: (destination) =>
    request("/rto/transfers", {}, { destination }),
  acceptTransfer: (transferId, destination) =>
    request(`/rto/transfers/${transferId}/accept`, {
      method: "POST",
      body: JSON.stringify({ destination }),
    }),
  rejectTransfer: (transferId, destination) =>
    request(`/rto/transfers/${transferId}/reject`, {
      method: "POST",
      body: JSON.stringify({ destination }),
    }),
  acceptAllTransfers: (destination) =>
    request("/rto/transfers/accept-all", {
      method: "POST",
      body: JSON.stringify({ destination }),
    }),
};

export default rtoAPI;
