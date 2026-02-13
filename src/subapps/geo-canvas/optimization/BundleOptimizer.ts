/**
 * BUNDLE SIZE OPTIMIZER
 * Geo-Alert System - Phase 7: Bundle Analysis & Optimization
 *
 * Enterprise-class bundle optimization system που αναλύει και βελτιστοποιεί
 * bundle size, code splitting, και loading performance.
 */

import { performance } from 'perf_hooks';
import { GEO_COLORS } from '../config/color-config';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Bundle analysis result
 */
export interface BundleAnalysis {
  bundleName: string;
  size: {
    raw: number;        // Bytes
    gzipped: number;    // Bytes
    brotli?: number;    // Bytes
  };
  chunks: BundleChunk[];
  dependencies: DependencyAnalysis[];
  duplicates: DuplicateModule[];
  unusedCode: UnusedCodeAnalysis[];
  loadTime: {
    estimated: number;  // ms
    actual?: number;    // ms
  };
  recommendations: OptimizationRecommendation[];
}

/**
 * Bundle chunk information
 */
export interface BundleChunk {
  name: string;
  size: number;
  type: 'entry' | 'vendor' | 'async' | 'runtime';
  modules: string[];
  dependencies: string[];
  criticalPath: boolean;
  loadPriority: 'high' | 'medium' | 'low';
}

/**
 * Dependency analysis
 */
export interface DependencyAnalysis {
  name: string;
  version: string;
  size: number;
  usage: 'full' | 'partial' | 'tree-shaken';
  alternatives: {
    name: string;
    size: number;
    compatibility: number; // 0-100%
  }[];
  necessity: 'critical' | 'important' | 'optional' | 'unused';
}

/**
 * Duplicate module detection
 */
export interface DuplicateModule {
  module: string;
  instances: {
    chunk: string;
    size: number;
    version?: string;
  }[];
  consolidationOpportunity: number; // Bytes saved
}

/**
 * Unused code analysis
 */
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

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  type: 'code-splitting' | 'tree-shaking' | 'compression' | 'lazy-loading' | 'dependency-replacement';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  estimatedSavings: number; // Bytes
  effort: 'low' | 'medium' | 'high';
  implementation: string;
  risks: string[];
}

/**
 * Bundle optimization config
 */
