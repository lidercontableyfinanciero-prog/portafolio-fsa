"use client";

import { ChangePasswordForm } from "@/components/security/ChangePasswordForm";
import { UserManagementPanel } from "@/components/security/UserManagementPanel";
import { useAuth } from "@/lib/auth";

export default function SeguridadPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-600 text-fsa-navy">Seguridad / Privacidad</h1>
        <p className="text-sm text-fsa-muted">
          {isAdmin
            ? "Cambia tu contraseña, asigna el nombre visible de cada usuario y administra el permiso de carga de archivos."
            : "Cambia la contraseña de tu cuenta."}
        </p>
      </div>

      <ChangePasswordForm />

      {isAdmin ? <UserManagementPanel /> : null}
    </div>
  );
}
