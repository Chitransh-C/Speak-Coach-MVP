import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/modules/auth/AuthContext";

export function RequireAdmin() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

const LINKS = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/tracks", label: "Tracks" },
  { to: "/admin/scenarios", label: "Scenarios" },
  { to: "/admin/prompts", label: "Prompts" },
  { to: "/admin/sessions", label: "Sessions" },
  { to: "/admin/health", label: "Health" },
] as const;

export function AdminShell() {
  return (
    <div className="admin-layout">
      <header className="admin-subnav">
        <div className="admin-subnav-title">Admin</div>
        <nav className="admin-subnav-links" aria-label="Admin">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={"end" in l ? l.end : false}
              className={({ isActive }) => `admin-subnav-link ${isActive ? "active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/" className="admin-subnav-back">
          ← Learner app
        </NavLink>
      </header>
      <div className="admin-page">
        <Outlet />
      </div>
    </div>
  );
}
