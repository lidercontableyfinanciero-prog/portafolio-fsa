/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
  async redirects() {
    // La antigua sección "Datos" se dividió en "Importar" + "Posiciones".
    return [{ source: "/datos", destination: "/posiciones", permanent: false }];
  },
};

export default nextConfig;
