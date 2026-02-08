/**
 * 🗂️ ENTERPRISE CI ARTIFACTS MANAGEMENT
 * Predictable file paths και comprehensive artifact generation
 * για visual regression testing CI/CD integration
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * 📁 DIRECTORY UTILITIES
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 🏗️ ARTIFACT PATHS STRUCTURE
 * Predictable naming convention για CI artifacts
 */
export interface ArtifactPaths {
  baseline: string;
  actual: string;
  diff: string;
  report: string;
  directory: string;
}

export function getArtifactPaths(
  testName: string,
  options?: {
    baseDir?: string;
    timestamp?: boolean;
  }
): ArtifactPaths {
  const { baseDir = 'reports/visual', timestamp = false } = options || {};

  const sanitizedName = testName.replace(/[^a-zA-Z0-9\-_]/g, '-');
  const timestampSuffix = timestamp ? `-${Date.now()}` : '';
  const baseName = `${sanitizedName}${timestampSuffix}`;

  const directory = path.join(process.cwd(), baseDir);
  ensureDir(directory);

  return {
    directory,
    baseline: path.join(directory, `${baseName}.baseline.png`),
    actual: path.join(directory, `${baseName}.actual.png`),
    diff: path.join(directory, `${baseName}.diff.png`),
    report: path.join(directory, `${baseName}.report.json`)
  };
}

/**
 * 💾 COMPREHENSIVE ARTIFACT WRITING
 * Saves baseline, actual, diff images και detailed report
 */
export interface VisualTestResult {
  testName: string;
  passed: boolean;
  mismatchedPixels: number;
  totalPixels: number;
  mismatchRate: number;
  threshold: number;
  dimensions: { width: number; height: number };
  timestamp: string;
  duration: number;
  artifacts: ArtifactPaths;
  metadata?: Record<string, unknown>;
}

export function writeArtifacts(
  testName: string,
  actualBuffer: Buffer,
  baselineBuffer: Buffer,
  diffBuffer: Buffer,
  result: Omit<VisualTestResult, 'artifacts'>
): ArtifactPaths {
  const artifacts = getArtifactPaths(testName);

  try {
    // Write image artifacts
    fs.writeFileSync(artifacts.actual, actualBuffer);
    fs.writeFileSync(artifacts.baseline, baselineBuffer);
    fs.writeFileSync(artifacts.diff, diffBuffer);

    // Write detailed JSON report
    const report: VisualTestResult = {
      ...result,
      artifacts
    };

    fs.writeFileSync(artifacts.report, JSON.stringify(report, null, 2));

    console.log(`📊 Artifacts saved for ${testName}:`);
    console.log(`  📸 Baseline: ${path.relative(process.cwd(), artifacts.baseline)}`);
    console.log(`  📸 Actual: ${path.relative(process.cwd(), artifacts.actual)}`);
    console.log(`  📸 Diff: ${path.relative(process.cwd(), artifacts.diff)}`);
    console.log(`  📄 Report: ${path.relative(process.cwd(), artifacts.report)}`);

    return artifacts;
  } catch (error) {
    console.error(`❌ Failed to write artifacts for ${testName}:`, error);
    throw error;
  }
}

/**
 * 📊 BASELINE MANAGEMENT
 */
export function getBaselinePath(testName: string, baselineDir?: string): string {
  const dir = baselineDir || path.join(process.cwd(), 'test', 'baselines');
  ensureDir(dir);

  const sanitizedName = testName.replace(/[^a-zA-Z0-9\-_]/g, '-');
  return path.join(dir, `${sanitizedName}.png`);
}

export function hasBaseline(testName: string, baselineDir?: string): boolean {
  const baselinePath = getBaselinePath(testName, baselineDir);
  return fs.existsSync(baselinePath);
}

export function createBaseline(
  testName: string,
  imageBuffer: Buffer,
  baselineDir?: string
): string {
  const baselinePath = getBaselinePath(testName, baselineDir);

  fs.writeFileSync(baselinePath, imageBuffer);

  console.log(`📸 Created baseline: ${path.relative(process.cwd(), baselinePath)}`);
  return baselinePath;
}

