const parseStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

export const API_BASE = "https://techiohisab.com/api";
console.log("API_BASE:", API_BASE);

export const getStoredUserToken = () => {
  const storedUser = parseStoredUser();
  return storedUser?.token ?? null;
};

export const getAuthHeaders = () => {
  const token = getStoredUserToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};
