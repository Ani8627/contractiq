/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdf-lib"],
  },
};

export default nextConfig;
