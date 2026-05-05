const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
// Vercel rebuild trigger: 2026-03-23
const nextConfig = {
  // [FAST] FAST DEV MODE - Skip checks για άμεσο startup
  typescript: {
    // Skip type checking για ταχύτητα
    ignoreBuildErrors: true,
  },
  // [ENTERPRISE] Skip ESLint during build - Fix pre-existing errors in second phase
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable strict mode για λιγότερα re-renders
  reactStrictMode: false,

  // [OK] ENTERPRISE FIX: Disable Next.js dev indicators/overlay that blocks click events
  devIndicators: false,

  // [OK] NEXT.JS 15: Moved from experimental to root level
  // [ADR-312 Phase 7.4] @resvg/resvg-js ships platform-specific native binaries
  // (e.g. @resvg/resvg-js-win32-x64-msvc) as optional deps — Turbopack/webpack
  // cannot resolve them statically. Marking the package external makes Next.js
  // delegate the require() to Node.js at runtime, which picks the right
  // binary for the running platform. Without this, the DXF thumbnail
  // self-heal (services/floorplans/dxf-thumbnail-selfheal.ts) fails with
  // "could not resolve @resvg/resvg-js-win32-x64-msvc into a module".
  // rimraf: added as direct dependency to suppress transitive resolution warnings
  // from Turbopack (previously unavailable in nested pnpm structure).
  serverExternalPackages: ['@mapbox/node-pre-gyp', '@resvg/resvg-js', 'rimraf', '@napi-rs/canvas', 'pdfjs-dist'],

  // [OK] NEXT.JS 15: Fix workspace root detection (multiple lockfiles)
  outputFileTracingRoot: __dirname,

  // pdfjs-dist: removed from transpilePackages (conflicts with serverExternalPackages).
  // Server-side: loaded natively from node_modules via serverExternalPackages.
  // Client-side: pdfjs-dist v4 ships proper ESM — no transpilation needed.
  transpilePackages: [],

  // =========================================================================
  // [TURBOPACK] ENTERPRISE TURBOPACK CONFIGURATION (Next.js 15.5+)
  // =========================================================================
  // Reference: https://nextjs.org/docs/app/api-reference/next-config-js/turbopack
  // Pattern used by: Vercel, Microsoft, Google enterprise applications
  // NOTE: This config is used when running `next dev --turbopack`
  //       Webpack config below is used for production builds
  turbopack: {
    // Turbopack resolves Node.js built-in modules automatically
    // No need for explicit fallbacks - Turbopack handles this natively
    // Path aliases are read from tsconfig.json automatically
  },

  // [ENTERPRISE] PERFORMANCE OPTIMIZATIONS - Fortune 500 Standard
  experimental: {
    // [COOLIFY] Disable webpack build worker: prevents forking a separate Node.js
    // worker process for webpack compilation. On low-RAM VPS builds, the extra
    // fork doubles peak heap usage and triggers OOM killer (exit 137).
    webpackBuildWorker: false,
    // [ENTERPRISE] Optimized imports - Prevents barrel export overhead
    // These packages have heavy barrel exports that slow down dev compilation
    optimizePackageImports: [
      // Icon libraries (heavy barrel exports)
      'lucide-react',
      '@heroicons/react',
      // Radix UI components
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      // React Aria (heavy barrel exports)
      '@react-aria/color',
      '@react-aria/dialog',
      '@react-aria/interactions',
      '@react-aria/overlays',
      '@react-stately/color',
      // Other heavy packages
      'date-fns',
      'recharts',
      'react-hook-form',
      'zod',
      'firebase',
      'firebase-admin',
      'class-variance-authority',
      // Utility libraries (imported everywhere)
      'clsx',
      'tailwind-merge',
      // Carousel / Panels / Date picker
      'embla-carousel',
      'embla-carousel-react',
      'react-day-picker',
      'react-resizable-panels',
      // Notifications / AI (pdfjs-dist excluded: conflicts with serverExternalPackages)
      'sonner',
      'openai',
      '@sentry/nextjs',
    ],
  },

  // [BUNDLE] BUNDLE OPTIMIZATION
  // =========================================================================
  // [WEBPACK] WEBPACK-ONLY CONFIGURATION - PRODUCTION BUILDS ONLY
  // =========================================================================
  // ENTERPRISE PATTERN: Separate bundler configs for dev vs production
  // - Development: Turbopack (fast, native ESM support)
  // - Production: Webpack (optimized, with plugins)
  // This eliminates "Webpack is configured while Turbopack is not" warning
  // Pattern: Vercel, Microsoft Azure DevOps, Google Cloud Build
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // [ENTERPRISE] Skip all webpack customizations in development
    // Turbopack handles these natively - no configuration needed
    if (dev) {
      return config;
    }

    // =========================================================================
    // PRODUCTION-ONLY CONFIGURATIONS BELOW
    // =========================================================================

    // [COOLIFY] Sequential compilation to prevent OOM on VPS (8GB RAM).
    // Next.js spawns N workers (N = CPU count = 4 on Netcup VPS 1000 G12).
    // Each worker has its own V8 heap → 4 × ~2GB = ~8GB peak.
    // parallelism:1 → sequential → peak ~2-3GB, safe on 8GB+4GB swap.
    config.parallelism = 1;

    // [CRITICAL] Disable module concatenation on server bundles to prevent
    // TDZ errors ("Cannot access 'f' before initialization").
    // Module concatenation inlines modules into a single scope, which can
    // reorder class/const declarations and cause TDZ violations in API routes.
    if (isServer) {
      config.optimization.concatenateModules = false;
    }

    // [ENTERPRISE] pdf.js configuration for Next.js (production)
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

    // [ENTERPRISE] Fix ESM compatibility for .mjs files (pdfjs-dist)
    // This prevents "Object.defineProperty called on non-object" error
    if (!isServer) {
      config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
      });
    }

    // [ENTERPRISE] Copy PDF worker to public folder
    // =========================================================================
    // PDF files exist in public/ (committed to git) for development
    // CopyPlugin ensures latest version from node_modules for production builds
    // Pattern: Vercel, Google Cloud Build - hermetic production builds
    if (!isServer) {
      const path = require('path');
      const CopyPlugin = require('copy-webpack-plugin');

      // [ENTERPRISE] Copy pdf.js files to public
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

    // Performance optimizations για production — CLIENT-SIDE ONLY
    // CRITICAL: Custom splitChunks must NOT apply to server bundles (API routes)
    // because Webpack reorders modules → TDZ errors ("Cannot access 'f' before initialization")
    if (!dev && !isServer) {
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
      };
    }

    // Minification optimizations — applies to both client and server
    if (!dev) {
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

    // [ENTERPRISE] Bundle analyzer for production analysis
    // Usage: ANALYZE=true pnpm build
    if (process.env.ANALYZE === 'true') {
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

  // [IMAGE] IMAGE OPTIMIZATION
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

  // [COMPRESS] COMPRESSION
  compress: true,

  // [CACHE] HEADERS για caching — Edge Request Optimization
  // DEV: no-cache headers ώστε ο browser να μην κρατάει παλιά modules
  // PROD: aggressive caching για performance
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';

    // Development: prevent ALL browser caching
    if (isDev) {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
            { key: 'Pragma', value: 'no-cache' },
            { key: 'Expires', value: '0' },
          ],
        },
      ];
    }

    // Production: optimized caching
    return [
      // ── Static assets: immutable forever (hashed filenames) ──
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/(.*).js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/(.*).css',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // ── Service worker: always revalidate ──
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      // ── Public assets: fonts (1 year), images (1 week) ──
      {
        source: '/fonts/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
      // ── PDF worker: rarely changes (1 month) ──
      {
        source: '/pdf.worker.min.mjs',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/pdf.min.mjs',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
      // ── robots.txt: revalidate daily ──
      {
        source: '/robots.txt',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },

  // [PWA] PWA MANIFEST
  async rewrites() {
    return [
      {
        source: '/manifest.json',
        destination: '/api/manifest',
      },
    ];
  },
};

// ADR-259D: Wrap with Sentry for error monitoring + source map upload
// Source map upload requires SENTRY_ORG + SENTRY_PROJECT env vars.
// Without them (e.g. self-hosted Coolify deploy), skip upload to avoid exit(255).
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  telemetry: false,
  disableSourceMapUpload: !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT,
});