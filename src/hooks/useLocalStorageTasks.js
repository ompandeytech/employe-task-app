export function subscribeStorage(callback) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function getStorage(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}
