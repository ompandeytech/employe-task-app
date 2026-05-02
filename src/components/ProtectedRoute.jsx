import { Navigate } from "react-router-dom";

const FIXED_PAGES = ["attendance", "tasks", "report", "profile"];
const DYNAMIC_PAGES = ["sales", "manufacture", "rto"];

export default function ProtectedRoute({ children, page }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const permissions = JSON.parse(localStorage.getItem("permissions") || "[]");

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (page && FIXED_PAGES.includes(page)) {
    return children;
  }

  if (
    page &&
    DYNAMIC_PAGES.includes(page) &&
    permissions.length &&
    !permissions.includes(page)
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
}
