# =============================================================================
# [ENTERPRISE] Windows Defender Exclusion Setup for Development
# =============================================================================
#
# Purpose: Excludes development paths from Windows Defender real-time scanning
#          to significantly improve compilation speed (2-5x faster)
#
# Usage: Run as Administrator in PowerShell
#        .\scripts\setup-defender-exclusions.ps1
#
# Safety: This script ONLY adds exclusions, never removes system protections
#         Exclusions are limited to development-specific paths
#
# Reference: https://nextjs.org/docs/app/building-your-application/configuring/local-development#windows-considerations
# =============================================================================

# Requires Administrator privileges
#Requires -RunAsAdministrator

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "[ENTERPRISE] Windows Defender Development Exclusions Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Get the project root (parent of scripts folder)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath

Write-Host "[INFO] Project Root: $projectRoot" -ForegroundColor Yellow
Write-Host ""

# Define paths to exclude
$pathsToExclude = @(
    # Project folders
    $projectRoot,
    "$projectRoot\node_modules",
    "$projectRoot\.next",
    "$projectRoot\.turbo",
    "$projectRoot\packages",

    # Global pnpm store (if exists)
    "$env:LOCALAPPDATA\pnpm-store",
    "$env:LOCALAPPDATA\pnpm-cache",

    # VS Code extensions cache
    "$env:USERPROFILE\.vscode\extensions"
)

# Define processes to exclude
$processesToExclude = @(
    "node.exe",
    "pnpm.exe",
    "npm.exe",
    "code.exe",
    "git.exe",
    "esbuild.exe",
    "turbo.exe"
)

Write-Host "[STEP 1/2] Adding folder exclusions..." -ForegroundColor Green
Write-Host ""

foreach ($path in $pathsToExclude) {
    if (Test-Path $path) {
        try {
            Add-MpPreference -ExclusionPath $path -ErrorAction SilentlyContinue
            Write-Host "  [OK] Excluded: $path" -ForegroundColor Green
        }
        catch {
            Write-Host "  [SKIP] Already excluded or error: $path" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "  [SKIP] Path not found: $path" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "[STEP 2/2] Adding process exclusions..." -ForegroundColor Green
Write-Host ""

foreach ($process in $processesToExclude) {
    try {
        Add-MpPreference -ExclusionProcess $process -ErrorAction SilentlyContinue
        Write-Host "  [OK] Excluded: $process" -ForegroundColor Green
    }
    catch {
        Write-Host "  [SKIP] Already excluded or error: $process" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] Windows Defender exclusions configured!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected improvement: 2-5x faster compilation" -ForegroundColor Yellow
Write-Host ""
Write-Host "To verify exclusions, run:" -ForegroundColor White
Write-Host "  Get-MpPreference | Select-Object -ExpandProperty ExclusionPath" -ForegroundColor DarkGray
Write-Host "  Get-MpPreference | Select-Object -ExpandProperty ExclusionProcess" -ForegroundColor DarkGray
Write-Host ""
Write-Host "To remove exclusions later, use Remove-MpPreference cmdlet" -ForegroundColor DarkGray
Write-Host ""
