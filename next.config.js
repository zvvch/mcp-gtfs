/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API-Routen sollen nicht mit einem Trailing Slash enden
  trailingSlash: false,
  // Node.js-Module, die von Next.js gepolyfilled werden sollen
  experimental: {
    esmExternals: 'loose',
  }
};

module.exports = nextConfig; 