// Simplified customer analysis using the existing APIs
const { spawn } = require('child_process');

async function makeAPICall(url) {
  return new Promise((resolve, reject) => {
    const curl = spawn('curl', ['-s', url], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    let data = '';
    let error = '';

    curl.stdout.on('data', (chunk) => {
      data += chunk.toString();
    });

    curl.stderr.on('data', (chunk) => {
      error += chunk.toString();
    });

    curl.on('close', (code) => {
      if (code === 0) {
        try {
          if (data.startsWith('missing required error') || data.includes('<script>')) {
            reject(new Error('Server not ready - HTML response received'));
            return;
          }
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          console.log('Raw response:', data.substring(0, 500) + (data.length > 500 ? '...' : ''));
          reject(new Error('Failed to parse JSON: ' + e.message));
        }
      } else {
        reject(new Error(`curl failed with code ${code}: ${error}`));
      }
    });
  });
}

async function analyzeCustomerConnections() {
  console.log('🔍 Αναλύω συνδέσεις πελατών με πωληθέντα/δεσμευμένα ακίνητα...\n');

  try {
    // 1. Πάρε τη δομή του έργου
    console.log('📊 Φόρτωση δομής έργου...');
    const structureResponse = await makeAPICall('http://localhost:3001/api/projects/structure/1001');

    if (!structureResponse.success) {
      console.error('❌ Αποτυχία φόρτωσης δομής:', structureResponse.error);
      return;
    }

    const { structure, summary } = structureResponse;
    console.log(`✅ Δομή φορτώθηκε: ${summary.buildingsCount} κτίρια, ${summary.totalUnits} μονάδες\n`);

    // 2. Ανάλυση units ανά status
    const allUnits = [];
    structure.buildings.forEach(building => {
      if (building.units) {
        allUnits.push(...building.units.map(unit => ({
          ...unit,
          buildingId: building.id,
          buildingName: building.name || building.id
        })));
      }
    });

    console.log('📋 ΑΝΑΛΥΣΗ STATUS UNITS:');
    console.log('==========================================');

    const statusCounts = {};
    allUnits.forEach(unit => {
      const status = unit.status || 'undefined';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    Object.entries(statusCounts).forEach(([status, count]) => {
      const percentage = ((count / allUnits.length) * 100).toFixed(1);
      console.log(`   ${getStatusEmoji(status)} ${status}: ${count} μονάδες (${percentage}%)`);
    });

    console.log('');

    // 3. Ανάλυση units με πελάτες
    const unitsWithCustomers = allUnits.filter(unit => unit.soldTo);
    console.log(`👥 ΜΟΝΑΔΕΣ ΜΕ ΠΕΛΑΤΕΣ: ${unitsWithCustomers.length} από ${allUnits.length} συνολικά\n`);

    if (unitsWithCustomers.length > 0) {
      // Κατανομή πελατών ανά status
      const customersByStatus = {};
      unitsWithCustomers.forEach(unit => {
        const status = unit.status || 'undefined';
        if (!customersByStatus[status]) {
          customersByStatus[status] = {
            units: [],
            customerIds: new Set()
          };
        }
        customersByStatus[status].units.push(unit);
        customersByStatus[status].customerIds.add(unit.soldTo);
      });

      console.log('📊 ΚΑΤΑΝΟΜΗ ΠΕΛΑΤΩΝ ΑΝΑ STATUS:');
      console.log('==========================================');
      Object.entries(customersByStatus).forEach(([status, data]) => {
        console.log(`   ${getStatusEmoji(status)} ${status}:`);
        console.log(`      🏠 Μονάδες: ${data.units.length}`);
        console.log(`      👤 Μοναδικοί πελάτες: ${data.customerIds.size}`);
        console.log('');
      });

      // 4. Λίστα μοναδικών customer IDs
      const uniqueCustomerIds = [...new Set(unitsWithCustomers.map(unit => unit.soldTo))];
      console.log(`🎯 ΜΟΝΑΔΙΚΟΙ ΠΕΛΑΤΕΣ: ${uniqueCustomerIds.length}`);
      console.log('==========================================');
      uniqueCustomerIds.forEach(customerId => {
        const customerUnits = unitsWithCustomers.filter(unit => unit.soldTo === customerId);
        const statuses = [...new Set(customerUnits.map(unit => unit.status))];
        console.log(`   👤 Customer ID: ${customerId}`);
        console.log(`      🏠 Μονάδες: ${customerUnits.length} (${statuses.join(', ')})`);

        // Λεπτομέρειες μονάδων
        customerUnits.forEach(unit => {
          console.log(`         - ${unit.id} (${unit.status}) στο κτίριο ${unit.buildingName}`);
        });
        console.log('');
      });

      // 5. Προσπάθησε να πάρεις πληροφορίες πελατών από το customers API
      try {
        console.log('🔗 Έλεγχος συνδέσεων με contacts database...');
        const customersResponse = await makeAPICall('http://localhost:3001/api/projects/1001/customers');

        if (customersResponse.success && customersResponse.customers) {
          const validCustomers = customersResponse.customers;
          console.log(`✅ ΕΓΚΥΡΕΣ ΣΥΝΔΕΣΕΙΣ: ${validCustomers.length} από ${uniqueCustomerIds.length} πελάτες\n`);

          if (validCustomers.length > 0) {
            console.log('📇 ΛΕΠΤΟΜΕΡΕΙΕΣ ΕΓΚΥΡΩΝ ΠΕΛΑΤΩΝ:');
            console.log('==========================================');
            validCustomers.forEach(customer => {
              console.log(`   👤 ${customer.name}`);
              console.log(`      🆔 ID: ${customer.contactId}`);
              console.log(`      📧 Email: ${customer.phone || 'Μη διαθέσιμο'}`);
              console.log(`      📞 Τηλέφωνο: ${customer.phone || 'Μη διαθέσιμο'}`);
              console.log(`      🏠 Μονάδες: ${customer.unitsCount}`);
              console.log('');
            });
          }

          // Βρες τους πελάτες που δεν βρέθηκαν
          const foundCustomerIds = validCustomers.map(c => c.contactId);
          const missingCustomerIds = uniqueCustomerIds.filter(id => !foundCustomerIds.includes(id));

          if (missingCustomerIds.length > 0) {
            console.log(`❌ ΠΡΟΒΛΗΜΑΤΙΚΕΣ ΣΥΝΔΕΣΕΙΣ: ${missingCustomerIds.length} πελάτες`);
            console.log('==========================================');
            missingCustomerIds.forEach(customerId => {
              const customerUnits = unitsWithCustomers.filter(unit => unit.soldTo === customerId);
              console.log(`   🚫 Customer ID: ${customerId}`);
              console.log(`      🏠 Μονάδες: ${customerUnits.length}`);
              console.log(`      📍 Μονάδες: ${customerUnits.map(u => u.id).join(', ')}`);
              console.log('');
            });
          }
        } else {
          console.log('⚠️ Δεν ήταν δυνατόν να ελεγχθούν οι συνδέσεις με το contacts database');
        }
      } catch (error) {
        console.log(`⚠️ Σφάλμα κατά τον έλεγχο customers API: ${error.message}`);
      }

    } else {
      console.log('⚠️ Δεν βρέθηκαν μονάδες με πελάτες (soldTo field)');
    }

    // 6. Συνολικά στατιστικά
    console.log('\n📈 ΣΥΝΟΛΙΚΑ ΣΤΑΤΙΣΤΙΚΑ:');
    console.log('==========================================');
    console.log(`🏠 Σύνολο μονάδων: ${allUnits.length}`);
    console.log(`💰 Πωληθέντες: ${statusCounts.sold || 0}`);
    console.log(`🟡 Δεσμευμένες: ${statusCounts.reserved || 0}`);
    console.log(`⚪ Διαθέσιμες: ${statusCounts.available || 0}`);
    console.log(`👥 Μονάδες με πελάτες: ${unitsWithCustomers.length}`);

    if (unitsWithCustomers.length > 0) {
      const uniqueCustomers = [...new Set(unitsWithCustomers.map(unit => unit.soldTo))].length;
      console.log(`🎯 Μοναδικοί πελάτες: ${uniqueCustomers}`);
    }

  } catch (error) {
    console.error('❌ Σφάλμα κατά την ανάλυση:', error.message);
  }
}

function getStatusEmoji(status) {
  const statusEmojis = {
    'sold': '💰',
    'reserved': '🟡',
    'available': '⚪',
    'under_construction': '🔨',
    'pending': '⏳',
    'undefined': '❓'
  };
  return statusEmojis[status] || '🔴';
}

// Τρέξε την ανάλυση
analyzeCustomerConnections()
  .then(() => {
    console.log('\n✅ Ανάλυση ολοκληρώθηκε!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Σφάλμα:', error);
    process.exit(1);
  });