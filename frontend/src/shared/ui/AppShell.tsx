import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/AuthContext";

export function RequireAuth() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

const NAV = [
  { to: "/", label: "Practice", end: true },
  { to: "/reports", label: "Reports" },
  { to: "/journey", label: "Journey" },
] as const;

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const authPages = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <div className="app-shell">
      <div className="ambient" aria-hidden />
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left">
            <Link to={user ? "/" : "/login"} className="brand-lockup">
              <img src="/brand/speakcoach-logo.svg" alt="SpeakCoach" className="brand-mark" />
            </Link>
            {user && !authPages && (
              <>
                <span className="topbar-divider" aria-hidden />
                <nav className="top-nav" aria-label="Primary">
                  {NAV.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={"end" in item ? item.end : false}
                      className={({ isActive }) => `nav-pill ${isActive ? "active" : ""}`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              </>
            )}
          </div>

          {user && !authPages && (
            <div className="topbar-right">
              <div className="profile-menu" ref={profileRef}>
                <button
                  type="button"
                  className="profile-trigger"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((v) => !v)}
                >
                  <span className="avatar-wrap">
                    <span className="avatar avatar-fallback" aria-hidden>
                      {user.displayName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase() ?? "")
                        .join("") || "?"}
                    </span>
                  </span>
                  <span className="profile-text hide-sm">
                    <span className="profile-name">{user.displayName}</span>
                  </span>
                  <span className="chevron" aria-hidden>
                    ▾
                  </span>
                </button>
                {profileOpen && (
                  <div className="profile-dropdown" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate("/journey");
                      }}
                    >
                      My Journey
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate("/reports");
                      }}
                    >
                      Reports
                    </button>
                    <hr />
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="nav-burger"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span />
                <span />
                <span />
              </button>
            </div>
          )}
        </div>
        {user && menuOpen && (
          <nav className="mobile-nav" aria-label="Mobile">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={"end" in item ? item.end : false}
                className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
            <button type="button" className="mobile-nav-link" onClick={logout}>
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main className={`main ${authPages ? "main-auth" : ""}`}>
        <Outlet />
      </main>
    </div>
  );
}
