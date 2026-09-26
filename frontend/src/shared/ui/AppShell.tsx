import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/modules/auth/AuthContext";

export function RequireAuth() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function AppShell() {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          Speak<span>Coach</span>
        </div>
        {user && (
          <div className="topbar-meta">
            <span>{user.displayName}</span>
            <button className="btn btn-ghost" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
