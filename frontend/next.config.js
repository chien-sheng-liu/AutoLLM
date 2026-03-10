/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a standalone server for smaller runtime images
  output: 'standalone',
};

module.exports = nextConfig;
