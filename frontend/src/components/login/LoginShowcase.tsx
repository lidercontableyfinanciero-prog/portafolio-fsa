"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    src: "/institucional/comunidad-ninos.jpg",
    caption: "Las comunidades a las que servimos",
  },
  {
    src: "/institucional/campus-fachada.jpg",
    caption: "Nuestra sede principal",
  },
  {
    src: "/institucional/campus-aerea.jpg",
    caption: "Vista aérea de las instalaciones",
  },
];

const FEATURES = [
  { icon: ShieldCheck, text: "Acceso cifrado con roles Admin / Lector" },
  { icon: TrendingUp, text: "Rentabilidad Dietz, TWR y escenarios What-If" },
  { icon: Users, text: "Trazabilidad completa de cada carga de datos" },
];

/** Panel de marca del Login: fotografía institucional a pantalla completa con
 * degradado navy, mensaje de misión y una galería/carrusel de la fundación
 * (maqueta: "imagen referencia landing page 1/2" en Referencias/). */
export function LoginShowcase() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 5500);
    return () => clearInterval(t);
  }, [reduce]);

  const prev = () => setI((n) => (n - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setI((n) => (n + 1) % SLIDES.length);

  return (
    <div className="relative hidden overflow-hidden bg-fsa-navy lg:block">
      {/* Fotografía a pantalla completa, en carrusel */}
      <AnimatePresence initial={false}>
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${SLIDES[i].src})` }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-fsa-navy via-fsa-navy/70 to-fsa-navy/30" />
      <div className="absolute inset-0 bg-fsa-navy/25" />

      {/* Contenido */}
      <div className="relative flex h-full flex-col justify-between px-12 py-10 text-white xl:px-16">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white p-1.5 shadow-lg shadow-black/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-fsa.png" alt="Fundación San Antonio" className="h-full w-full object-contain" />
          </span>
          <div>
            <p className="text-sm font-600 leading-tight">Fundación San Antonio</p>
            <p className="text-xs text-white/60">Portafolio de Inversiones Internacionales</p>
          </div>
        </div>

        <div className="max-w-lg">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-500 text-white/80 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-fsa-teal" />
            Obra de la Arquidiócesis de Bogotá
          </span>
          <h1 className="mt-4 font-display text-[34px] font-700 leading-[1.1] xl:text-[40px]">
            Transformamos vidas a través del amor, la educación y las oportunidades.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/65">
            Una plataforma para administrar el portafolio con la misma transparencia
            con la que servimos a nuestras comunidades.
          </p>

          <ul className="mt-6 space-y-2.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm text-white/80">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10">
                  <Icon className="h-3.5 w-3.5 text-fsa-teal" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Galería institucional: numeración + controles, como en el mock de referencia */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span className="tnum font-600 text-white">{String(i + 1).padStart(2, "0")}</span>
            <span className="relative h-px w-16 overflow-hidden bg-white/20">
              <motion.span
                key={i}
                className="absolute inset-y-0 left-0 bg-fsa-teal"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: reduce ? 0 : 5.5, ease: "linear" }}
              />
            </span>
            <span className="tnum">{String(SLIDES.length).padStart(2, "0")}</span>
            <span className="ml-1 hidden text-white/50 sm:inline">{SLIDES[i].caption}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              aria-label="Foto anterior"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/80 transition-colors hover:bg-white hover:text-fsa-navy"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              onClick={next}
              aria-label="Foto siguiente"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/80 transition-colors hover:bg-white hover:text-fsa-navy"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
