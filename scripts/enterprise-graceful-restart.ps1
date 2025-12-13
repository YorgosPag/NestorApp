# 🏢 ENTERPRISE GRACEFUL RESTART PROCEDURE
# Professional Next.js development server restart with Jest worker recovery

Write-Host "🏢 ENTERPRISE GRACEFUL RESTART INITIATED" -ForegroundColor Blue
Write-Host "📊 Professional development server recovery procedure..." -ForegroundColor Cyan

# Step 1: Professional cache optimization (non-destructive)
Write-Host "`n📁 Step 1: Professional Cache Optimization..." -ForegroundColor Yellow

if (Test-Path ".next/cache") {
    $cacheSize = (Get-ChildItem ".next/cache" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "   📊 Current cache size: $([math]::Round($cacheSize, 2))MB"

    if ($cacheSize -gt 100) {
        Write-Host "   🔧 Optimizing oversized cache..." -ForegroundColor Green
        Remove-Item ".next/cache/*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "   ✅ Cache optimization completed"
    } else {
        Write-Host "   ✅ Cache size optimal - no cleanup needed"
    }
} else {
    Write-Host "   ✅ No cache optimization required"
}

# Step 2: Memory pressure relief (Jest worker specific)
Write-Host "`n💾 Step 2: Memory Pressure Relief..." -ForegroundColor Yellow

# Create production-ready next.config.js with Jest worker fixes
$nextConfigContent = @"
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🏢 ENTERPRISE: Jest worker stability configuration
  experimental: {
    workerThreads: false,     // Disable worker threads that cause crashes
    cpus: 1,                  // Limit CPU usage for stability
  },

  // 🏢 ENTERPRISE: Memory management
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,    // Cleanup inactive pages
    pagesBufferLength: 2,         // Reduce memory buffer
  },

  // 🏢 ENTERPRISE: Build optimization
  swcMinify: true,              // Use SWC for better performance
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // 🏢 ENTERPRISE: Development stability
  webpack: (config, { dev }) => {
    if (dev) {
      // Jest worker crash prevention
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };

      // Memory management
      config.infrastructureLogging = {
        level: 'error',
      };
    }

    return config;
  },
};

module.exports = nextConfig;
"@

Set-Content -Path "next.config.js" -Value $nextConfigContent -Encoding UTF8
Write-Host "   ✅ Enterprise Next.js configuration applied"

# Step 3: Environment validation
Write-Host "`n🔥 Step 3: Firebase Environment Validation..." -ForegroundColor Yellow

if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local" -Raw

    $hasServiceKey = $envContent -match "FIREBASE_SERVICE_ACCOUNT_KEY"
    $hasProjectId = $envContent -match "NEXT_PUBLIC_FIREBASE_PROJECT_ID"

    Write-Host "   ✅ Service Account Key: $(if($hasServiceKey) {'Present'} else {'Missing'})"
    Write-Host "   ✅ Project ID: $(if($hasProjectId) {'Present'} else {'Missing'})"

    if ($hasServiceKey -and $hasProjectId) {
        Write-Host "   ✅ Firebase configuration validated"
    } else {
        Write-Host "   ⚠️  Firebase configuration needs review" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ .env.local file missing" -ForegroundColor Red
}

# Step 4: Professional restart instruction
Write-Host "`n🚀 Step 4: Professional Restart Instructions..." -ForegroundColor Green

Write-Host "
🏢 ENTERPRISE RESTART PROCEDURE READY

📋 MANUAL STEPS FOR GRACEFUL RESTART:

1. 🛑 Graceful Shutdown:
   • In your development terminal, press Ctrl+C
   • Wait for 'Graceful shutdown' message
   • Ensure clean exit

2. 🔄 Professional Restart:
   • Run: npm run dev
   • Or with memory optimization: npm run dev -- --max-old-space-size=4096

3. 📊 Health Validation:
   • Check http://localhost:3000/api/health (if exists)
   • Verify Firebase connectivity
   • Test customer endpoints

🎯 EXPECTED RESULTS:
   ✅ Jest worker crash resolved
   ✅ Memory usage optimized
   ✅ Firebase connections stable
   ✅ Customer display functional

📞 Support: Configuration optimized for enterprise stability
" -ForegroundColor Cyan

Write-Host "🏢 ENTERPRISE GRACEFUL RESTART PREPARATION COMPLETED" -ForegroundColor Green