// ============================================================================
// 📊 ENTERPRISE BUNDLE ANALYZER - PERFORMANCE MONITORING
// ============================================================================
//
// 🎯 PURPOSE: Analyze Next.js bundle size και identify optimization opportunities
// 🏢 STANDARDS: Web Vitals, Core Performance Metrics, Bundle Size Optimization
// 📱 PLATFORM: Next.js Bundle Analysis με custom reporting
//
// ============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  OUTPUT_DIR: '.next',
  REPORT_FILE: 'bundle-analysis-report.json',
  THRESHOLDS: {
    TOTAL_SIZE_MB: 3, // Maximum total bundle size
    CHUNK_SIZE_KB: 250, // Maximum individual chunk size
    FIRST_LOAD_KB: 200, // Maximum first load JS size
    CSS_SIZE_KB: 50 // Maximum CSS size
  },
  PATHS: {
    BUILD_MANIFEST: '.next/build-manifest.json',
    WEBPACK_STATS: '.next/webpack-stats.json'
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * 📏 Convert bytes to human readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 📊 Get file size in bytes
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * 📁 Get all files in directory recursively
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;

  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// ============================================================================
// BUNDLE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * 📊 Analyze Next.js build output
 */
function analyzeNextBuild() {
  console.log('🔍 Analyzing Next.js build output...');

  const buildDir = path.join(process.cwd(), '.next');

  if (!fs.existsSync(buildDir)) {
    throw new Error('❌ No .next build directory found. Run "npm run build" first.');
  }

  const staticDir = path.join(buildDir, 'static');
  const analysis = {
    timestamp: new Date().toISOString(),
    totalSize: 0,
    chunks: [],
    css: [],
    pages: [],
    warnings: [],
    recommendations: []
  };

  // Analyze JavaScript chunks
  if (fs.existsSync(staticDir)) {
    const allFiles = getAllFiles(staticDir);

    // JavaScript files
    const jsFiles = allFiles.filter(file => file.endsWith('.js'));
    jsFiles.forEach(file => {
      const size = getFileSize(file);
      const relativePath = path.relative(buildDir, file);

      analysis.chunks.push({
        file: relativePath,
        size: size,
        sizeFormatted: formatBytes(size),
        type: 'javascript'
      });

      analysis.totalSize += size;

      // Check chunk size threshold
      if (size > CONFIG.THRESHOLDS.CHUNK_SIZE_KB * 1024) {
        analysis.warnings.push({
          type: 'LARGE_CHUNK',
          file: relativePath,
          size: formatBytes(size),
          threshold: `${CONFIG.THRESHOLDS.CHUNK_SIZE_KB}KB`,
          message: `Chunk exceeds recommended size`
        });
      }
    });

    // CSS files
    const cssFiles = allFiles.filter(file => file.endsWith('.css'));
    cssFiles.forEach(file => {
      const size = getFileSize(file);
      const relativePath = path.relative(buildDir, file);

      analysis.css.push({
        file: relativePath,
        size: size,
        sizeFormatted: formatBytes(size),
        type: 'css'
      });

      analysis.totalSize += size;

      // Check CSS size threshold
      if (size > CONFIG.THRESHOLDS.CSS_SIZE_KB * 1024) {
        analysis.warnings.push({
          type: 'LARGE_CSS',
          file: relativePath,
          size: formatBytes(size),
          threshold: `${CONFIG.THRESHOLDS.CSS_SIZE_KB}KB`,
          message: `CSS file exceeds recommended size`
        });
      }
    });
  }

  // Analyze pages
  const pagesManifest = path.join(buildDir, 'server/pages-manifest.json');
  if (fs.existsSync(pagesManifest)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(pagesManifest, 'utf8'));
      Object.keys(manifest).forEach(page => {
        const pageFile = path.join(buildDir, 'server', manifest[page]);
        if (fs.existsSync(pageFile)) {
          const size = getFileSize(pageFile);
          analysis.pages.push({
            page: page,
            file: manifest[page],
            size: size,
            sizeFormatted: formatBytes(size)
          });
        }
      });
    } catch (error) {
      analysis.warnings.push({
        type: 'MANIFEST_ERROR',
        message: 'Could not parse pages manifest'
      });
    }
  }

  // Generate recommendations
  generateRecommendations(analysis);

  return analysis;
}

/**
 * 💡 Generate performance recommendations
 */
