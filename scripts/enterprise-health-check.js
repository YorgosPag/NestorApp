// 🏢 ENTERPRISE HEALTH CHECK SYSTEM
// Professional diagnostics for Next.js development environment

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class EnterpriseHealthChecker {
  constructor() {
    this.issues = [];
    this.solutions = [];
  }

  async runDiagnostics() {
    console.log('🏢 ENTERPRISE HEALTH CHECK INITIATED');
    console.log('📊 Checking development environment status...\n');

    // 1. Check if .next directory exists and size
    this.checkNextCache();

    // 2. Check Firebase configuration
    this.checkFirebaseConfig();

    // 3. Check memory usage
    await this.checkMemoryUsage();

    // 4. Generate professional recommendations
    this.generateRecommendations();
  }

  checkNextCache() {
    console.log('📁 Checking .next cache directory...');

    if (fs.existsSync('.next')) {
      const stats = this.getDirectorySize('.next');
      console.log(`   ✅ Cache exists: ${stats.files} files, ${(stats.size / 1024 / 1024).toFixed(2)}MB`);

      if (stats.size > 500 * 1024 * 1024) { // 500MB threshold
        this.issues.push('CACHE_OVERSIZED');
        this.solutions.push('Professional cache cleanup required');
      }
    } else {
      console.log('   ⚠️  No .next cache found - fresh build required');
      this.issues.push('CACHE_MISSING');
    }
  }

  checkFirebaseConfig() {
    console.log('🔥 Checking Firebase configuration...');

    try {
      const envPath = '.env.local';
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');

        const hasFirebaseKey = envContent.includes('FIREBASE_SERVICE_ACCOUNT_KEY');
        const hasProjectId = envContent.includes('NEXT_PUBLIC_FIREBASE_PROJECT_ID');

        console.log(`   ✅ Service Account Key: ${hasFirebaseKey ? 'Present' : 'Missing'}`);
        console.log(`   ✅ Project ID: ${hasProjectId ? 'Present' : 'Missing'}`);

        if (!hasFirebaseKey || !hasProjectId) {
          this.issues.push('FIREBASE_CONFIG_INCOMPLETE');
          this.solutions.push('Firebase environment variables require validation');
        }
      } else {
        console.log('   ❌ .env.local not found');
        this.issues.push('ENV_FILE_MISSING');
      }
    } catch (error) {
      console.log(`   ❌ Config check failed: ${error.message}`);
      this.issues.push('CONFIG_CHECK_FAILED');
    }
  }

  async checkMemoryUsage() {
    console.log('💾 Checking system memory usage...');

    return new Promise((resolve) => {
      exec('wmic process where "name=\'node.exe\'" get ProcessId,PageFileUsage', (error, stdout) => {
        if (error) {
          console.log('   ⚠️  Memory check unavailable on this system');
          resolve();
          return;
        }

        const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('PageFileUsage'));
        console.log(`   📊 Found ${lines.length} Node.js processes`);

        let totalMemory = 0;
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const memory = parseInt(parts[0]) || 0;
            totalMemory += memory;
          }
        });

        console.log(`   📈 Total Node.js memory usage: ${(totalMemory / 1024).toFixed(2)}MB`);

        if (totalMemory > 1024 * 1024) { // 1GB threshold
          this.issues.push('HIGH_MEMORY_USAGE');
          this.solutions.push('Memory optimization recommended');
        }

        resolve();
      });
    });
  }

  generateRecommendations() {
    console.log('\n🎯 PROFESSIONAL RECOMMENDATIONS:');

    if (this.issues.length === 0) {
      console.log('   ✅ System appears healthy - investigating Jest worker crash...');
      this.solutions.push('JEST_WORKER_SPECIFIC_INVESTIGATION');
    } else {
      console.log(`   📋 Found ${this.issues.length} areas for optimization:`);
      this.solutions.forEach((solution, index) => {
        console.log(`   ${index + 1}. ${solution}`);
      });
    }

    console.log('\n🏢 ENTERPRISE NEXT STEPS:');
    console.log('   1. Professional cache management');
    console.log('   2. Graceful service restart');
    console.log('   3. Performance monitoring');
    console.log('   4. Production-ready stabilization');
  }

  getDirectorySize(dirPath) {
    let totalSize = 0;
    let totalFiles = 0;

    function calculateSize(currentPath) {
      try {
        const stats = fs.statSync(currentPath);

        if (stats.isDirectory()) {
          const files = fs.readdirSync(currentPath);
          files.forEach(file => {
            calculateSize(path.join(currentPath, file));
          });
        } else {
          totalSize += stats.size;
          totalFiles++;
        }
      } catch (error) {
        // Skip inaccessible files/directories
      }
    }

    calculateSize(dirPath);
    return { size: totalSize, files: totalFiles };
  }
}

// Execute professional health check
const checker = new EnterpriseHealthChecker();
checker.runDiagnostics().catch(console.error);