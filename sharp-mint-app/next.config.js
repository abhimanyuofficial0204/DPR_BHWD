/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Rewrite api calls if needed, but since our serverless python runs in /api, 
  // Vercel configures this out of the box automatically.
}

module.exports = nextConfig
