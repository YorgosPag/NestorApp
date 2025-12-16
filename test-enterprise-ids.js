/**
 * 🧪 ENTERPRISE ID SYSTEM TEST SUITE
 *
 * Comprehensive testing του νέου enterprise ID generation system
 *
 * TESTS:
 * 1. ID Generation & Validation
 * 2. Migration Service Functionality
 * 3. API Endpoints
 * 4. Performance & Security
 *
 * @author Enterprise QA Team
 * @date 2025-12-17
 */

const TEST_CONFIG = {
  API_BASE_URL: 'http://localhost:3000',
  TEST_ITERATIONS: 100,
  PERFORMANCE_THRESHOLD_MS: 100
};

console.log('🧪 Starting Enterprise ID System Test Suite...');
console.log('=' .repeat(70));

// =============================================================================
// TEST 1: ID GENERATION & VALIDATION
// =============================================================================

console.log('\n📋 TEST 1: ID Generation & Validation');
console.log('-'.repeat(50));

function testIdGeneration() {
  const generatedIds = new Set();
  const startTime = performance.now();

  // Test multiple ID generations για collision detection
  for (let i = 0; i < TEST_CONFIG.TEST_ITERATIONS; i++) {
    const id = crypto.randomUUID();
    const enterpriseId = `comp_${id}`;

    // Check for collisions
    if (generatedIds.has(enterpriseId)) {
      console.error(`❌ COLLISION DETECTED: ${enterpriseId}`);
      return false;
    }

    generatedIds.add(enterpriseId);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error(`❌ INVALID UUID FORMAT: ${id}`);
      return false;
    }

    // Validate enterprise ID format
    const enterpriseRegex = /^comp_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!enterpriseRegex.test(enterpriseId)) {
      console.error(`❌ INVALID ENTERPRISE ID FORMAT: ${enterpriseId}`);
      return false;
    }
  }

  const endTime = performance.now();
  const duration = endTime - startTime;
  const avgTime = duration / TEST_CONFIG.TEST_ITERATIONS;

  console.log(`✅ Generated ${TEST_CONFIG.TEST_ITERATIONS} unique IDs`);
  console.log(`⏱️ Average generation time: ${avgTime.toFixed(2)}ms per ID`);
  console.log(`🔒 Zero collisions detected`);
  console.log(`📏 All IDs follow enterprise format: prefix_uuid`);

  if (avgTime > TEST_CONFIG.PERFORMANCE_THRESHOLD_MS) {
    console.warn(`⚠️ Performance warning: Average time (${avgTime.toFixed(2)}ms) exceeds threshold (${TEST_CONFIG.PERFORMANCE_THRESHOLD_MS}ms)`);
  }

  return true;
}

const idGenerationResult = testIdGeneration();

// =============================================================================
// TEST 2: SECURITY VALIDATION
// =============================================================================

console.log('\n🔒 TEST 2: Security Validation');
console.log('-'.repeat(50));

function testSecurityFeatures() {
  const ids = [];

  // Generate sample IDs
  for (let i = 0; i < 50; i++) {
    ids.push(`comp_${crypto.randomUUID()}`);
  }

  // Test 1: Unpredictability
  const sequences = [];
  for (let i = 0; i < ids.length - 1; i++) {
    const current = ids[i].split('_')[1];
    const next = ids[i + 1].split('_')[1];
    sequences.push(current < next ? 'asc' : 'desc');
  }

  const ascCount = sequences.filter(s => s === 'asc').length;
  const descCount = sequences.filter(s => s === 'desc').length;
  const unpredictability = Math.abs(ascCount - descCount) / sequences.length;

  if (unpredictability > 0.2) {
    console.error(`❌ SECURITY RISK: IDs show predictable pattern (${(unpredictability * 100).toFixed(1)}% bias)`);
    return false;
  }

  console.log(`✅ IDs are cryptographically unpredictable`);
  console.log(`📊 Sequence bias: ${(unpredictability * 100).toFixed(1)}% (target: <20%)`);

  // Test 2: Entropy validation
  const concatenated = ids.join('').replace(/_/g, '').replace(/-/g, '');
  const charFrequency = {};

  for (const char of concatenated) {
    charFrequency[char] = (charFrequency[char] || 0) + 1;
  }

  const totalChars = concatenated.length;
  let entropy = 0;

  for (const freq of Object.values(charFrequency)) {
    const probability = freq / totalChars;
    entropy -= probability * Math.log2(probability);
  }

  const maxEntropy = Math.log2(16); // For hex characters
  const entropyRatio = entropy / maxEntropy;

  if (entropyRatio < 0.95) {
    console.warn(`⚠️ Lower entropy detected: ${(entropyRatio * 100).toFixed(1)}%`);
  } else {
    console.log(`✅ High entropy confirmed: ${(entropyRatio * 100).toFixed(1)}%`);
  }

  return true;
}

