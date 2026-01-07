/**
 * Script to check ALL buildings in Firestore (without ordering)
 * to find legacy buildings that might be hidden
 */

const https = require('http');

// Create a simple API call to get buildings
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/buildings',
  method: 'GET'
};

console.log('Fetching from /api/buildings...\n');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      const buildings = j.buildings || [];

      console.log('=== ALL BUILDINGS FROM API ===');
      buildings.forEach((b, i) => {
        const isLegacy = String(b.id).startsWith('building_');
        const hasProjectId = b.projectId && String(b.projectId).length > 10;
        console.log(`${i+1}. ID: ${b.id}`);
        console.log(`   Name: ${b.name}`);
        console.log(`   ProjectId: ${b.projectId}`);
        console.log(`   Legacy: ${isLegacy ? '⚠️ YES' : '✅ NO'}`);
        console.log(`   Has Enterprise ProjectId: ${hasProjectId ? '✅ YES' : '❌ NO'}`);
        console.log('');
      });

      console.log('=== SUMMARY ===');
      console.log('Total buildings:', buildings.length);

      const legacy = buildings.filter(b => String(b.id).startsWith('building_'));
      const enterprise = buildings.filter(b => !String(b.id).startsWith('building_'));

      console.log('Legacy (building_*) count:', legacy.length);
      console.log('Enterprise count:', enterprise.length);

      if (legacy.length > 0) {
        console.log('\n⚠️ LEGACY BUILDINGS TO MIGRATE:');
        legacy.forEach(b => console.log(`  - ${b.id}: ${b.name}`));
      }

    } catch (err) {
      console.error('Parse error:', err.message);
      console.error('Raw data:', data.substring(0, 500));
    }
  });
});

req.on('error', err => console.error('Request error:', err.message));
req.end();
