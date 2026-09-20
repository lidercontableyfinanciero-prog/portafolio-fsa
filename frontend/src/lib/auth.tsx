"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, tokenStore } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  canUpload: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api.get<User>("/auth/me"));
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (username: string, password: string) => {
      const { access_token } = await api.login(username, password);
      tokenStore.set(access_token);
      const me = await api.get<User>("/auth/me");
      setUser(me);
      router.push("/");
    },
    [router],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      canUpload: user?.role === "admin" || user?.can_upload === true,
      login,
      logout,
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
