// ============================================================================
// 🚀 LIGHTHOUSE CI CONFIGURATION - PERFORMANCE MONITORING
// ============================================================================
//
// 🎯 PURPOSE: Performance monitoring με automated Lighthouse audits
// 🏢 STANDARDS: Core Web Vitals, Performance Budget Enforcement
// 📱 PLATFORM: Mobile/Desktop performance testing
//
// ============================================================================

module.exports = {
  ci: {
    // 📊 Collection Configuration
    collect: {
      // URLs to audit
      url: [
        process.env.LIGHTHOUSE_BASE_URL || 'http://localhost:3000',
        `${process.env.LIGHTHOUSE_BASE_URL || 'http://localhost:3000'}/contacts`,
        `${process.env.LIGHTHOUSE_BASE_URL || 'http://localhost:3000'}/projects`,
        `${process.env.LIGHTHOUSE_BASE_URL || 'http://localhost:3000'}/dxf/viewer`
      ],

      // Collection settings
      startServerCommand: 'npm run build && npm start',
      startServerReadyPattern: 'ready on',
      startServerReadyTimeout: 60000,

      // Number of runs per URL
      numberOfRuns: 3,

      // Lighthouse settings
      settings: {
        // Performance optimization
        chromeFlags: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--headless'
        ],

        // Audit configuration
        onlyCategories: [
          'performance',
          'accessibility',
          'best-practices',
          'seo'
        ],

        // Mobile simulation
        emulatedFormFactor: 'mobile',
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4
        }
      }
    },

    // 📈 Performance Budgets
    assert: {
      // Performance thresholds
      assertions: {
        // Core Web Vitals
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.8 }],
        'categories:seo': ['error', { minScore: 0.8 }],

        // Specific metrics
        'metrics:first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'metrics:largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
        'metrics:cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'metrics:total-blocking-time': ['error', { maxNumericValue: 300 }],

        // Resource budgets
        'metrics:total-byte-weight': ['warn', { maxNumericValue: 3000000 }], // 3MB
        'metrics:unused-css-rules': ['warn', { maxLength: 5 }],
        'metrics:unused-javascript': ['warn', { maxNumericValue: 100000 }], // 100KB

        // Accessibility
        'audits:color-contrast': 'error',
        'audits:image-alt': 'error',
        'audits:heading-order': 'warn',
        'audits:landmark-one-main': 'warn',

        // Best practices
        'audits:uses-https': 'error',
        'audits:no-vulnerable-libraries': 'error',
        'audits:csp-xss': 'warn',

        // SEO
        'audits:meta-description': 'warn',
        'audits:viewport': 'error',
        'audits:document-title': 'error'
      }
    },

    // 📄 Upload Configuration
    upload: {
      target: 'temporary-public-storage',
      reportFilenamePattern: 'lighthouse-report-%%PATHNAME%%-%%DATETIME%%.json'
    },

    // 📊 Status Check
    status: {
      // GitHub status check (if using GitHub Actions)
      context: 'Lighthouse CI',
      targetUrl: process.env.LIGHTHOUSE_REPORT_URL
    }
  },

  // 🎯 Custom Performance Budget
  budget: [
    {
      path: '/*',
      timings: [
        { metric: 'first-contentful-paint', budget: 2000 },
        { metric: 'largest-contentful-paint', budget: 4000 },
        { metric: 'speed-index', budget: 3000 },
        { metric: 'interactive', budget: 5000 }
      ],
      resourceSizes: [
        { resourceType: 'script', budget: 400 },
        { resourceType: 'image', budget: 800 },
        { resourceType: 'stylesheet', budget: 100 },
        { resourceType: 'font', budget: 200 },
        { resourceType: 'document', budget: 50 },
        { resourceType: 'other', budget: 200 },
        { resourceType: 'total', budget: 3000 }
      ],
      resourceCounts: [
        { resourceType: 'script', budget: 20 },
        { resourceType: 'image', budget: 30 },
        { resourceType: 'font', budget: 10 },
        { resourceType: 'stylesheet', budget: 10 }
      ]
    }
  ]
};