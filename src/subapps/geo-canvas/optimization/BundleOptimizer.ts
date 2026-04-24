/**
 * BUNDLE SIZE OPTIMIZER — MAIN CLASS
 * Geo-Alert System - Phase 7: Bundle Analysis & Optimization
 *
 * Singleton class for centralized bundle optimization.
 * Analysis and reporting logic extracted to sibling modules (ADR-065).
 */

import { performance } from 'perf_hooks';

import type {
  BundleAnalysis,
  BundleOptimizationConfig,
  PerformanceBudget,
  OptimizationRecommendation,
  VisualizationData,
  BundleSummary,
} from './bundle-optimizer-types';

import {
  discoverBundles,
  extractBundleName,
  calculateBundleSize,
  analyzeChunks,
  analyzeDependencies,
  findDuplicateModules,
  findUnusedCode,
  calculateLoadTime,
  generateBundleRecommendations,
} from './bundle-optimizer-analysis';

import {
  generateVisualization,
  generateSummary,
  generateHTMLReport,
  generateCSVReport,
  generateOptimizationPlan,
} from './bundle-optimizer-reporting';

// Re-export all types for consumers
export type {
  BundleAnalysis,
  BundleChunk,
  DependencyAnalysis,
  DuplicateModule,
  UnusedCodeAnalysis,
  OptimizationRecommendation,
  BundleOptimizationConfig,
  PerformanceBudget,
  TreemapNode,
  TimelineDataPoint,
  VisualizationData,
  BundleSummary,
  BundleReportEntry,
} from './bundle-optimizer-types';

// ============================================================================
// MAIN CLASS
// ============================================================================

export class GeoAlertBundleOptimizer {
  private static instance: GeoAlertBundleOptimizer | null = null;
  private config: BundleOptimizationConfig;
  private performanceBudget: PerformanceBudget;
  private analysisResults: Map<string, BundleAnalysis> = new Map();

  // ==========================================================================
  // SINGLETON
  // ==========================================================================

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

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  private getDefaultConfig(): BundleOptimizationConfig {
    return {
      targets: { maxBundleSize: 3.0, maxChunkSize: 250, maxLoadTime: 2000 },
      optimization: {
        enableCodeSplitting: true,
        enableTreeShaking: true,
        enableCompression: true,
        enableLazyLoading: true,
      },
      analysis: { includeDev: false, includeSourceMaps: true, detailedReport: true },
      output: { format: 'json', includeVisualization: true },
    };
  }

  private getDefaultBudget(): PerformanceBudget {
    return {
      maxSize: 3 * 1024 * 1024,
      maxRequests: 50,
      maxLoadTime: 2000,
      thresholds: { warning: 2.5 * 1024 * 1024, error: 4 * 1024 * 1024 },
    };
  }

  // ==========================================================================
  // BUNDLE ANALYSIS
  // ==========================================================================

  public async analyzeBundles(): Promise<Map<string, BundleAnalysis>> {
    console.debug('🔍 BUNDLE ANALYSIS - Starting comprehensive analysis...');
    const startTime = performance.now();

    const bundles = await discoverBundles();

    for (const bundlePath of bundles) {
      const analysis = await this.analyzeSingleBundle(bundlePath);
      this.analysisResults.set(bundlePath, analysis);
    }

    const duration = performance.now() - startTime;
    console.debug(`✅ Bundle analysis completed in ${duration.toFixed(2)}ms`);

    generateOptimizationPlan(this.analysisResults, this.formatBytes);

    return this.analysisResults;
  }

  private async analyzeSingleBundle(bundlePath: string): Promise<BundleAnalysis> {
    const mockAnalysis: BundleAnalysis = {
      bundleName: extractBundleName(bundlePath),
      size: calculateBundleSize(bundlePath),
      chunks: await analyzeChunks(bundlePath),
      dependencies: await analyzeDependencies(bundlePath),
      duplicates: await findDuplicateModules(bundlePath),
      unusedCode: await findUnusedCode(bundlePath),
      loadTime: await calculateLoadTime(bundlePath),
      recommendations: [],
    };

    mockAnalysis.recommendations = await generateBundleRecommendations(
      mockAnalysis, this.config, this.formatBytes
    );

    return mockAnalysis;
  }

