/**
 * 🎭 API ENDPOINT: Run Playwright E2E Tests
 *
 * Executes Playwright test suite server-side and returns JSON results
 * Used by TestsModal "E2E Tests" tab
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    console.log('🎭 Starting Playwright test execution...');

    const { testFile, updateSnapshots } = await request.json().catch(() => ({}));

    // Build command
    let command = testFile
      ? `npx playwright test ${testFile} --reporter=json`
      : `npx playwright test --reporter=json`;

    // Add update snapshots flag if requested
    if (updateSnapshots) {
      command += ' --update-snapshots';
    }

    console.log(`🎯 Running: ${command}`);

    // Execute with longer timeout (E2E tests take longer)
    const { stdout, stderr } = await execAsync(command, {
      timeout: 180000, // 3 minute timeout
      cwd: process.cwd()
    });

    // Parse JSON output
    let results;
    try {
      // Playwright JSON reporter outputs to stdout
      results = JSON.parse(stdout);
    } catch (parseError) {
      console.error('❌ Failed to parse Playwright JSON output:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Failed to parse test results',
        rawOutput: stdout,
        rawError: stderr
      }, { status: 500 });
    }

    console.log('✅ Playwright tests completed');

    // Extract summary from Playwright results
    const summary = results.suites?.reduce((acc: any, suite: any) => {
      acc.total += suite.tests?.length || 0;
      acc.passed += suite.tests?.filter((t: any) => t.status === 'passed').length || 0;
      acc.failed += suite.tests?.filter((t: any) => t.status === 'failed').length || 0;
      return acc;
    }, { total: 0, passed: 0, failed: 0 });

    return NextResponse.json({
      success: summary?.failed === 0,
      numTotalTests: summary?.total || 0,
      numPassedTests: summary?.passed || 0,
      numFailedTests: summary?.failed || 0,
      suites: results.suites || [],
      duration: results.duration || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Playwright execution failed:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run Playwright E2E tests',
    usage: {
      method: 'POST',
      body: {
        testFile: 'Optional: specific test file to run (e.g., "visual-cross-browser.spec.ts")',
        updateSnapshots: 'Optional: true to update visual snapshots'
      }
    }
  });
}
