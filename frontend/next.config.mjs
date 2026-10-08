/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    // El frontend siempre llama a rutas relativas `/api/*`; aquí se reescriben
    // server-side hacia la API FastAPI. Orden de prioridad:
    //   1) NEXT_PUBLIC_API_URL (configúralo en Vercel para apuntar a otra API)
    //   2) en producción, la API de Render por defecto
    //   3) en local, uvicorn en el puerto 8000
    const DEFAULT_PROD_API = "https://portafolio-fsa-api.onrender.com";
    const api =
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "production" ? DEFAULT_PROD_API : "http://localhost:8000");
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
  async redirects() {
    // La antigua sección "Datos" se dividió en "Importar" + "Posiciones".
    // El Portafolio Internacional ahora vive en /internacional/* (la raíz "/" es la
    // pantalla principal de módulos): se conservan los enlaces antiguos.
    const moved = ["historico", "rentabilidad", "escenarios", "simulador-fx", "posiciones", "importar"];
    return [
      { source: "/datos", destination: "/internacional/posiciones", permanent: false },
      ...moved.map((p) => ({
        source: `/${p}`,
        destination: `/internacional/${p}`,
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
