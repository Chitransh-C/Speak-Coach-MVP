import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/shared/api/client";

export type UserRole = "learner" | "admin";
export type User = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

type AuthState = {
  user: User | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);
const TOKEN_KEY = "rolesmith_token";
const USER_KEY = "rolesmith_user";

function normalizeUser(raw: User & { role?: string }): User {
  return {
    id: raw.id,
    email: raw.email,
    displayName: raw.displayName,
    role: raw.role === "admin" ? "admin" : "learner",
  };
}

function loadStored(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    return { token, user: raw ? normalizeUser(JSON.parse(raw) as User) : null };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStored();
  const [token, setToken] = useState<string | null>(stored.token);
  const [user, setUser] = useState<User | null>(stored.user);
  const [ready] = useState(true);

  const persist = useCallback((nextToken: string, nextUser: User) => {
    const normalized = normalizeUser(nextUser);
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(normalized));
    setToken(nextToken);
    setUser(normalized);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ user: User; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      persist(res.token, res.user);
    },
    [persist],
  );

  const signup = useCallback(
    async (email: string, password: string, displayName: string) => {
      const res = await api<{ user: User; token: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
      });
      persist(res.token, res.user);
    },
    [persist],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, ready, login, signup, logout }),
    [user, token, ready, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