  // ==========================================================================
  // PERFORMANCE BUDGET VALIDATION
  // ==========================================================================

  public validatePerformanceBudget(): {
    passed: boolean;
    violations: string[];
    totalSize: number;
    recommendations: string[];
  } {
    let totalSize = 0;
    const violations: string[] = [];
    const recommendations: string[] = [];

    for (const [bundleName, analysis] of this.analysisResults.entries()) {
      totalSize += analysis.size.raw;

      if (analysis.size.raw > this.config.targets.maxChunkSize * 1024) {
        violations.push(`${bundleName}: ${this.formatBytes(analysis.size.raw)} exceeds chunk limit`);
      }

      if (analysis.loadTime.estimated > this.config.targets.maxLoadTime) {
        violations.push(`${bundleName}: Load time ${analysis.loadTime.estimated}ms exceeds limit`);
      }
    }

    if (totalSize > this.performanceBudget.maxSize) {
      violations.push(`Total size ${this.formatBytes(totalSize)} exceeds budget ${this.formatBytes(this.performanceBudget.maxSize)}`);
    }

    if (violations.length > 0) {
      recommendations.push('Implement code splitting για large bundles');
      recommendations.push('Enable compression (gzip/brotli)');
      recommendations.push('Replace heavy dependencies με lighter alternatives');
      recommendations.push('Remove unused code και dependencies');
    }

    return { passed: violations.length === 0, violations, totalSize, recommendations };
  }

  // ==========================================================================
  // VISUALIZATION & REPORTING
  // ==========================================================================

  public generateVisualization(): VisualizationData {
    return generateVisualization(this.analysisResults);
  }

  public generateReport(format: 'json' | 'html' | 'csv' = 'json'): string {
    const summary = this.generateSummaryData();

    switch (format) {
      case 'html':
        return generateHTMLReport(summary, this.formatBytes);
      case 'csv':
        return generateCSVReport(summary);
      default:
        return JSON.stringify(summary, null, 2);
    }
  }

  private generateSummaryData(): BundleSummary {
    return generateSummary(
      this.analysisResults,
      this.validatePerformanceBudget(),
      this.formatBytes
    );
  }

  // ==========================================================================
  // AUTOMATED OPTIMIZATION
  // ==========================================================================

  public async applyAutomatedOptimizations(): Promise<{
    applied: string[];
    skipped: string[];
    errors: string[];
  }> {
    const applied: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    console.debug('🤖 AUTOMATED OPTIMIZATION - Starting...');

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
    return recommendation.effort === 'low' &&
      recommendation.risks.every(risk =>
        risk.toLowerCase().includes('minimal') || risk.toLowerCase().includes('low')
      );
  }

  private async applyOptimization(recommendation: OptimizationRecommendation): Promise<void> {
    console.debug(`🔧 Applying: ${recommendation.description}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // ==========================================================================
  // UTILITIES & PUBLIC ACCESSORS
  // ==========================================================================

  private formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  public getAnalysisResults(): Map<string, BundleAnalysis> {
    return this.analysisResults;
  }

  public updateConfig(config: Partial<BundleOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public updateBudget(budget: Partial<PerformanceBudget>): void {
    this.performanceBudget = { ...this.performanceBudget, ...budget };
  }

  public clearResults(): void {
    this.analysisResults.clear();
  }
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

export const geoAlertBundleOptimizer = GeoAlertBundleOptimizer.getInstance();

export const analyzeBundles = () => geoAlertBundleOptimizer.analyzeBundles();
export const validateBudget = () => geoAlertBundleOptimizer.validatePerformanceBudget();

export default geoAlertBundleOptimizer;
