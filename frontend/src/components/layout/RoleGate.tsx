"use client";

import { useAuth } from "@/lib/auth";

/** Renderiza `children` solo para administradores. */
export function RoleGate({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  return <>{isAdmin ? children : fallback}</>;
}
