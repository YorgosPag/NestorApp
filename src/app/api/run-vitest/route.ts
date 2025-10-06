/**
 * 🧪 API ENDPOINT: Run Vitest Tests
 *
 * Executes Vitest test suite server-side and returns JSON results
 * Used by TestsModal "Unit Tests" tab
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    console.log('🧪 Starting Vitest test execution...');

    const { testFile } = await request.json().catch(() => ({}));

    // Build command
    const command = testFile
      ? `npx vitest run ${testFile} --reporter=json --config src/subapps/dxf-viewer/vitest.config.enterprise.ts`
      : `npx vitest run --reporter=json --config src/subapps/dxf-viewer/vitest.config.enterprise.ts`;

    console.log(`🎯 Running: ${command}`);

    // Execute with timeout
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 60 second timeout
      cwd: process.cwd()
    });

    // Parse JSON output
    let results;
    try {
      // Vitest JSON reporter outputs to stdout
      results = JSON.parse(stdout);
    } catch (parseError) {
      // Fallback: parse stderr or return raw output
      console.error('❌ Failed to parse Vitest JSON output:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Failed to parse test results',
        rawOutput: stdout,
        rawError: stderr
      }, { status: 500 });
    }

    console.log('✅ Vitest tests completed');

    return NextResponse.json({
      success: results.success || false,
      numTotalTests: results.numTotalTests || 0,
      numPassedTests: results.numPassedTests || 0,
      numFailedTests: results.numFailedTests || 0,
      testResults: results.testResults || [],
      duration: results.duration || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Vitest execution failed:', error);

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
    message: 'Use POST to run Vitest tests',
    usage: {
      method: 'POST',
      body: {
        testFile: 'Optional: specific test file to run (e.g., "coord.prop.test.ts")'
      }
    }
  });
}
