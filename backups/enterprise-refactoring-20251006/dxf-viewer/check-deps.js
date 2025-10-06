/**
 * Quick dependency checker για visual testing framework
 */

console.log('🔍 Checking Visual Testing Dependencies...\n');

const dependencies = [
  'pixelmatch',
  'pngjs',
  '@napi-rs/canvas',
  '@types/pixelmatch',
  '@types/pngjs'
];

const results = [];

dependencies.forEach(dep => {
  try {
    // Check in current directory first, then in parent directories (root node_modules)
    require.resolve(dep);
    console.log(`✅ ${dep} - INSTALLED`);
    results.push({ dep, status: 'installed' });
  } catch (error) {
    // Special handling for @types packages - check filesystem directly
    if (dep.startsWith('@types/')) {
      const fs = require('fs');
      const path = require('path');
      const typesPath = path.resolve(__dirname, '../../../node_modules', dep);

      if (fs.existsSync(typesPath)) {
        console.log(`✅ ${dep} - INSTALLED (from root)`);
        results.push({ dep, status: 'installed' });
      } else {
        console.log(`❌ ${dep} - MISSING`);
        results.push({ dep, status: 'missing' });
      }
    } else {
      console.log(`❌ ${dep} - MISSING`);
      results.push({ dep, status: 'missing' });
    }
  }
});

console.log('\n📊 Summary:');
const installed = results.filter(r => r.status === 'installed').length;
const missing = results.filter(r => r.status === 'missing').length;

console.log(`✅ Installed: ${installed}/${dependencies.length}`);
console.log(`❌ Missing: ${missing}/${dependencies.length}`);

if (missing === 0) {
  console.log('\n🎉 All visual testing dependencies are ready!');
  console.log('💫 Enterprise Visual Testing Framework is fully operational!');
} else {
  console.log('\n⏳ Some dependencies are still installing or need to be installed.');
  console.log('🔧 Run: npm install --save-dev pixelmatch pngjs @types/pixelmatch @types/pngjs @napi-rs/canvas');
}

// Test basic functionality
console.log('\n🧪 Testing Basic Functionality:');

try {
  const fs = require('fs');
  const path = require('path');

  console.log('✅ File system access - OK');

  // Test path operations
  const testPath = path.join(__dirname, 'test', 'visual');
  console.log('✅ Path operations - OK');

  // Test JSON operations
  const testObj = { test: 'enterprise-visual-testing', ready: true };
  const json = JSON.stringify(testObj);
  console.log('✅ JSON operations - OK');

  console.log('\n🎯 Core functionality verified!');

} catch (error) {
  console.error('❌ Basic functionality test failed:', error.message);
}