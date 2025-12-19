
// 🚀 ENTERPRISE BUNDLE OPTIMIZATIONS
const enterpriseOptimizations = {
  // Bundle analyzer για monitoring
  ...(process.env.ANALYZE === 'true' && require('@next/bundle-analyzer')({
    enabled: true
  })),

  // Compression optimization
  compress: true,
  poweredByHeader: false,

  // Experimental features για bundle optimization
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
      'date-fns'
    ],
    serverComponentsExternalPackages: ['sharp'],
    bundlePagesExternsNext: true
  },

  // Webpack configuration για bundle splitting
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        maxSize: 250 * 1024, // 250KB chunks
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            maxSize: 250 * 1024
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: 10,
            reuseExistingChunk: true,
            maxSize: 250 * 1024
          }
        }
      };

      // Performance budgets
      config.performance = {
        maxAssetSize: 250 * 1024,
        maxEntrypointSize: 250 * 1024,
        hints: 'error'
      };
    }

    return config;
  }
};
