"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Panel de marca del Login: fotografía institucional única (imagen 2 de
 * Referencias) con degradado navy y el logo centrado en gran formato. */
export function LoginShowcase() {
  const reduce = useReducedMotion();
  const rise = reduce
    ? {}
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="relative hidden overflow-hidden bg-fsa-navy lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-14 lg:py-16 lg:text-center">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url(/institucional/comunidad-ninos.jpg)",
          // Foto (contenido fotográfico, no pixel art): "auto" deja que el
          // navegador use su interpolación bicúbica/bilinear de alta calidad
          // al escalar. "crisp-edges"/"pixelated" son para gráficos de bajo
          // detalle y aquí acentuarían el pixelado en vez de suavizarlo.
          imageRendering: "auto",
        }}
        role="img"
        aria-label="Comunidades de la Fundación San Antonio"
      />
      <div className="absolute inset-0 bg-fsa-navy/78" />
      <div className="absolute inset-0 bg-gradient-to-t from-fsa-navy via-fsa-navy/40 to-fsa-navy/55" />

      <motion.div
        {...rise}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col items-center"
      >
        <span className="grid place-items-center rounded-3xl bg-white p-10 shadow-2xl shadow-black/30 sm:p-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-fsa.png"
            alt="Fundación San Antonio"
            width={320}
            height={262}
            className="w-[min(64vw,340px)]"
          />
        </span>
      </motion.div>

      <motion.div
        {...rise}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative mt-10 max-w-md"
      >
        <p className="font-display text-[26px] font-600 leading-tight text-white">
          Transformamos vidas a través del amor, la educación y las oportunidades.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-white/60">
          Plataforma de gestión y análisis del portafolio de inversiones
          internacionales.
        </p>
      </motion.div>

      <motion.p
        {...rise}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative mt-10 text-xs text-white/40"
      >
        Una obra de la Arquidiócesis de Bogotá
      </motion.p>
    </div>
  );
}
