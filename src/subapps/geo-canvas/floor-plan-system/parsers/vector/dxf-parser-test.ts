/**
 * 🧪 DXF PARSER - IMPORT TEST
 *
 * Simple test to verify dxf-parser import works
 * This file can be deleted after STEP 1.4 is complete.
 */

import DxfParser from 'dxf-parser';

/**
 * Test basic import
 */
export function testDxfParserImport() {
  console.log('✅ dxf-parser imported successfully!');

  // Create parser instance to verify it works
  const parser = new DxfParser();
  console.log('✅ DxfParser instance created:', typeof parser.parseSync === 'function');

  return true;
}

// Call test
testDxfParserImport();
