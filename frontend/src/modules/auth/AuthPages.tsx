import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { HttpError } from "@/shared/api/client";
import { useAuth } from "./AuthContext";

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
    <div className="hero-auth">
      <div>
        <img src="/brand/speakcoach-logo.svg" alt="SpeakCoach" style={{ height: 48 }} />
        <p className="lede" style={{ marginTop: "1.25rem" }}>
          Practice high-stakes conversations with live voice feedback — Interviews and Sales tracks.
        </p>
      </div>
      <form className="panel" onSubmit={onSubmit}>
        <h2>Welcome back</h2>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Sign in to continue your coaching path.
        </p>
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
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="muted" style={{ marginTop: "1rem" }}>
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </div>
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
    <div className="hero-auth">
      <div>
        <img src="/brand/speakcoach-logo.svg" alt="SpeakCoach" style={{ height: 48 }} />
        <p className="lede" style={{ marginTop: "1.25rem" }}>
          Create your account and open your first practice scenario.
        </p>
      </div>
      <form className="panel" onSubmit={onSubmit}>
        <h2>Create account</h2>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="name">Display name</label>
          <input
            id="name"
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password (min 8)</label>
          <input
            id="password"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Get started"}
        </button>
        <p className="muted" style={{ marginTop: "1rem" }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
