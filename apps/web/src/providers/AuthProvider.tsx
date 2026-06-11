"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { AuthUser } from "@mathgraph/shared";
import { apiGetProfile, apiLogin, apiRefresh, apiRegister } from "@/lib/authApi";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, role?: "USER" | "COMPOSER") => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function saveTokens(access: string, refresh: string) {
  localStorage.setItem("mg-access", access);
  localStorage.setItem("mg-refresh", refresh);
}

function clearTokens() {
  localStorage.removeItem("mg-access");
  localStorage.removeItem("mg-refresh");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    const accessToken = localStorage.getItem("mg-access");
    const refreshToken = localStorage.getItem("mg-refresh");

    if (!accessToken) {
      // Session restore is inherently client-only (reads localStorage on mount).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    apiGetProfile(accessToken)
      .then(setUser)
      .catch(async () => {
        // Access expired, try refresh
        if (refreshToken) {
          try {
            const tokens = await apiRefresh(refreshToken);
            saveTokens(tokens.accessToken, tokens.refreshToken);
            const profile = await apiGetProfile(tokens.accessToken);
            setUser(profile);
          } catch {
            clearTokens();
          }
        } else {
          clearTokens();
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await apiLogin(email, password);
    saveTokens(tokens.accessToken, tokens.refreshToken);
    const profile = await apiGetProfile(tokens.accessToken);
    setUser(profile);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string, role?: "USER" | "COMPOSER") => {
    const tokens = await apiRegister(email, password, name, role);
    saveTokens(tokens.accessToken, tokens.refreshToken);
    const profile = await apiGetProfile(tokens.accessToken);
    setUser(profile);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("mg-access");
    if (!token) return;
    const profile = await apiGetProfile(token);
    setUser(profile);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
