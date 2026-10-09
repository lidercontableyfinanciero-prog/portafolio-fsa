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
import type { ModuleKey, User } from "@/lib/types";

/** Cierre automático de sesión tras 1 hora sin actividad. El backend lo hace
 * cumplir igual: el token vence a los 60 min (SESSION_IDLE_MINUTES) y solo se
 * renueva (POST /auth/refresh) mientras el usuario está activo. */
export const IDLE_LIMIT_MS = 60 * 60 * 1000;
const REFRESH_EVERY_MS = 5 * 60 * 1000;
const ACTIVITY_KEY = "fsa_last_activity";
export const LOGOUT_REASON_KEY = "fsa_logout_reason";
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "wheel", "scroll", "touchstart"] as const;

const activity = {
  get: () => Number(localStorage.getItem(ACTIVITY_KEY) ?? 0),
  touch: () => localStorage.setItem(ACTIVITY_KEY, String(Date.now())),
};

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  canUpload: boolean;
  /** Perfil de acceso por módulo (el admin ve todos). El backend lo valida igual. */
  canView: (module: ModuleKey) => boolean;
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
    // Sesión abandonada (pestaña cerrada o equipo suspendido) más de 1 hora.
    const last = activity.get();
    if (last && Date.now() - last >= IDLE_LIMIT_MS) {
      tokenStore.clear();
      sessionStorage.setItem(LOGOUT_REASON_KEY, "inactividad");
      setUser(null);
      setLoading(false);
      return;
    }
    if (!last) activity.touch();
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
      activity.touch();
      const me = await api.get<User>("/auth/me");
      setUser(me);
      router.push("/");
    },
    [router],
  );

  const endSession = useCallback(
    (reason?: "inactividad") => {
      tokenStore.clear();
      // El motivo viaja en sessionStorage: los guardas de ruta también redirigen
      // a /login al quedar sin usuario y podrían perder un parámetro en la URL.
      if (reason) sessionStorage.setItem(LOGOUT_REASON_KEY, reason);
      setUser(null);
      router.push("/login");
    },
    [router],
  );
  const logout = useCallback(() => endSession(), [endSession]);

  // Inactividad: registra la última interacción (compartida entre pestañas vía
  // localStorage), cierra la sesión al superar 1 hora y renueva el token
  // mientras haya actividad reciente.
  useEffect(() => {
    if (!user) return;
    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite > 15_000) {
        lastWrite = now;
        activity.touch();
      }
    };
    let refreshing = false;
    const check = async () => {
      const now = Date.now();
      const idle = now - activity.get();
      if (idle >= IDLE_LIMIT_MS) {
        endSession("inactividad");
        return;
      }
      if (!refreshing && idle < REFRESH_EVERY_MS && now - tokenStore.issuedAt() >= REFRESH_EVERY_MS) {
        refreshing = true;
        try {
          const { access_token } = await api.post<{ access_token: string }>("/auth/refresh");
          if (tokenStore.get()) tokenStore.set(access_token);
        } catch {
          /* un 401 ya redirige al login desde api.ts */
        } finally {
          refreshing = false;
        }
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    // Cierre de sesión en otra pestaña.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "fsa_token" && !e.newValue) endSession();
    };
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true, capture: true }),
    );
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(check, 30_000);
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity, { capture: true }));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [user, endSession]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      canUpload: user?.role === "admin" || user?.can_upload === true,
      canView: (module: ModuleKey) =>
        user?.role === "admin" ||
        (module === "international"
          ? user?.can_view_international === true
          : user?.can_view_national === true),
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