function generateRecommendations(analysis) {
  const totalSizeMB = analysis.totalSize / (1024 * 1024);

  // Total size recommendation
  if (totalSizeMB > CONFIG.THRESHOLDS.TOTAL_SIZE_MB) {
    analysis.recommendations.push({
      type: 'REDUCE_BUNDLE_SIZE',
      priority: 'HIGH',
      message: `Total bundle size (${formatBytes(analysis.totalSize)}) exceeds ${CONFIG.THRESHOLDS.TOTAL_SIZE_MB}MB`,
      actions: [
        'Consider code splitting with dynamic imports',
        'Remove unused dependencies',
        'Optimize images and assets',
        'Enable gzip/brotli compression'
      ]
    });
  }

  // Large chunks recommendation
  const largeChunks = analysis.chunks.filter(chunk =>
    chunk.size > CONFIG.THRESHOLDS.CHUNK_SIZE_KB * 1024
  );

  if (largeChunks.length > 0) {
    analysis.recommendations.push({
      type: 'SPLIT_LARGE_CHUNKS',
      priority: 'MEDIUM',
      message: `${largeChunks.length} chunks exceed ${CONFIG.THRESHOLDS.CHUNK_SIZE_KB}KB`,
      actions: [
        'Implement route-based code splitting',
        'Split vendor dependencies',
        'Use React.lazy() for components',
        'Optimize heavy libraries'
      ]
    });
  }

  // Performance recommendations
  analysis.recommendations.push({
    type: 'GENERAL_OPTIMIZATION',
    priority: 'LOW',
    message: 'General performance optimizations',
    actions: [
      'Enable Next.js Image optimization',
      'Use next/font for font optimization',
      'Implement ISR για static content',
      'Monitor Core Web Vitals'
    ]
  });
}

// ============================================================================
// REPORTING FUNCTIONS
// ============================================================================

/**
 * 📄 Generate detailed report
 */
function generateReport(analysis) {
  console.log('\n📊 BUNDLE ANALYSIS REPORT');
  console.log('═'.repeat(50));

  // Summary
  console.log(`🕐 Analysis Time: ${analysis.timestamp}`);
  console.log(`📦 Total Bundle Size: ${formatBytes(analysis.totalSize)}`);
  console.log(`📁 JavaScript Chunks: ${analysis.chunks.length}`);
  console.log(`🎨 CSS Files: ${analysis.css.length}`);
  console.log(`📄 Pages: ${analysis.pages.length}`);

  // Warnings
  if (analysis.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${analysis.warnings.length})`);
    console.log('─'.repeat(30));
    analysis.warnings.forEach(warning => {
      console.log(`❌ ${warning.type}: ${warning.message}`);
      if (warning.file) {
        console.log(`   File: ${warning.file} (${warning.size})`);
      }
    });
  }

  // Largest files
  console.log('\n📊 LARGEST FILES');
  console.log('─'.repeat(30));
  const allFiles = [...analysis.chunks, ...analysis.css]
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  allFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file.sizeFormatted} - ${file.file}`);
  });

  // Recommendations
  if (analysis.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS');
    console.log('─'.repeat(30));
    analysis.recommendations.forEach(rec => {
      console.log(`\n🎯 ${rec.type} (${rec.priority} PRIORITY)`);
      console.log(`   ${rec.message}`);
      rec.actions.forEach(action => {
        console.log(`   • ${action}`);
      });
    });
  }

  console.log('\n✅ Analysis complete!');
}

/**
 * 💾 Save report to file
 */
function saveReport(analysis) {
  const reportPath = path.join(process.cwd(), CONFIG.REPORT_FILE);

  const report = {
    ...analysis,
    summary: {
      totalSizeFormatted: formatBytes(analysis.totalSize),
      warningsCount: analysis.warnings.length,
      recommendationsCount: analysis.recommendations.length,
      passedThresholds: analysis.warnings.length === 0
    }
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    console.log('🚀 Starting Enterprise Bundle Analysis...\n');

    // Check if build exists
    const buildExists = fs.existsSync('.next');
    if (!buildExists) {
      console.log('📦 No build found. Running production build...');
      execSync('npm run build', { stdio: 'inherit' });
    }

    // Run analysis
    const analysis = analyzeNextBuild();

    // Generate reports
    generateReport(analysis);
    saveReport(analysis);

    // Exit with appropriate code
    const hasErrors = analysis.warnings.some(w =>
      w.type === 'LARGE_CHUNK' || w.type === 'LARGE_CSS'
    );

    if (hasErrors) {
      console.log('\n⚠️  Bundle analysis completed with warnings');
      process.exit(1);
    } else {
      console.log('\n✅ Bundle analysis passed all thresholds');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Bundle analysis failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  analyzeNextBuild,
  formatBytes,
  CONFIG
};