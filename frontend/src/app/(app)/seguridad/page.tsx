"use client";

import { ChangePasswordForm } from "@/components/security/ChangePasswordForm";
import { UserManagementPanel } from "@/components/security/UserManagementPanel";
import { useAuth } from "@/lib/auth";

/** Seguridad: módulo central, independiente de los portafolios. El lector solo
 * cambia su contraseña; el admin además administra usuarios y permisos (la API
 * /users exige rol admin, no basta con ocultar el panel). */
export default function SeguridadPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-600 text-fsa-navy">Seguridad</h1>
        <p className="text-sm text-fsa-muted">
          {isAdmin
            ? "Cambia tu contraseña y administra usuarios, roles, permisos de carga y acceso a cada portafolio."
            : "Cambia la contraseña de tu cuenta."}
        </p>
      </div>

      <ChangePasswordForm />

      {isAdmin ? <UserManagementPanel /> : null}
    </div>
  );
}
