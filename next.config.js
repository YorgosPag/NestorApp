/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🚀 FAST DEV MODE - Skip checks για άμεσο startup
  typescript: {
    // Skip type checking για ταχύτητα
    ignoreBuildErrors: true,
  },
  // Disable strict mode για λιγότερα re-renders
  reactStrictMode: false,
};

module.exports = nextConfig;