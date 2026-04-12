import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import "@fortawesome/fontawesome-free/css/all.min.css";
import axios from "axios";

console.log("Hostname:", window.location.hostname);
axios.interceptors.request.use((config) => {
  console.log("🚀 REQUEST URL:", config.url);
  console.log("🌍 BASE URL:", config.baseURL);
  return config;
});

axios.interceptors.response.use(
  (response) => {
    console.log("✅ RESPONSE FROM:", response.config.url);
    return response;
  },
  (error) => {
    console.log("❌ ERROR FROM:", error.config?.url);
    return Promise.reject(error);
  }
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