export interface BundleOptimizationConfig {
  targets: {
    maxBundleSize: number;    // MB
    maxChunkSize: number;     // KB
    maxLoadTime: number;      // ms
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

/**
 * Performance budget
 */
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
// 🏢 ENTERPRISE: Visualization Type Definitions (ADR-compliant - NO any)
// ============================================================================

/**
 * Treemap node structure
 */
export interface TreemapNode {
  name: string;
  value?: number;
  type?: string;
  children?: TreemapNode[];
}

/**
 * Timeline data point
 */
export interface TimelineDataPoint {
  bundle: string;
  loadTime: number;
  size: number;
  criticalPath: boolean;
}

/**
 * Visualization data structure
 */
export interface VisualizationData {
  treemap: TreemapNode;
  sunburst: TreemapNode;
  timeline: TimelineDataPoint[];
}

/**
 * Bundle summary for reports
 */
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

/**
 * Bundle report entry
 */
export interface BundleReportEntry extends BundleAnalysis {
  name: string;
  sizeFormatted: {
    raw: string;
    gzipped: string;
    brotli?: string;
  };
}

// ============================================================================
// MAIN BUNDLE OPTIMIZER CLASS
// ============================================================================

/**
 * Bundle Size Optimizer - Enterprise Bundle Analysis & Optimization
 * Singleton pattern για centralized bundle optimization
 */
export class GeoAlertBundleOptimizer {
  private static instance: GeoAlertBundleOptimizer | null = null;
  private config: BundleOptimizationConfig;
  private performanceBudget: PerformanceBudget;
  private analysisResults: Map<string, BundleAnalysis> = new Map();

  // ========================================================================
  // SINGLETON PATTERN
  // ========================================================================

  private constructor() {
    this.config = this.getDefaultConfig();
    this.performanceBudget = this.getDefaultBudget();
  }

  public static getInstance(): GeoAlertBundleOptimizer {
    if (!GeoAlertBundleOptimizer.instance) {
      GeoAlertBundleOptimizer.instance = new GeoAlertBundleOptimizer();
    }
    return GeoAlertBundleOptimizer.instance;
  }

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  private getDefaultConfig(): BundleOptimizationConfig {
    return {
      targets: {
        maxBundleSize: 3.0,    // 3MB
        maxChunkSize: 250,     // 250KB
        maxLoadTime: 2000      // 2 seconds
      },
      optimization: {
        enableCodeSplitting: true,
        enableTreeShaking: true,
        enableCompression: true,
        enableLazyLoading: true
      },
      analysis: {
        includeDev: false,
        includeSourceMaps: true,
        detailedReport: true
      },
      output: {
        format: 'json',
        includeVisualization: true
      }
    };
  }

  private getDefaultBudget(): PerformanceBudget {
    return {
      maxSize: 3 * 1024 * 1024,    // 3MB
      maxRequests: 50,
      maxLoadTime: 2000,           // 2s
      thresholds: {
        warning: 2.5 * 1024 * 1024, // 2.5MB
        error: 4 * 1024 * 1024      // 4MB
      }
    };
  }

  // ========================================================================
  // BUNDLE ANALYSIS ENGINE
  // ========================================================================

  /**
   * Analyze complete bundle structure και performance
   */
  public async analyzeBundles(): Promise<Map<string, BundleAnalysis>> {
    console.debug('🔍 BUNDLE ANALYSIS - Starting comprehensive analysis...');

    const startTime = performance.now();

    // Simulate bundle discovery
    const bundles = await this.discoverBundles();

    for (const bundlePath of bundles) {
      const analysis = await this.analyzeSingleBundle(bundlePath);
      this.analysisResults.set(bundlePath, analysis);
    }

    const duration = performance.now() - startTime;
    console.debug(`✅ Bundle analysis completed in ${duration.toFixed(2)}ms`);

    // Generate optimization recommendations
    await this.generateOptimizationPlan();

    return this.analysisResults;
  }

  /**
   * Discover all bundle files στο project
   */
  private async discoverBundles(): Promise<string[]> {
    // Mock bundle discovery - στην πραγματικότητα θα σκάναρε το dist/ folder
    return [
      'dist/main.js',
      'dist/vendor.js',
      'dist/chunks/dxf-transformation.js',
      'dist/chunks/map-integration.js',
      'dist/chunks/alert-engine.js',
      'dist/chunks/design-system.js',
      'dist/chunks/performance.js'
    ];
  }

  /**
   * Analyze single bundle file
   */
  private async analyzeSingleBundle(bundlePath: string): Promise<BundleAnalysis> {
    const bundleName = this.extractBundleName(bundlePath);

    // Mock bundle analysis - real implementation would parse actual bundles
    const mockAnalysis: BundleAnalysis = {
      bundleName,
      size: this.calculateBundleSize(bundlePath),
      chunks: await this.analyzeChunks(bundlePath),
      dependencies: await this.analyzeDependencies(bundlePath),
      duplicates: await this.findDuplicateModules(bundlePath),
      unusedCode: await this.findUnusedCode(bundlePath),
      loadTime: await this.calculateLoadTime(bundlePath),
      recommendations: []
    };

    // Generate specific recommendations για αυτό το bundle
    mockAnalysis.recommendations = await this.generateBundleRecommendations(mockAnalysis);

    return mockAnalysis;
  }

  // ========================================================================
  // SIZE ANALYSIS
  // ========================================================================

  private calculateBundleSize(bundlePath: string): { raw: number; gzipped: number; brotli?: number } {
    // Mock size calculation based on bundle type
    const baseSize = this.getMockBundleSize(bundlePath);

    return {
      raw: baseSize,
      gzipped: Math.floor(baseSize * 0.3), // ~30% compression ratio
      brotli: Math.floor(baseSize * 0.25)  // ~25% compression ratio
    };
  }

  private getMockBundleSize(bundlePath: string): number {
    const sizeMap = {
      'main.js': 1.2 * 1024 * 1024,           // 1.2MB
      'vendor.js': 800 * 1024,                // 800KB
      'dxf-transformation.js': 300 * 1024,    // 300KB
      'map-integration.js': 450 * 1024,       // 450KB
      'alert-engine.js': 250 * 1024,          // 250KB
      'design-system.js': 180 * 1024,         // 180KB
      'performance.js': 120 * 1024            // 120KB
    };

    const fileName = bundlePath.split('/').pop() || bundlePath;
    return sizeMap[fileName as keyof typeof sizeMap] || 100 * 1024; // Default 100KB
  }

  // ========================================================================
  // CHUNK ANALYSIS
  // ========================================================================

  private async analyzeChunks(bundlePath: string): Promise<BundleChunk[]> {
    const bundleName = this.extractBundleName(bundlePath);

    // Mock chunk analysis based on bundle type
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
            loadPriority: 'high'
          },
          {
            name: 'runtime',
            size: 50 * 1024,
            type: 'runtime',
            modules: ['webpack/runtime'],
            dependencies: [],
            criticalPath: true,
            loadPriority: 'high'
          }
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
            loadPriority: 'high'
          },
          {
            name: 'ui-vendor',
            size: 200 * 1024,
            type: 'vendor',
            modules: ['styled-components', 'framer-motion'],
            dependencies: ['react'],
            criticalPath: false,
            loadPriority: 'medium'
          }
        ];

