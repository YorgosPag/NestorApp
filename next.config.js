/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🚀 FAST DEV MODE - Skip checks για άμεσο startup
  typescript: {
    // Skip type checking για ταχύτητα
    ignoreBuildErrors: true,
  },
  // Disable strict mode για λιγότερα re-renders
  reactStrictMode: false,

  // ✅ ENTERPRISE FIX: Disable Next.js dev indicators/overlay that blocks click events
  devIndicators: false,

  // ✅ NEXT.JS 15: Moved from experimental to root level
  serverExternalPackages: ['@mapbox/node-pre-gyp'],

  // ✅ NEXT.JS 15: Fix workspace root detection (multiple lockfiles)
  outputFileTracingRoot: __dirname,

  // 🏢 ENTERPRISE: Transpile pdfjs-dist for proper ESM handling
  // Fixes: "Object.defineProperty called on non-object" error
  transpilePackages: ['pdfjs-dist'],

  // ⚡ ENTERPRISE PERFORMANCE OPTIMIZATIONS
  experimental: {
    // Memory optimizations
    optimizePackageImports: ['lucide-react', '@heroicons/react'],
  },

  // 📦 BUNDLE OPTIMIZATION
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // 🏢 ENTERPRISE: pdf.js configuration for Next.js
    // Fixes ESM compatibility issues with pdfjs-dist

    // Resolve fallbacks for browser-only modules (needed by pdfjs-dist)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
      http: false,
      https: false,
      url: false,
    };

    // 🏢 ENTERPRISE: Fix ESM compatibility for .mjs files (pdfjs-dist)
    // This prevents "Object.defineProperty called on non-object" error
    // by letting Webpack handle .mjs as ESM without extra wrapping
    if (!isServer) {
      config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
      });
    }

    // Copy worker to public folder for self-hosted PDF processing
    // Eliminates CDN dependency (offline support, version lock, security)
    if (!isServer) {
      const path = require('path');
      const CopyPlugin = require('copy-webpack-plugin');

      // 🏢 ENTERPRISE: Copy pdf.js files to public
      // Uses the version from react-pdf's pdfjs-dist dependency
      const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'));

      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: path.join(pdfjsDistPath, 'build/pdf.min.mjs'),
              to: path.join(__dirname, 'public/pdf.min.mjs'),
            },
            {
              from: path.join(pdfjsDistPath, 'build/pdf.worker.min.mjs'),
              to: path.join(__dirname, 'public/pdf.worker.min.mjs'),
            },
          ],
        })
      );
    }

    // Performance optimizations για production
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          cacheGroups: {
            // Vendor chunk για libraries
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              maxSize: 250000, // 250KB chunks
            },
            // DXF-specific chunk
            dxf: {
              test: /[\\/]src[\\/]subapps[\\/]dxf-viewer[\\/]/,
              name: 'dxf-viewer',
              chunks: 'all',
              priority: 10,
              maxSize: 300000, // 300KB για DXF components
            },
            // Common UI components
            ui: {
              test: /[\\/]src[\\/](components|ui)[\\/]/,
              name: 'ui-common',
              chunks: 'all',
              priority: 5,
              maxSize: 200000, // 200KB για UI components
            }
          }
        },
        // Tree shaking optimizations
        usedExports: true,
        sideEffects: false,
      };

      // Minification optimizations
      config.optimization.minimizer = config.optimization.minimizer.map(minimizer => {
        if (minimizer.constructor.name === 'TerserPlugin') {
          minimizer.options.terserOptions = {
            ...minimizer.options.terserOptions,
            compress: {
              ...minimizer.options.terserOptions.compress,
              drop_console: true, // Remove console.log από production
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug'],
            },
            mangle: {
              safari10: true,
            },
          };
        }
        return minimizer;
      });
    }

    // Bundle analyzer για development
    if (dev && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          openAnalyzer: true,
        })
      );
    }

    return config;
  },

  // 🖼️ IMAGE OPTIMIZATION
  images: {
    // Domains για external images
    domains: ['images.unsplash.com', 'via.placeholder.com'],
    // Image formats
    formats: ['image/avif', 'image/webp'],
    // Quality settings
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Enable optimization
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // 📊 COMPRESSION
  compress: true,

  // 🔗 HEADERS για caching
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*).js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*).css',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },

  // 🌐 PWA MANIFEST
  async rewrites() {
    return [
      {
        source: '/manifest.json',
        destination: '/api/manifest',
      },
    ];
  },
};

module.exports = nextConfig;