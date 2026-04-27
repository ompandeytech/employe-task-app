import axios from "axios";
import { API_BASE, getAuthHeaders } from "../utils/apiConfig";

const client = axios.create({
  baseURL: API_BASE,
});

client.interceptors.request.use((config) => {
  const headers = getAuthHeaders();
  config.headers = {
    ...(config.headers || {}),
    ...headers,
  };
  return config;
});

export default client;
