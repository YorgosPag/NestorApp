// Simple API test script to bypass CSS issues
const http = require('http');

const options = {
  hostname: process.env.API_HOSTNAME || 'localhost',
  port: parseInt(process.env.API_PORT || '3000'),
  path: '/api/projects/1001/customers',
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

console.log('🔍 Testing customers API...');

const req = http.request(options, (res) => {
  let data = '';

  console.log(`📊 Status Code: ${res.statusCode}`);
  console.log(`📊 Headers:`, res.headers);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📄 Response:');
    console.log(data);

    try {
      const json = JSON.parse(data);
      console.log('✅ Successfully parsed JSON!');
      console.log('📊 Result:', JSON.stringify(json, null, 2));
    } catch (error) {
      console.log('❌ Failed to parse JSON - this is HTML error page');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
});

req.end();