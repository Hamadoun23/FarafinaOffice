/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le back-office affiche le site vitrine dans un cadre : on autorise
  // explicitement cette origine et rien d'autre.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};
export default nextConfig;
