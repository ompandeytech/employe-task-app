import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

export default function MainLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div style={{ width: "100%" }}>
        <Navbar />
        <Outlet />
      </div>
    </div>
  );
}
