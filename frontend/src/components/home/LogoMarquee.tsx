"use client";

/** Marquesina infinita de logos de las entidades con las que trabaja la FSA
 * (assets sin modificar en /public/aliados). La lista se duplica y se desplaza
 * exactamente -50 % para que el reinicio sea imperceptible. */
// `scale` solo compensa al mostrar el margen blanco que trae cada archivo
// (los archivos originales no se modifican).
const LOGOS = [
  { src: "/aliados/credicorp-capital.png", alt: "Credicorp Capital", scale: 1 },
  { src: "/aliados/davivienda.jpg", alt: "Davivienda", scale: 2.4 },
  { src: "/aliados/alianza-fiduciaria.png", alt: "Alianza Fiduciaria", scale: 1.5 },
  { src: "/aliados/accival.jpg", alt: "Acciones & Valores", scale: 2.1 },
  { src: "/aliados/bcs.png", alt: "Fiduciaria Caja Social", scale: 1.9 },
  { src: "/aliados/merrill-lynch.jpg", alt: "Merrill Lynch", scale: 1.5 },
];

export function LogoMarquee() {
  // Dos copias por mitad: la pista siempre es más ancha que pantallas grandes.
  const half = [...LOGOS, ...LOGOS];
  return (
    <div
      className="fsa-marquee group relative overflow-hidden py-5"
      aria-label="Entidades financieras aliadas"
    >
      <div className="fsa-marquee-track flex w-max items-center group-hover:[animation-play-state:paused]">
        {[0, 1].map((copy) =>
          half.map((l, i) => (
            <div
              key={`${copy}-${i}`}
              aria-hidden={copy === 1 || i >= LOGOS.length}
              className="mx-4 flex h-20 w-48 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white px-3 sm:mx-6 sm:w-56"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={l.src}
                alt={copy === 0 && i < LOGOS.length ? l.alt : ""}
                style={{ transform: `scale(${l.scale})` }}
                className="max-h-14 max-w-full object-contain opacity-85 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0"
                loading="lazy"
                draggable={false}
              />
            </div>
          )),
        )}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent sm:w-28" />
    </div>
  );
}