export function loadBaseline(testName: string, baselineDir?: string): Buffer {
  const baselinePath = getBaselinePath(testName, baselineDir);

  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Baseline not found: ${baselinePath}`);
  }

  return fs.readFileSync(baselinePath);
}

/**
 * 📈 COMPREHENSIVE TEST SUITE REPORTING
 */
export interface TestSuiteReport {
  timestamp: string;
  duration: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: VisualTestResult[];
  summary: {
    avgMismatchRate: number;
    maxMismatchRate: number;
    totalArtifacts: number;
    artifactSize: number; // in bytes
  };
}

export function generateSuiteReport(
  results: VisualTestResult[],
  startTime: number
): TestSuiteReport {
  const timestamp = new Date().toISOString();
  const duration = Date.now() - startTime;

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = 0; // Could be extended

  const mismatchRates = results.map(r => r.mismatchRate);
  const avgMismatchRate = mismatchRates.length > 0
    ? mismatchRates.reduce((a, b) => a + b, 0) / mismatchRates.length
    : 0;
  const maxMismatchRate = mismatchRates.length > 0
    ? Math.max(...mismatchRates)
    : 0;

  // Calculate total artifact size
  let totalArtifactSize = 0;
  results.forEach(result => {
    try {
      if (fs.existsSync(result.artifacts.actual)) {
        totalArtifactSize += fs.statSync(result.artifacts.actual).size;
      }
      if (fs.existsSync(result.artifacts.baseline)) {
        totalArtifactSize += fs.statSync(result.artifacts.baseline).size;
      }
      if (fs.existsSync(result.artifacts.diff)) {
        totalArtifactSize += fs.statSync(result.artifacts.diff).size;
      }
    } catch (error) {
      // Ignore file stat errors
    }
  });

  const report: TestSuiteReport = {
    timestamp,
    duration,
    total: results.length,
    passed,
    failed,
    skipped,
    results,
    summary: {
      avgMismatchRate,
      maxMismatchRate,
      totalArtifacts: results.length * 3, // baseline + actual + diff
      artifactSize: totalArtifactSize
    }
  };

  // Write suite report
  const reportPath = path.join(process.cwd(), 'reports', 'visual', 'test-suite-report.json');
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`📊 Test Suite Report:`);
  console.log(`  ✅ Passed: ${passed}/${results.length}`);
  console.log(`  ❌ Failed: ${failed}/${results.length}`);
  console.log(`  📏 Avg Mismatch: ${(avgMismatchRate * 100).toFixed(4)}%`);
  console.log(`  📏 Max Mismatch: ${(maxMismatchRate * 100).toFixed(4)}%`);
  console.log(`  💾 Artifacts Size: ${(totalArtifactSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  📄 Full Report: ${path.relative(process.cwd(), reportPath)}`);

  return report;
}

/**
 * 🧹 CLEANUP UTILITIES
 */
export function cleanupArtifacts(
  testName?: string,
  options?: {
    keepBaselines?: boolean;
    keepReports?: boolean;
    olderThan?: number; // timestamp
  }
): void {
  const { keepBaselines = true, keepReports = false, olderThan } = options || {};

  const artifactsDir = path.join(process.cwd(), 'reports', 'visual');

  if (!fs.existsSync(artifactsDir)) return;

  const files = fs.readdirSync(artifactsDir);

  files.forEach(file => {
    const filePath = path.join(artifactsDir, file);
    const stat = fs.statSync(filePath);

    // Skip if not matching testName filter
    if (testName && !file.includes(testName)) return;

    // Skip if newer than threshold
    if (olderThan && stat.mtime.getTime() > olderThan) return;

    // Apply cleanup rules
    const shouldDelete = (
      (file.endsWith('.actual.png')) ||
      (file.endsWith('.diff.png')) ||
      (!keepBaselines && file.endsWith('.baseline.png')) ||
      (!keepReports && (file.endsWith('.report.json') || file === 'test-suite-report.json'))
    );

    if (shouldDelete) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Cleaned up: ${file}`);
    }
  });
}

/**
 * 📋 CI/CD INTEGRATION HELPERS
 */
export function getCIArtifactPaths(): string[] {
  const artifactsDir = path.join(process.cwd(), 'reports', 'visual');

  if (!fs.existsSync(artifactsDir)) return [];

  const files = fs.readdirSync(artifactsDir);

  return files
    .filter(file =>
      file.endsWith('.png') ||
      file.endsWith('.json')
    )
    .map(file => path.join(artifactsDir, file));
}

export function createCIArtifactManifest(): void {
  const artifacts = getCIArtifactPaths();
  const manifest = {
    timestamp: new Date().toISOString(),
    totalFiles: artifacts.length,
    artifacts: artifacts.map(filePath => ({
      path: path.relative(process.cwd(), filePath),
      size: fs.statSync(filePath).size,
      type: path.extname(filePath).slice(1)
    }))
  };

  const manifestPath = path.join(process.cwd(), 'reports', 'visual', 'ci-artifacts-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`📋 CI Artifact Manifest created: ${artifacts.length} files`);
}
