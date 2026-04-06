/**
 * BUNDLE OPTIMIZER — REPORTING & VISUALIZATION
 * Extracted from BundleOptimizer.ts (ADR-065 SRP split)
 *
 * Functions for visualization data, HTML/CSV reports,
 * summary generation, and optimization plan output.
 */

import { GEO_COLORS } from '../config/color-config';
import type {
  BundleAnalysis,
  BundleSummary,
  BundleReportEntry,
  OptimizationRecommendation,
  VisualizationData,
  TreemapNode,
  TimelineDataPoint,
} from './bundle-optimizer-types';

// ============================================================================
// VISUALIZATION
// ============================================================================

function generateTreemapData(analysisResults: Map<string, BundleAnalysis>): TreemapNode {
  const children = Array.from(analysisResults.entries()).map(([bundleName, analysis]) => ({
    name: bundleName,
    value: analysis.size.raw,
    children: analysis.chunks.map(chunk => ({
      name: chunk.name,
      value: chunk.size,
      type: chunk.type,
    })),
  }));

  return { name: 'geo-alert-bundles', children };
}

function generateTimelineData(analysisResults: Map<string, BundleAnalysis>): TimelineDataPoint[] {
  return Array.from(analysisResults.entries()).map(([bundleName, analysis]) => ({
    bundle: bundleName,
    loadTime: analysis.loadTime.estimated,
    size: analysis.size.raw,
    criticalPath: analysis.chunks.some(chunk => chunk.criticalPath),
  }));
}

export function generateVisualization(analysisResults: Map<string, BundleAnalysis>): VisualizationData {
  const treemapData = generateTreemapData(analysisResults);
  return {
    treemap: treemapData,
    sunburst: treemapData, // same structure optimized for sunburst
    timeline: generateTimelineData(analysisResults),
  };
}

// ============================================================================
// SUMMARY GENERATION
// ============================================================================

export function generateSummary(
  analysisResults: Map<string, BundleAnalysis>,
  budgetCompliance: { passed: boolean; violations: string[]; totalSize: number; recommendations: string[] },
  formatBytes: (bytes: number) => string
): BundleSummary {
  const totalSize = Array.from(analysisResults.values())
    .reduce((sum, analysis) => sum + analysis.size.raw, 0);

  const totalRecommendations = Array.from(analysisResults.values())
    .reduce((sum, analysis) => sum + analysis.recommendations.length, 0);

  const potentialSavings = Array.from(analysisResults.values())
    .reduce((sum, analysis) => {
      return sum + analysis.recommendations.reduce((recSum, rec) => recSum + rec.estimatedSavings, 0);
    }, 0);

  return {
    summary: {
      totalBundles: analysisResults.size,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      totalRecommendations,
      potentialSavings,
      potentialSavingsFormatted: formatBytes(potentialSavings),
      budgetCompliance,
    },
    bundles: Array.from(analysisResults.entries()).map(([name, analysis]) => ({
      name,
      ...analysis,
      sizeFormatted: {
        raw: formatBytes(analysis.size.raw),
        gzipped: formatBytes(analysis.size.gzipped),
        brotli: analysis.size.brotli ? formatBytes(analysis.size.brotli) : undefined,
      },
    })),
    visualization: generateVisualization(analysisResults),
  };
}

// ============================================================================
// HTML REPORT
// ============================================================================

export function generateHTMLReport(
  summary: BundleSummary,
  formatBytes: (bytes: number) => string
): string {
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
                <br><em>Savings: ${formatBytes(rec.estimatedSavings)}</em>
              </div>
            `).join('')}
          ` : ''}
        </div>
      `).join('')}
    </body>
    </html>
  `;
}

// ============================================================================
// CSV REPORT
// ============================================================================

export function generateCSVReport(summary: BundleSummary): string {
  const headers = 'Bundle,Size (Raw),Size (Gzipped),Chunks,Dependencies,Load Time,Recommendations\n';
  const rows = summary.bundles.map((bundle: BundleReportEntry) =>
    `"${bundle.name}","${bundle.sizeFormatted.raw}","${bundle.sizeFormatted.gzipped}",${bundle.chunks.length},${bundle.dependencies.length},${bundle.loadTime.estimated.toFixed(0)}ms,${bundle.recommendations.length}`
  ).join('\n');

  return headers + rows;
}

// ============================================================================
// OPTIMIZATION PLAN
// ============================================================================

export function generateOptimizationPlan(
  analysisResults: Map<string, BundleAnalysis>,
  formatBytes: (bytes: number) => string
): void {
  console.debug('\n📋 OPTIMIZATION PLAN GENERATION');
  console.debug('=================================');

  const allRecommendations: OptimizationRecommendation[] = [];

  for (const [, analysis] of analysisResults.entries()) {
    allRecommendations.push(...analysis.recommendations);
  }

  const sortedRecommendations = allRecommendations.sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.estimatedSavings - a.estimatedSavings;
  });

  generateImplementationPlan(sortedRecommendations, formatBytes);

  const totalSavings = sortedRecommendations.reduce((sum, rec) => sum + rec.estimatedSavings, 0);
  console.debug(`💰 Total Potential Savings: ${formatBytes(totalSavings)}`);
}

function generateImplementationPlan(
  recommendations: OptimizationRecommendation[],
  formatBytes: (bytes: number) => string
): void {
  console.debug('\n🎯 IMPLEMENTATION PLAN');
  console.debug('======================');

  const phases = {
    immediate: recommendations.filter(r => r.priority === 'critical' && r.effort === 'low'),
    shortTerm: recommendations.filter(r => r.priority === 'high' || (r.priority === 'critical' && r.effort === 'medium')),
    mediumTerm: recommendations.filter(r => r.priority === 'medium'),
    longTerm: recommendations.filter(r => r.priority === 'low' || r.effort === 'high'),
  };

  Object.entries(phases).forEach(([phase, recs]) => {
    if (recs.length > 0) {
      console.debug(`\n📅 ${phase.toUpperCase()} (${recs.length} tasks):`);
      recs.forEach((rec, index) => {
        const savings = formatBytes(rec.estimatedSavings);
        console.debug(`  ${index + 1}. ${rec.description} - Saves ${savings}`);
      });
    }
  });
}
