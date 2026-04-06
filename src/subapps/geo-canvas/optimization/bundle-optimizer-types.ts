/**
 * BUNDLE OPTIMIZER — TYPE DEFINITIONS
 * Extracted from BundleOptimizer.ts (ADR-065 SRP split)
 */

// ============================================================================
// ANALYSIS MODELS
// ============================================================================

export interface BundleAnalysis {
  bundleName: string;
  size: {
    raw: number;
    gzipped: number;
    brotli?: number;
  };
  chunks: BundleChunk[];
  dependencies: DependencyAnalysis[];
  duplicates: DuplicateModule[];
  unusedCode: UnusedCodeAnalysis[];
  loadTime: {
    estimated: number;
    actual?: number;
  };
  recommendations: OptimizationRecommendation[];
}

export interface BundleChunk {
  name: string;
  size: number;
  type: 'entry' | 'vendor' | 'async' | 'runtime';
  modules: string[];
  dependencies: string[];
  criticalPath: boolean;
  loadPriority: 'high' | 'medium' | 'low';
}

export interface DependencyAnalysis {
  name: string;
  version: string;
  size: number;
  usage: 'full' | 'partial' | 'tree-shaken';
  alternatives: {
    name: string;
    size: number;
    compatibility: number;
  }[];
  necessity: 'critical' | 'important' | 'optional' | 'unused';
}

export interface DuplicateModule {
  module: string;
  instances: {
    chunk: string;
    size: number;
    version?: string;
  }[];
  consolidationOpportunity: number;
}

export interface UnusedCodeAnalysis {
  file: string;
  unusedExports: string[];
  unusedImports: string[];
  deadCode: {
    lines: number[];
    estimatedSize: number;
  };
  removalImpact: 'safe' | 'risky' | 'unsafe';
}

export interface OptimizationRecommendation {
  type: 'code-splitting' | 'tree-shaking' | 'compression' | 'lazy-loading' | 'dependency-replacement';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  estimatedSavings: number;
  effort: 'low' | 'medium' | 'high';
  implementation: string;
  risks: string[];
}

// ============================================================================
// CONFIGURATION MODELS
// ============================================================================

export interface BundleOptimizationConfig {
  targets: {
    maxBundleSize: number;
    maxChunkSize: number;
    maxLoadTime: number;
  };
  optimization: {
    enableCodeSplitting: boolean;
    enableTreeShaking: boolean;
    enableCompression: boolean;
    enableLazyLoading: boolean;
  };
  analysis: {
    includeDev: boolean;
    includeSourceMaps: boolean;
    detailedReport: boolean;
  };
  output: {
    format: 'json' | 'html' | 'csv';
    includeVisualization: boolean;
  };
}

export interface PerformanceBudget {
  maxSize: number;
  maxRequests: number;
  maxLoadTime: number;
  thresholds: {
    warning: number;
    error: number;
  };
}

// ============================================================================
// VISUALIZATION MODELS
// ============================================================================

export interface TreemapNode {
  name: string;
  value?: number;
  type?: string;
  children?: TreemapNode[];
}

export interface TimelineDataPoint {
  bundle: string;
  loadTime: number;
  size: number;
  criticalPath: boolean;
}

export interface VisualizationData {
  treemap: TreemapNode;
  sunburst: TreemapNode;
  timeline: TimelineDataPoint[];
}

// ============================================================================
// REPORT MODELS
// ============================================================================

export interface BundleSummary {
  summary: {
    totalBundles: number;
    totalSize: number;
    totalSizeFormatted: string;
    totalRecommendations: number;
    potentialSavings: number;
    potentialSavingsFormatted: string;
    budgetCompliance: {
      passed: boolean;
      violations: string[];
      totalSize: number;
      recommendations: string[];
    };
  };
  bundles: BundleReportEntry[];
  visualization: VisualizationData;
}

export interface BundleReportEntry extends BundleAnalysis {
  name: string;
  sizeFormatted: {
    raw: string;
    gzipped: string;
    brotli?: string;
  };
}
