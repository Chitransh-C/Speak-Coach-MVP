import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/AuthContext";
import { LumiWidget } from "@/modules/lumi/LumiWidget";

export function RequireAuth() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

type NavItem = { to: string; label: string; end?: boolean; icon: string };

const TRAIN: NavItem[] = [
  { to: "/", label: "Scenarios", end: true, icon: "grid" },
  { to: "/my-scenarios", label: "My Scenarios", icon: "grid" },
  { to: "/scenarios/create", label: "Create Scenario", icon: "path" },
  { to: "/journey", label: "My Journey", icon: "path" },
];

const REVIEW: NavItem[] = [{ to: "/reports", label: "Activity", icon: "chart" }];

function NavIcon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (name === "grid") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (name === "path") {
    return (
      <svg {...common}>
        <path d="M4 19c4-2 6-8 8-8s4 4 8 2" />
        <circle cx="4" cy="19" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="11" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="20" cy="13" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M22 19V8" />
    </svg>
  );
}

function SideNavLinks({
  onNavigate,
  isAdmin,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
}) {
  return (
    <>
      <div className="side-nav-group">
        <p className="side-nav-label">Train</p>
        {TRAIN.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `side-nav-link ${isActive ? "active" : ""}`}
            onClick={onNavigate}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
      <div className="side-nav-group">
        <p className="side-nav-label">Review</p>
        {REVIEW.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `side-nav-link ${isActive ? "active" : ""}`}
            onClick={onNavigate}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
      {isAdmin && (
        <div className="side-nav-group">
          <p className="side-nav-label">Admin</p>
          <NavLink
            to="/admin"
            className={({ isActive }) => `side-nav-link ${isActive ? "active" : ""}`}
            onClick={onNavigate}
          >
            <NavIcon name="chart" />
            <span>Dashboard</span>
          </NavLink>
        </div>
      )}
    </>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const authPages = location.pathname === "/login" || location.pathname === "/signup";
  const showChrome = Boolean(user) && !authPages;

  return (
    <div className={`app-shell ${showChrome ? "app-shell--nav" : ""}`}>
      <div className="ambient" aria-hidden />

      {showChrome && (
        <>
          <aside className="side-nav" aria-label="Primary">
            <Link to="/" className="side-nav-brand">
              <img src="/brand/rolesmith-logo.svg" alt="RoleSmith" className="brand-mark" />
            </Link>
            <nav className="side-nav-body">
              <SideNavLinks isAdmin={user?.role === "admin"} />
            </nav>
            <div className="side-nav-footer">
              <button
                type="button"
                className="side-nav-user"
                onClick={() => navigate("/journey")}
              >
                <span className="avatar avatar-fallback" aria-hidden>
                  {user!.displayName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase() ?? "")
                    .join("") || "?"}
                </span>
                <span className="side-nav-user-text">
                  <span className="side-nav-user-name">{user!.displayName}</span>
                  <span className="side-nav-user-meta">{user!.email}</span>
                </span>
              </button>
              <button type="button" className="side-nav-signout" onClick={logout}>
                Sign out
              </button>
            </div>
          </aside>

          {drawerOpen && (
            <button
              type="button"
              className="side-nav-backdrop"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            />
          )}
          <aside
            className={`side-nav side-nav--drawer ${drawerOpen ? "open" : ""}`}
            aria-label="Mobile navigation"
          >
            <div className="side-nav-drawer-head">
              <Link to="/" className="side-nav-brand" onClick={() => setDrawerOpen(false)}>
                <img src="/brand/rolesmith-logo.svg" alt="RoleSmith" className="brand-mark" />
              </Link>
              <button
                type="button"
                className="side-nav-close"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
              >
                ×
              </button>
            </div>
            <nav className="side-nav-body">
              <SideNavLinks
                isAdmin={user?.role === "admin"}
                onNavigate={() => setDrawerOpen(false)}
              />
            </nav>
            <div className="side-nav-footer">
              <div className="side-nav-user" aria-hidden>
                <span className="avatar avatar-fallback">
                  {user!.displayName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase() ?? "")
                    .join("") || "?"}
                </span>
                <span className="side-nav-user-text">
                  <span className="side-nav-user-name">{user!.displayName}</span>
                  <span className="side-nav-user-meta">{user!.email}</span>
                </span>
              </div>
              <button type="button" className="side-nav-signout" onClick={logout}>
                Sign out
              </button>
            </div>
          </aside>

          <header className="app-top">
            <button
              type="button"
              className="nav-burger"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>
            <Link to="/" className="brand-lockup app-top-brand">
              <img src="/brand/rolesmith-logo.svg" alt="RoleSmith" className="brand-mark" />
            </Link>
            <div className="app-top-spacer" />
            <span className="app-top-chip hide-sm">Gemini Live practice</span>
          </header>
        </>
      )}

      {!showChrome && (
        <header className="topbar topbar--auth">
          <div className="topbar-inner">
            <Link to="/login" className="brand-lockup">
              <img src="/brand/rolesmith-logo.svg" alt="RoleSmith" className="brand-mark" />
            </Link>
          </div>
        </header>
      )}

      <main className={`main ${authPages ? "main-auth" : ""} ${showChrome ? "main--with-nav" : ""}`}>
        <Outlet />
      </main>

      {showChrome && <LumiWidget />}
    </div>
  );
}
