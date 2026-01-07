const fs = require('fs');
const https = require('http');

// Fetch buildings from API
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/buildings',
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      const buildings = j.buildings || [];

      // Filter enterprise vs legacy
      const enterprise = buildings.filter(b => {
        const id = String(b.id);
        return id.length >= 20 && !id.startsWith('building_');
      });

      const legacy = buildings.filter(b => {
        const id = String(b.id);
        return id.startsWith('building_');
      });

      console.log('=== ENTERPRISE BUILDING EXAMPLE ===');
      if (enterprise[0]) {
        console.log(JSON.stringify(enterprise[0], null, 2));
      }

      console.log('\n=== LEGACY BUILDING EXAMPLE ===');
      if (legacy[0]) {
        console.log(JSON.stringify(legacy[0], null, 2));
      }

      console.log('\n=== SUMMARY ===');
      console.log('Enterprise count:', enterprise.length);
      console.log('Legacy count:', legacy.length);
      console.log('Legacy IDs:', legacy.map(b => b.id));

    } catch (err) {
      console.error('Parse error:', err);
    }
  });
});

req.on('error', err => console.error('Request error:', err));
req.end();
