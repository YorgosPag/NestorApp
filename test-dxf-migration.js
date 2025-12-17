/**
 * Simple DXF Migration Test Script
 * Calls the API endpoint directly to test migration
 */

const https = require('http');

async function testMigration() {
  console.log('🧪 Testing DXF Migration API...');

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/migrate-dxf',
    method: 'GET',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('✅ Response received:');
          console.log(JSON.stringify(parsed, null, 2));
          resolve(parsed);
        } catch (error) {
          console.log('📄 Raw response:');
          console.log(data);
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.error('❌ Request timed out');
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.end();
  });
}

// Run the test
testMigration()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });