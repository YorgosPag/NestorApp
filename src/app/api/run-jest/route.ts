/**
 * 🧪 API ENDPOINT: Run Jest Tests
 *
 * Executes Jest test suite server-side and returns JSON results
 * Used by TestsModal "Unit Tests" tab
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    console.log('🧪 Starting Jest test execution...');

    const { testFile } = await request.json().catch(() => ({}));

    // Build command
    const command = testFile
      ? `npx jest ${testFile} --json --testPathPattern=dxf-viewer`
      : `npx jest --json --testPathPattern=dxf-viewer`;

    console.log(`🎯 Running: ${command}`);

    // Execute with timeout
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 60 second timeout
      cwd: process.cwd()
    });

    // Parse JSON output
    let results;
    try {
      // Jest --json outputs to stdout
      results = JSON.parse(stdout);
    } catch (parseError) {
      console.error('❌ Failed to parse Jest JSON output:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Failed to parse test results',
        rawOutput: stdout,
        rawError: stderr
      }, { status: 500 });
    }

    console.log('✅ Jest tests completed');

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
    console.error('❌ Jest execution failed:', error);

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
    message: 'Use POST to run Jest tests',
    usage: {
      method: 'POST',
      body: {
        testFile: 'Optional: specific test file to run (e.g., "cursor-crosshair-alignment.test.ts")'
      }
    }
  });
}