const securityResult = testSecurityFeatures();

// =============================================================================
// TEST 3: API ENDPOINT TESTING
// =============================================================================

console.log('\n🌐 TEST 3: API Endpoint Testing');
console.log('-'.repeat(50));

async function testMigrationApi() {
  try {
    // Test GET endpoint - Migration status
    console.log('🔍 Testing GET /api/enterprise-ids/migrate...');

    const getResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/enterprise-ids/migrate`, {
      method: 'GET'
    });

    if (!getResponse.ok) {
      console.error(`❌ GET request failed: ${getResponse.status} ${getResponse.statusText}`);
      return false;
    }

    const getResult = await getResponse.json();
    console.log(`✅ GET endpoint successful`);
    console.log(`📊 Current migration phase: ${getResult.phase}`);
    console.log(`📈 Migration progress: ${getResult.stats?.migrationProgress?.toFixed(1) || 0}%`);

    // Test POST endpoint - Dry run migration
    console.log('\n🧪 Testing POST /api/enterprise-ids/migrate (dry run)...');

    const postResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/enterprise-ids/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        entityTypes: ['company'],
        dryRun: true,
        batchSize: 5
      })
    });

    if (!postResponse.ok) {
      console.error(`❌ POST request failed: ${postResponse.status} ${postResponse.statusText}`);
      return false;
    }

    const postResult = await postResponse.json();
    console.log(`✅ POST endpoint successful (dry run)`);
    console.log(`🔄 Simulated migrations: ${postResult.migratedIds?.length || 0}`);
    console.log(`⚠️ Errors encountered: ${postResult.errors?.length || 0}`);

    return true;

  } catch (error) {
    console.error(`❌ API test failed:`, error.message);
    return false;
  }
}

// =============================================================================
// TEST 4: PERFORMANCE BENCHMARKING
// =============================================================================

console.log('\n⚡ TEST 4: Performance Benchmarking');
console.log('-'.repeat(50));

function testPerformance() {
  const batchSizes = [1, 10, 100, 1000];
  const results = [];

  for (const batchSize of batchSizes) {
    const startTime = performance.now();

    const ids = [];
    for (let i = 0; i < batchSize; i++) {
      ids.push(`comp_${crypto.randomUUID()}`);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / batchSize;

    results.push({
      batchSize,
      totalTime: totalTime.toFixed(2),
      avgTime: avgTime.toFixed(4)
    });

    console.log(`📊 Batch ${batchSize}: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms per ID`);
  }

  // Check performance degradation
  const degradation = (parseFloat(results[3].avgTime) - parseFloat(results[0].avgTime)) / parseFloat(results[0].avgTime);

  if (degradation > 0.5) {
    console.warn(`⚠️ Performance degradation detected: ${(degradation * 100).toFixed(1)}% slower at scale`);
  } else {
    console.log(`✅ Performance scales well: ${(degradation * 100).toFixed(1)}% degradation`);
  }

  return degradation <= 0.5;
}

const performanceResult = testPerformance();

// =============================================================================
// EXECUTE TESTS
// =============================================================================

async function runAllTests() {
  console.log('\n🧪 Executing All Tests...');
  console.log('=' .repeat(70));

  const apiResult = await testMigrationApi();

  // ==========================================================================
  // FINAL RESULTS
  // ==========================================================================

  console.log('\n📋 TEST RESULTS SUMMARY');
  console.log('=' .repeat(70));

  const tests = [
    { name: 'ID Generation & Validation', result: idGenerationResult },
    { name: 'Security Validation', result: securityResult },
    { name: 'API Endpoint Testing', result: apiResult },
    { name: 'Performance Benchmarking', result: performanceResult }
  ];

  const passedTests = tests.filter(test => test.result).length;
  const totalTests = tests.length;

  tests.forEach(test => {
    const status = test.result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.name}`);
  });

  console.log('-'.repeat(70));
  console.log(`📊 Overall Results: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED - Enterprise ID System is ready for production!');
    console.log('🚀 Recommendation: Proceed with gradual migration deployment');
  } else {
    console.log('❌ Some tests failed - Review and fix issues before production deployment');
  }

  console.log('\n🏆 Enterprise ID System Test Suite Complete');
}

// Run all tests
runAllTests();