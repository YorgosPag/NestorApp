/**
 * BUNDLE OPTIMIZER — ANALYSIS FUNCTIONS
 * Extracted from BundleOptimizer.ts (ADR-065 SRP split)
 *
 * Mock analysis functions for bundle size, chunks, dependencies,
 * duplicate modules, unused code, and load time.
 */

import type {
  BundleChunk,
  DependencyAnalysis,
  DuplicateModule,
  UnusedCodeAnalysis,
  BundleOptimizationConfig,
  OptimizationRecommendation,
  BundleAnalysis,
} from './bundle-optimizer-types';

// ============================================================================
// BUNDLE NAME EXTRACTION
// ============================================================================

export function extractBundleName(bundlePath: string): string {
  return bundlePath.split('/').pop()?.replace('.js', '') || 'unknown';
}

// ============================================================================
// SIZE ANALYSIS
// ============================================================================

const MOCK_BUNDLE_SIZES: Record<string, number> = {
  'main.js': 1.2 * 1024 * 1024,
  'vendor.js': 800 * 1024,
  'dxf-transformation.js': 300 * 1024,
  'map-integration.js': 450 * 1024,
  'alert-engine.js': 250 * 1024,
  'design-system.js': 180 * 1024,
  'performance.js': 120 * 1024,
};

const DEFAULT_BUNDLE_SIZE = 100 * 1024;

export function getMockBundleSize(bundlePath: string): number {
  const fileName = bundlePath.split('/').pop() || bundlePath;
  return MOCK_BUNDLE_SIZES[fileName] || DEFAULT_BUNDLE_SIZE;
}

export function calculateBundleSize(
  bundlePath: string
): { raw: number; gzipped: number; brotli?: number } {
  const baseSize = getMockBundleSize(bundlePath);
  return {
    raw: baseSize,
    gzipped: Math.floor(baseSize * 0.3),
    brotli: Math.floor(baseSize * 0.25),
  };
}

// ============================================================================
// CHUNK ANALYSIS
// ============================================================================

export async function analyzeChunks(bundlePath: string): Promise<BundleChunk[]> {
  const bundleName = extractBundleName(bundlePath);

  switch (bundleName) {
    case 'main':
      return [
        {
          name: 'app-entry',
          size: 400 * 1024,
          type: 'entry',
          modules: ['src/main.ts', 'src/App.tsx', 'src/router.ts'],
          dependencies: ['react', 'react-dom'],
          criticalPath: true,
          loadPriority: 'high',
        },
        {
          name: 'runtime',
          size: 50 * 1024,
          type: 'runtime',
          modules: ['webpack/runtime'],
          dependencies: [],
          criticalPath: true,
          loadPriority: 'high',
        },
      ];

    case 'vendor':
      return [
        {
          name: 'react-vendor',
          size: 300 * 1024,
          type: 'vendor',
          modules: ['react', 'react-dom', 'react-router'],
          dependencies: [],
          criticalPath: true,
          loadPriority: 'high',
        },
        {
          name: 'ui-vendor',
          size: 200 * 1024,
          type: 'vendor',
          modules: ['styled-components', 'framer-motion'],
          dependencies: ['react'],
          criticalPath: false,
          loadPriority: 'medium',
        },
      ];

    default:
      return [
        {
          name: `${bundleName}-chunk`,
          size: getMockBundleSize(bundlePath),
          type: 'async',
          modules: [`src/modules/${bundleName}/index.ts`],
          dependencies: ['react'],
          criticalPath: false,
          loadPriority: 'low',
        },
      ];
  }
}

// ============================================================================
// DEPENDENCY ANALYSIS
// ============================================================================

export async function analyzeDependencies(
  _bundlePath: string
): Promise<DependencyAnalysis[]> {
  return [
    {
      name: 'react',
      version: '18.2.0',
      size: 42 * 1024,
      usage: 'full',
      alternatives: [
        { name: 'preact', size: 10 * 1024, compatibility: 85 },
        { name: 'solid-js', size: 8 * 1024, compatibility: 70 },
      ],
      necessity: 'critical',
    },
    {
      name: 'lodash',
      version: '4.17.21',
      size: 528 * 1024,
      usage: 'partial',
      alternatives: [
        { name: 'lodash-es', size: 250 * 1024, compatibility: 100 },
        { name: 'ramda', size: 173 * 1024, compatibility: 80 },
      ],
      necessity: 'optional',
    },
    {
      name: 'moment',
      version: '2.29.4',
      size: 232 * 1024,
      usage: 'partial',
      alternatives: [
        { name: 'date-fns', size: 78 * 1024, compatibility: 95 },
        { name: 'dayjs', size: 8 * 1024, compatibility: 90 },
      ],
      necessity: 'important',
    },
    {
      name: 'maplibre-gl',
      version: '3.0.0',
      size: 1200 * 1024,
      usage: 'full',
      alternatives: [
        { name: 'leaflet', size: 140 * 1024, compatibility: 70 },
      ],
      necessity: 'critical',
    },
  ];
}

// ============================================================================
// DUPLICATE MODULE DETECTION
// ============================================================================

