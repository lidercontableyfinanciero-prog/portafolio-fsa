"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, KeyRound, Lock, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { LogoMarquee } from "@/components/home/LogoMarquee";
import { UserBadge } from "@/components/layout/Topbar";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MODULES } from "@/lib/modules";
import type { ModuleKey, Period } from "@/lib/types";

interface NationalStatus {
  has_data: boolean;
  periods: { label: string }[];
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

/** Pantalla principal después del login: centro de navegación hacia
 * Portafolio Internacional, Portafolio Nacional y Seguridad. */
export default function HomePage() {
  const { user, isAdmin, canView } = useAuth();
  const reduce = useReducedMotion();
  const { data: intl } = useSWR<Period[]>(
    canView("international") ? "/portfolio/periods" : null,
    fetcher,
  );
  const { data: nal } = useSWR<NationalStatus>(
    canView("national") ? "/national/status" : null,
    fetcher,
  );

  const lastIntl = intl?.length ? intl[intl.length - 1].label : null;
  const lastNal = nal?.periods.length ? nal.periods[nal.periods.length - 1].label : null;
  const first = (user?.full_name ?? user?.username ?? "").split(" ")[0];

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  const portfolioCards: { key: ModuleKey; meta: string | null }[] = [
    { key: "international", meta: lastIntl ? `Último corte: ${lastIntl} · USD` : null },
    {
      key: "national",
      meta: nal ? (lastNal ? `Último corte: ${lastNal} · COP` : "Sin información importada") : null,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-fsa-navy text-white">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: "url(/institucional/campus-aerea.jpg)" }}
          role="img"
          aria-label="Campus de la Fundación San Antonio"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-fsa-navy via-fsa-navy/90 to-fsa-navy/55" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-fsa-navy via-transparent to-fsa-navy/40" />

        <header className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-fsa.png" alt="Fundación San Antonio" width={34} height={28} />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-sm font-600">Portafolio FSA</span>
              <span className="block text-[11px] text-white/55">Gestión de inversiones</span>
            </span>
          </div>
          <UserBadge dark />
        </header>

        <div className="mx-auto max-w-[1280px] px-4 pb-14 pt-10 sm:px-6 sm:pt-16 lg:px-10 lg:pb-20">
          <motion.p
            {...rise(0)}
            className="flex items-center gap-2 text-[11px] font-600 uppercase tracking-[0.18em] text-fsa-teal"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-fsa-teal" aria-hidden />
            {greeting()}{first ? `, ${first}` : ""}
          </motion.p>
          <motion.h1
            {...rise(0.06)}
            className="mt-4 max-w-3xl font-display text-[34px] font-600 leading-[1.08] sm:text-5xl lg:text-[56px]"
          >
            Inversiones que sostienen
            <br className="hidden sm:block" />{" "}
            <span className="text-fsa-teal">la misión de la Fundación.</span>
          </motion.h1>
          <motion.p {...rise(0.12)} className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/70">
            Consulta el portafolio internacional y el nacional con la misma lógica de
            valoración, rentabilidad, benchmark y control de límites del Reglamento de
            Inversiones.
          </motion.p>

          {/* Tarjetas de módulo */}
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {portfolioCards.map(({ key, meta }, i) => {
              const m = MODULES[key];
              const Icon = m.icon;
              const allowed = canView(key);
              const body = (
                <>
                  <div className="flex items-start justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-fsa-teal/15 ring-1 ring-fsa-teal/30">
                      <Icon className="h-6 w-6 text-fsa-teal" aria-hidden />
                    </span>
                    {allowed ? (
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-fsa-navy transition-transform duration-300 group-hover:translate-x-1">
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/70">
                        <Lock className="h-3 w-3" aria-hidden /> Sin acceso
                      </span>
                    )}
                  </div>
                  <h2 className="mt-6 font-display text-xl font-600">{m.label}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{m.description}</p>
                  <p className="mt-5 text-xs font-500 text-white/50">
                    {allowed
                      ? meta ?? "Cargando…"
                      : "Solicita el acceso a un administrador."}
                  </p>
                </>
              );
              const cls =
                "group relative flex h-full flex-col rounded-2xl border p-6 text-left backdrop-blur-md transition duration-300";
              return (
                <motion.div key={key} {...rise(0.18 + i * 0.07)} className="h-full">
                  {allowed ? (
                    <Link
                      href={m.base}
                      className={`${cls} border-white/15 bg-white/[0.07] hover:-translate-y-1 hover:border-fsa-teal/60 hover:bg-white/[0.12] hover:shadow-2xl hover:shadow-black/30`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={`${cls} cursor-not-allowed border-white/10 bg-white/[0.03] opacity-70`}>
                      {body}
                    </div>
                  )}
                </motion.div>
              );
            })}

            <motion.div {...rise(0.32)} className="h-full">
              <Link
                href="/seguridad"
                className="group relative flex h-full flex-col rounded-2xl border border-white/15 bg-white/[0.07] p-6 text-left backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-fsa-orange/60 hover:bg-white/[0.12] hover:shadow-2xl hover:shadow-black/30"
              >
                <div className="flex items-start justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-fsa-orange/15 ring-1 ring-fsa-orange/30">
                    <ShieldCheck className="h-6 w-6 text-fsa-orange" aria-hidden />
                  </span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-fsa-navy transition-transform duration-300 group-hover:translate-x-1">
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </div>
                <h2 className="mt-6 font-display text-xl font-600">Seguridad</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  {isAdmin
                    ? "Contraseñas, usuarios, roles y permisos de acceso a cada módulo."
                    : "Cambia la contraseña de tu cuenta."}
                </p>
                <ul className="mt-5 space-y-1.5 text-xs text-white/55">
                  <li className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5" aria-hidden /> Cambiar mi contraseña
                  </li>
                  {isAdmin ? (
                    <li className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" aria-hidden /> Usuarios, permisos y accesos
                    </li>
                  ) : null}
                </ul>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* MARQUESINA */}
      <section className="border-b border-fsa-border bg-white">
        <p className="pt-8 text-center text-[11px] font-600 uppercase tracking-[0.18em] text-fsa-muted">
          Entidades con las que trabajamos
        </p>
        <LogoMarquee />
      </section>

      <footer className="mt-auto bg-fsa-surface py-5 text-center text-[11px] text-fsa-muted">
        Fundación San Antonio · Una obra de la Arquidiócesis de Bogotá
      </footer>
    </div>
  );
}
