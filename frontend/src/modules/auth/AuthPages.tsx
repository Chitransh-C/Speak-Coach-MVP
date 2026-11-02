import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { HttpError } from "@/shared/api/client";
import { useAuth } from "./AuthContext";

function AuthStage({
  mode,
  title,
  subtitle,
  children,
}: {
  mode: "login" | "signup";
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className={`auth-stage auth-stage--${mode}`}>
      <section className="auth-brand" aria-label="RoleSmith">
        <p className="auth-brand-kicker">Live conversation practice</p>
        <h1 className="auth-brand-name">
          Role<span>Smith</span>
        </h1>
        <p className="auth-brand-lede">
          Rehearse interviews, sales calls, and roles you invent — then leave with scores you can act on.
        </p>
        <div className="auth-brand-visual" aria-hidden>
          <img src="/brand/rolesmith-auth-hero.jpg" alt="" />
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <header className="auth-panel-head">
            <h2>{title}</h2>
            <p className="muted">{subtitle}</p>
          </header>
          {children}
        </div>
      </section>
    </div>
  );
}

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthStage
      mode="login"
      title="Welcome back"
      subtitle="Sign in to continue your practice path."
    >
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary btn-block auth-submit" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="auth-switch muted">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </AuthStage>
  );
}

export function SignupPage() {
  const { signup, user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup(email, password, displayName);
      navigate("/");
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthStage
      mode="signup"
      title="Start practicing"
      subtitle="Create an account and open your first scenario."
    >
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="name">Display name</label>
          <input
            id="name"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span className="field-hint">At least 8 characters</span>
        </div>
        <button className="btn btn-primary btn-block auth-submit" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="auth-switch muted">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthStage>
  );
}