export async function findDuplicateModules(
  _bundlePath: string
): Promise<DuplicateModule[]> {
  return [
    {
      module: 'react',
      instances: [
        { chunk: 'main', size: 42 * 1024 },
        { chunk: 'vendor', size: 42 * 1024, version: '18.2.0' },
      ],
      consolidationOpportunity: 42 * 1024,
    },
    {
      module: 'tslib',
      instances: [
        { chunk: 'main', size: 12 * 1024 },
        { chunk: 'dxf-transformation', size: 12 * 1024 },
        { chunk: 'alert-engine', size: 12 * 1024 },
      ],
      consolidationOpportunity: 24 * 1024,
    },
  ];
}

// ============================================================================
// UNUSED CODE DETECTION
// ============================================================================

export async function findUnusedCode(
  _bundlePath: string
): Promise<UnusedCodeAnalysis[]> {
  return [
    {
      file: 'src/utils/legacy-helpers.ts',
      unusedExports: ['deprecatedFunction', 'oldUtility'],
      unusedImports: ['unused-library'],
      deadCode: { lines: [45, 46, 47, 89, 90, 91, 92], estimatedSize: 2.5 * 1024 },
      removalImpact: 'safe',
    },
    {
      file: 'src/components/unused-components/OldButton.tsx',
      unusedExports: ['OldButton'],
      unusedImports: ['styled-components'],
      deadCode: { lines: [], estimatedSize: 8 * 1024 },
      removalImpact: 'safe',
    },
  ];
}

// ============================================================================
// LOAD TIME CALCULATION
// ============================================================================

export async function calculateLoadTime(
  bundlePath: string
): Promise<{ estimated: number; actual?: number }> {
  const bundleSize = getMockBundleSize(bundlePath);
  const speed4g = 500 * 1024; // 500KB/s
  return { estimated: (bundleSize / speed4g) * 1000 };
}

// ============================================================================
// RECOMMENDATION GENERATION
// ============================================================================

export async function generateBundleRecommendations(
  analysis: BundleAnalysis,
  config: BundleOptimizationConfig,
  formatBytes: (bytes: number) => string
): Promise<OptimizationRecommendation[]> {
  const recommendations: OptimizationRecommendation[] = [];

  if (analysis.size.raw > config.targets.maxBundleSize * 1024 * 1024) {
    recommendations.push({
      type: 'code-splitting',
      priority: 'critical',
      description: `Bundle size (${formatBytes(analysis.size.raw)}) exceeds target (${config.targets.maxBundleSize}MB)`,
      estimatedSavings: analysis.size.raw * 0.4,
      effort: 'medium',
      implementation: 'Implement dynamic imports και route-based code splitting',
      risks: ['Increased complexity', 'Potential loading delays'],
    });
  }

  const largeDeps = analysis.dependencies.filter(dep => dep.size > 100 * 1024);
  largeDeps.forEach(dep => {
    if (dep.alternatives.length > 0) {
      const bestAlternative = dep.alternatives.reduce((best, alt) =>
        alt.size < best.size && alt.compatibility > 80 ? alt : best
      );

      recommendations.push({
        type: 'dependency-replacement',
        priority: dep.necessity === 'critical' ? 'medium' : 'high',
        description: `Replace ${dep.name} (${formatBytes(dep.size)}) with ${bestAlternative.name} (${formatBytes(bestAlternative.size)})`,
        estimatedSavings: dep.size - bestAlternative.size,
        effort: dep.necessity === 'critical' ? 'high' : 'medium',
        implementation: `npm uninstall ${dep.name} && npm install ${bestAlternative.name}`,
        risks: [`Compatibility: ${bestAlternative.compatibility}%`, 'API differences'],
      });
    }
  });

  if (analysis.duplicates.length > 0) {
    const totalSavings = analysis.duplicates.reduce((sum, dup) => sum + dup.consolidationOpportunity, 0);
    recommendations.push({
      type: 'code-splitting',
      priority: 'high',
      description: `Consolidate ${analysis.duplicates.length} duplicate modules`,
      estimatedSavings: totalSavings,
      effort: 'low',
      implementation: 'Configure webpack splitChunks optimization',
      risks: ['Minimal risk'],
    });
  }

  if (analysis.unusedCode.length > 0) {
    const totalUnused = analysis.unusedCode.reduce((sum, unused) => sum + unused.deadCode.estimatedSize, 0);
    recommendations.push({
      type: 'tree-shaking',
      priority: 'medium',
      description: `Remove unused code από ${analysis.unusedCode.length} files`,
      estimatedSavings: totalUnused,
      effort: 'low',
      implementation: 'Enable tree shaking και remove unused imports/exports',
      risks: ['Verify no runtime dependencies'],
    });
  }

  return recommendations;
}

// ============================================================================
// BUNDLE DISCOVERY
// ============================================================================

export async function discoverBundles(): Promise<string[]> {
  return [
    'dist/main.js',
    'dist/vendor.js',
    'dist/chunks/dxf-transformation.js',
    'dist/chunks/map-integration.js',
    'dist/chunks/alert-engine.js',
    'dist/chunks/design-system.js',
    'dist/chunks/performance.js',
  ];
}