      default:
        return [
          {
            name: `${bundleName}-chunk`,
            size: this.getMockBundleSize(bundlePath),
            type: 'async',
            modules: [`src/modules/${bundleName}/index.ts`],
            dependencies: ['react'],
            criticalPath: false,
            loadPriority: 'low'
          }
        ];
    }
  }

  // ========================================================================
  // DEPENDENCY ANALYSIS
  // ========================================================================

  private async analyzeDependencies(bundlePath: string): Promise<DependencyAnalysis[]> {
    // Mock dependency analysis
    return [
      {
        name: 'react',
        version: '18.2.0',
        size: 42 * 1024, // 42KB
        usage: 'full',
        alternatives: [
          { name: 'preact', size: 10 * 1024, compatibility: 85 },
          { name: 'solid-js', size: 8 * 1024, compatibility: 70 }
        ],
        necessity: 'critical'
      },
      {
        name: 'lodash',
        version: '4.17.21',
        size: 528 * 1024, // 528KB
        usage: 'partial',
        alternatives: [
          { name: 'lodash-es', size: 250 * 1024, compatibility: 100 },
          { name: 'ramda', size: 173 * 1024, compatibility: 80 }
        ],
        necessity: 'optional'
      },
      {
        name: 'moment',
        version: '2.29.4',
        size: 232 * 1024, // 232KB
        usage: 'partial',
        alternatives: [
          { name: 'date-fns', size: 78 * 1024, compatibility: 95 },
          { name: 'dayjs', size: 8 * 1024, compatibility: 90 }
        ],
        necessity: 'important'
      },
      {
        name: 'maplibre-gl',
        version: '3.0.0',
        size: 1200 * 1024, // 1.2MB
        usage: 'full',
        alternatives: [
          { name: 'leaflet', size: 140 * 1024, compatibility: 70 }
        ],
        necessity: 'critical'
      }
    ];
  }

  // ========================================================================
  // DUPLICATE DETECTION
  // ========================================================================

  private async findDuplicateModules(bundlePath: string): Promise<DuplicateModule[]> {
    // Mock duplicate detection
    return [
      {
        module: 'react',
        instances: [
          { chunk: 'main', size: 42 * 1024 },
          { chunk: 'vendor', size: 42 * 1024, version: '18.2.0' }
        ],
        consolidationOpportunity: 42 * 1024
      },
      {
        module: 'tslib',
        instances: [
          { chunk: 'main', size: 12 * 1024 },
          { chunk: 'dxf-transformation', size: 12 * 1024 },
          { chunk: 'alert-engine', size: 12 * 1024 }
        ],
        consolidationOpportunity: 24 * 1024 // 2 duplicates
      }
    ];
  }

  // ========================================================================
  // UNUSED CODE DETECTION
  // ========================================================================

  private async findUnusedCode(bundlePath: string): Promise<UnusedCodeAnalysis[]> {
    // Mock unused code detection
    return [
      {
        file: 'src/utils/legacy-helpers.ts',
        unusedExports: ['deprecatedFunction', 'oldUtility'],
        unusedImports: ['unused-library'],
        deadCode: {
          lines: [45, 46, 47, 89, 90, 91, 92],
          estimatedSize: 2.5 * 1024 // 2.5KB
        },
        removalImpact: 'safe'
      },
      {
        file: 'src/components/unused-components/OldButton.tsx',
        unusedExports: ['OldButton'],
        unusedImports: ['styled-components'],
        deadCode: {
          lines: [], // Entire file
          estimatedSize: 8 * 1024 // 8KB
        },
        removalImpact: 'safe'
      }
    ];
  }

  // ========================================================================
  // LOAD TIME CALCULATION
  // ========================================================================

  private async calculateLoadTime(bundlePath: string): Promise<{ estimated: number; actual?: number }> {
    const bundleSize = this.getMockBundleSize(bundlePath);

    // Estimate based on network conditions
    const networkSpeeds = {
      '3g': 50 * 1024,      // 50KB/s
      '4g': 500 * 1024,     // 500KB/s
      'wifi': 2000 * 1024   // 2MB/s
    };

    const estimatedTime = {
      '3g': bundleSize / networkSpeeds['3g'] * 1000,
      '4g': bundleSize / networkSpeeds['4g'] * 1000,
      'wifi': bundleSize / networkSpeeds['wifi'] * 1000
    };

    // Use 4G as baseline
    return {
      estimated: estimatedTime['4g']
    };
  }

  // ========================================================================
  // OPTIMIZATION RECOMMENDATIONS
  // ========================================================================

  private async generateBundleRecommendations(analysis: BundleAnalysis): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Check bundle size
    if (analysis.size.raw > this.config.targets.maxBundleSize * 1024 * 1024) {
      recommendations.push({
        type: 'code-splitting',
        priority: 'critical',
        description: `Bundle size (${this.formatBytes(analysis.size.raw)}) exceeds target (${this.config.targets.maxBundleSize}MB)`,
        estimatedSavings: analysis.size.raw * 0.4, // 40% reduction
        effort: 'medium',
        implementation: 'Implement dynamic imports και route-based code splitting',
        risks: ['Increased complexity', 'Potential loading delays']
      });
    }

    // Check for large dependencies
    const largeDeps = analysis.dependencies.filter(dep => dep.size > 100 * 1024);
    largeDeps.forEach(dep => {
      if (dep.alternatives.length > 0) {
        const bestAlternative = dep.alternatives.reduce((best, alt) =>
          alt.size < best.size && alt.compatibility > 80 ? alt : best
        );

        recommendations.push({
          type: 'dependency-replacement',
          priority: dep.necessity === 'critical' ? 'medium' : 'high',
          description: `Replace ${dep.name} (${this.formatBytes(dep.size)}) with ${bestAlternative.name} (${this.formatBytes(bestAlternative.size)})`,
          estimatedSavings: dep.size - bestAlternative.size,
          effort: dep.necessity === 'critical' ? 'high' : 'medium',
          implementation: `npm uninstall ${dep.name} && npm install ${bestAlternative.name}`,
          risks: [`Compatibility: ${bestAlternative.compatibility}%`, 'API differences']
        });
      }
    });

    // Check for duplicates
    if (analysis.duplicates.length > 0) {
      const totalSavings = analysis.duplicates.reduce((sum, dup) => sum + dup.consolidationOpportunity, 0);
      recommendations.push({
        type: 'code-splitting',
        priority: 'high',
        description: `Consolidate ${analysis.duplicates.length} duplicate modules`,
        estimatedSavings: totalSavings,
        effort: 'low',
        implementation: 'Configure webpack splitChunks optimization',
        risks: ['Minimal risk']
      });
    }

    // Check for unused code
    if (analysis.unusedCode.length > 0) {
      const totalUnused = analysis.unusedCode.reduce((sum, unused) => sum + unused.deadCode.estimatedSize, 0);
      recommendations.push({
        type: 'tree-shaking',
        priority: 'medium',
        description: `Remove unused code από ${analysis.unusedCode.length} files`,
        estimatedSavings: totalUnused,
        effort: 'low',
        implementation: 'Enable tree shaking και remove unused imports/exports',
        risks: ['Verify no runtime dependencies']
      });
    }

    return recommendations;
  }

  // ========================================================================
  // OPTIMIZATION PLAN GENERATION
  // ========================================================================

  private async generateOptimizationPlan(): Promise<void> {
    console.debug('\n📋 OPTIMIZATION PLAN GENERATION');
    console.debug('=================================');

    const allRecommendations: OptimizationRecommendation[] = [];

    // Collect all recommendations
    for (const [bundleName, analysis] of this.analysisResults.entries()) {
      allRecommendations.push(...analysis.recommendations);
    }

    // Sort by priority και potential savings
    const sortedRecommendations = allRecommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.estimatedSavings - a.estimatedSavings; // Higher savings first
    });

    // Generate implementation plan
    this.generateImplementationPlan(sortedRecommendations);

    // Calculate total potential savings
    const totalSavings = sortedRecommendations.reduce((sum, rec) => sum + rec.estimatedSavings, 0);
    console.debug(`💰 Total Potential Savings: ${this.formatBytes(totalSavings)}`);
  }

  private generateImplementationPlan(recommendations: OptimizationRecommendation[]): void {
    console.debug('\n🎯 IMPLEMENTATION PLAN');
    console.debug('======================');

    const phases = {
      immediate: recommendations.filter(r => r.priority === 'critical' && r.effort === 'low'),
      shortTerm: recommendations.filter(r => r.priority === 'high' || (r.priority === 'critical' && r.effort === 'medium')),
      mediumTerm: recommendations.filter(r => r.priority === 'medium'),
      longTerm: recommendations.filter(r => r.priority === 'low' || r.effort === 'high')
    };

    Object.entries(phases).forEach(([phase, recs]) => {
      if (recs.length > 0) {
        console.debug(`\n📅 ${phase.toUpperCase()} (${recs.length} tasks):`);
        recs.forEach((rec, index) => {
          const savings = this.formatBytes(rec.estimatedSavings);
          console.debug(`  ${index + 1}. ${rec.description} - Saves ${savings}`);
        });
      }
    });
  }

  // ========================================================================
  // PERFORMANCE BUDGET VALIDATION
  // ========================================================================

  /**
   * Validate bundles against performance budget
   */
  public validatePerformanceBudget(): {
    passed: boolean;
    violations: string[];
    totalSize: number;
    recommendations: string[];
  } {
    let totalSize = 0;
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Calculate total bundle size
    for (const [bundleName, analysis] of this.analysisResults.entries()) {
      totalSize += analysis.size.raw;

      // Check individual bundle size
      if (analysis.size.raw > this.config.targets.maxChunkSize * 1024) {
        violations.push(`${bundleName}: ${this.formatBytes(analysis.size.raw)} exceeds chunk limit`);
      }

      // Check load time
      if (analysis.loadTime.estimated > this.config.targets.maxLoadTime) {
        violations.push(`${bundleName}: Load time ${analysis.loadTime.estimated}ms exceeds limit`);
      }
    }

    // Check total size against budget
    if (totalSize > this.performanceBudget.maxSize) {
      violations.push(`Total size ${this.formatBytes(totalSize)} exceeds budget ${this.formatBytes(this.performanceBudget.maxSize)}`);
    }

    // Generate recommendations
    if (violations.length > 0) {
      recommendations.push('Implement code splitting για large bundles');
      recommendations.push('Enable compression (gzip/brotli)');
      recommendations.push('Replace heavy dependencies με lighter alternatives');
      recommendations.push('Remove unused code και dependencies');
    }

    return {
      passed: violations.length === 0,
      violations,
      totalSize,
      recommendations
    };
  }

  // ========================================================================
  // VISUALIZATION & REPORTING
  // ========================================================================

  /**
   * Generate bundle visualization data
   */
  public generateVisualization(): VisualizationData {
    const treemapData = this.generateTreemapData();
    const sunburstData = this.generateSunburstData();
    const timelineData = this.generateTimelineData();

    return {
      treemap: treemapData,
      sunburst: sunburstData,
      timeline: timelineData
    };
  }

  private generateTreemapData(): TreemapNode {
    const children = Array.from(this.analysisResults.entries()).map(([bundleName, analysis]) => ({
      name: bundleName,
      value: analysis.size.raw,
      children: analysis.chunks.map(chunk => ({
        name: chunk.name,
        value: chunk.size,
        type: chunk.type
      }))
    }));

    return {
      name: 'geo-alert-bundles',
      children
    };
  }

  private generateSunburstData(): TreemapNode {
    // Similar structure but optimized για sunburst visualization
    return this.generateTreemapData();
  }

  private generateTimelineData(): TimelineDataPoint[] {
    return Array.from(this.analysisResults.entries()).map(([bundleName, analysis]) => ({
      bundle: bundleName,
      loadTime: analysis.loadTime.estimated,
      size: analysis.size.raw,
      criticalPath: analysis.chunks.some(chunk => chunk.criticalPath)
    }));
  }

  /**
   * Generate comprehensive report
   */
  public generateReport(format: 'json' | 'html' | 'csv' = 'json'): string {
    const summary = this.generateSummary();

    switch (format) {
      case 'html':
        return this.generateHTMLReport(summary);
      case 'csv':
        return this.generateCSVReport(summary);
      default:
        return JSON.stringify(summary, null, 2);
    }
  }

  private generateSummary(): BundleSummary {
    const totalSize = Array.from(this.analysisResults.values())
      .reduce((sum, analysis) => sum + analysis.size.raw, 0);

    const totalRecommendations = Array.from(this.analysisResults.values())
      .reduce((sum, analysis) => sum + analysis.recommendations.length, 0);

    const potentialSavings = Array.from(this.analysisResults.values())
      .reduce((sum, analysis) => {
        return sum + analysis.recommendations.reduce((recSum, rec) => recSum + rec.estimatedSavings, 0);
      }, 0);

    return {
      summary: {
        totalBundles: this.analysisResults.size,
        totalSize: totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        totalRecommendations,
        potentialSavings,
        potentialSavingsFormatted: this.formatBytes(potentialSavings),
        budgetCompliance: this.validatePerformanceBudget()
      },
      bundles: Array.from(this.analysisResults.entries()).map(([name, analysis]) => ({
        name,
        ...analysis,
        sizeFormatted: {
          raw: this.formatBytes(analysis.size.raw),
          gzipped: this.formatBytes(analysis.size.gzipped),
          brotli: analysis.size.brotli ? this.formatBytes(analysis.size.brotli) : undefined
        }
      })),
      visualization: this.generateVisualization()
    };
  }

  private generateHTMLReport(summary: BundleSummary): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Geo-Alert Bundle Analysis Report</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
        .summary { background: ${GEO_COLORS.OPTIMIZATION.REPORT_BACKGROUND}; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .bundle { border: 1px solid ${GEO_COLORS.OPTIMIZATION.REPORT_BORDER}; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .critical { border-left: 4px solid ${GEO_COLORS.OPTIMIZATION.CRITICAL_PRIORITY}; }
        .high { border-left: 4px solid ${GEO_COLORS.OPTIMIZATION.HIGH_PRIORITY}; }
        .medium { border-left: 4px solid ${GEO_COLORS.OPTIMIZATION.MEDIUM_PRIORITY}; }
        .low { border-left: 4px solid ${GEO_COLORS.OPTIMIZATION.LOW_PRIORITY}; }
        .recommendation { margin: 5px 0; padding: 10px; background: ${GEO_COLORS.OPTIMIZATION.RECOMMENDATION_BG}; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid ${GEO_COLORS.OPTIMIZATION.TABLE_BORDER}; padding: 8px; text-align: left; }
        th { background-color: ${GEO_COLORS.OPTIMIZATION.TABLE_HEADER}; }
        .size-large { color: ${GEO_COLORS.OPTIMIZATION.SIZE_LARGE}; font-weight: bold; }
        .size-medium { color: ${GEO_COLORS.OPTIMIZATION.SIZE_MEDIUM}; }
        .size-small { color: ${GEO_COLORS.OPTIMIZATION.SIZE_SMALL}; }
      </style>
    </head>
    <body>
      <h1>🎯 Geo-Alert Bundle Analysis Report</h1>

      <div class="summary">
        <h2>📊 Summary</h2>
        <p><strong>Total Bundles:</strong> ${summary.summary.totalBundles}</p>
        <p><strong>Total Size:</strong> ${summary.summary.totalSizeFormatted}</p>
        <p><strong>Recommendations:</strong> ${summary.summary.totalRecommendations}</p>
        <p><strong>Potential Savings:</strong> ${summary.summary.potentialSavingsFormatted}</p>
        <p><strong>Budget Compliance:</strong> ${summary.summary.budgetCompliance.passed ? '✅ Passed' : '❌ Failed'}</p>
      </div>

      <h2>📦 Bundle Details</h2>
      ${summary.bundles.map((bundle: BundleReportEntry) => `
        <div class="bundle">
          <h3>${bundle.name}</h3>
          <p><strong>Size:</strong> ${bundle.sizeFormatted.raw} (${bundle.sizeFormatted.gzipped} gzipped)</p>
          <p><strong>Chunks:</strong> ${bundle.chunks.length}</p>
          <p><strong>Dependencies:</strong> ${bundle.dependencies.length}</p>
          <p><strong>Load Time:</strong> ${bundle.loadTime.estimated.toFixed(0)}ms</p>

          ${bundle.recommendations.length > 0 ? `
            <h4>💡 Recommendations</h4>
            ${bundle.recommendations.map((rec: OptimizationRecommendation) => `
              <div class="recommendation ${rec.priority}">
                <strong>${rec.type}</strong> (${rec.priority}): ${rec.description}
                <br><em>Savings: ${this.formatBytes(rec.estimatedSavings)}</em>
              </div>
            `).join('')}
          ` : ''}
        </div>
      `).join('')}
    </body>
    </html>
    `;
  }

  private generateCSVReport(summary: BundleSummary): string {
    const headers = 'Bundle,Size (Raw),Size (Gzipped),Chunks,Dependencies,Load Time,Recommendations\n';
    const rows = summary.bundles.map((bundle: BundleReportEntry) =>
      `"${bundle.name}","${bundle.sizeFormatted.raw}","${bundle.sizeFormatted.gzipped}",${bundle.chunks.length},${bundle.dependencies.length},${bundle.loadTime.estimated.toFixed(0)}ms,${bundle.recommendations.length}`
    ).join('\n');

    return headers + rows;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private extractBundleName(bundlePath: string): string {
    return bundlePath.split('/').pop()?.replace('.js', '') || 'unknown';
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get analysis results
   */
  public getAnalysisResults(): Map<string, BundleAnalysis> {
    return this.analysisResults;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<BundleOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update performance budget
   */
  public updateBudget(budget: Partial<PerformanceBudget>): void {
    this.performanceBudget = { ...this.performanceBudget, ...budget };
  }

  /**
   * Clear analysis results
   */
  public clearResults(): void {
    this.analysisResults.clear();
  }

  // ========================================================================
  // AUTOMATED OPTIMIZATION
  // ========================================================================

  /**
   * Apply automated optimizations
   */
  public async applyAutomatedOptimizations(): Promise<{
    applied: string[];
    skipped: string[];
    errors: string[];
  }> {
    const applied: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    console.debug('🤖 AUTOMATED OPTIMIZATION - Starting...');

    // Apply safe optimizations
    for (const [bundleName, analysis] of this.analysisResults.entries()) {
      for (const recommendation of analysis.recommendations) {
        try {
          if (this.isSafeToAutomate(recommendation)) {
            await this.applyOptimization(recommendation);
            applied.push(`${bundleName}: ${recommendation.description}`);
          } else {
            skipped.push(`${bundleName}: ${recommendation.description} (requires manual review)`);
          }
        } catch (error) {
          errors.push(`${bundleName}: ${recommendation.description} - Error: ${error}`);
        }
      }
    }

    console.debug(`✅ Applied: ${applied.length} optimizations`);
    console.debug(`⏭️  Skipped: ${skipped.length} optimizations`);
    console.debug(`❌ Errors: ${errors.length} optimizations`);

    return { applied, skipped, errors };
  }

  private isSafeToAutomate(recommendation: OptimizationRecommendation): boolean {
    // Only automate low-risk, low-effort optimizations
    return recommendation.effort === 'low' &&
           recommendation.risks.every(risk => risk.toLowerCase().includes('minimal') || risk.toLowerCase().includes('low'));
  }

  private async applyOptimization(recommendation: OptimizationRecommendation): Promise<void> {
    // Mock optimization application
    console.debug(`🔧 Applying: ${recommendation.description}`);

    // In real implementation, this would:
    // - Update webpack config για code splitting
    // - Update package.json για dependency replacement
    // - Remove unused files
    // - Configure compression
    // etc.

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// ============================================================================
// GLOBAL EXPORTS & UTILITIES
// ============================================================================

/**
 * Global Bundle Optimizer Instance
 */
export const geoAlertBundleOptimizer = GeoAlertBundleOptimizer.getInstance();

/**
 * Quick analysis utilities
 */
export const analyzeBundles = () => geoAlertBundleOptimizer.analyzeBundles();
export const validateBudget = () => geoAlertBundleOptimizer.validatePerformanceBudget();
export const generateBundleReport = (format?: 'json' | 'html' | 'csv') => geoAlertBundleOptimizer.generateReport(format);

/**
 * Default export για convenience
 */
export default geoAlertBundleOptimizer;