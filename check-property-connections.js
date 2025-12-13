// ============================================================================
// ENTERPRISE PROPERTY RELATIONSHIP VALIDATOR
// ============================================================================
//
// 🏢 Professional validation service για real estate relationship integrity
// Implements enterprise-grade data validation patterns
//
// Architecture: Service Layer Pattern + Repository Pattern + Validator Pattern
// Integration: Uses existing enterprise services (ContactsService, ProjectsService)
//
// ============================================================================

const { ContactsService } = require('./src/services/contacts.service');
const { ProjectsService } = require('./src/services/projects/services/ProjectsService');
const { firebaseServer } = require('./src/lib/firebase-server');
const { RelationshipCRUDService } = require('./src/services/contact-relationships/core/RelationshipCRUDService');

// ============================================================================
// ENTERPRISE TYPES & INTERFACES
// ============================================================================

/**
 * @typedef {Object} PropertyValidationResult
 * @property {boolean} isValid - Overall validation status
 * @property {ValidationMetrics} metrics - Detailed metrics
 * @property {ValidationIssue[]} issues - Found validation issues
 * @property {number} integrityScore - Data integrity score (0-100)
 */

/**
 * @typedef {Object} ValidationMetrics
 * @property {number} totalUnits - Total property units
 * @property {number} soldUnits - Units with valid sales
 * @property {number} validCustomers - Customers with valid contact records
 * @property {number} validBuildings - Buildings with valid project references
 * @property {number} validProjects - Projects in system
 * @property {number} orphanedRecords - Records with broken references
 */

/**
 * @typedef {Object} ValidationIssue
 * @property {string} type - Issue type: 'missing_customer'|'invalid_building'|'broken_reference'
 * @property {string} severity - Issue severity: 'critical'|'warning'|'info'
 * @property {string} entityId - Affected entity ID
 * @property {string} description - Human-readable issue description
 * @property {string[]} affectedEntities - Other entities affected by this issue
 */

/**
 * @typedef {Object} CustomerPropertySummary
 * @property {string} customerId - Customer contact ID
 * @property {string} customerName - Customer display name
 * @property {string} customerType - Customer type (individual|company)
 * @property {PropertyUnit[]} units - Units owned by customer
 * @property {number} totalValue - Total property value
 * @property {Date} firstPurchase - Date of first property purchase
 */

// ============================================================================
// ENTERPRISE PROPERTY RELATIONSHIP VALIDATOR SERVICE
// ============================================================================

class PropertyRelationshipValidator {

  // ========================================================================
  // ENTERPRISE VALIDATION ORCHESTRATOR
  // ========================================================================

  /**
   * 🏢 Execute comprehensive property relationship validation
   *
   * @returns {Promise<PropertyValidationResult>} Comprehensive validation results
   */
  static async validatePropertyRelationships() {
    console.log('\n🏢 ENTERPRISE PROPERTY VALIDATION');
    console.log('==================================\n');

    try {
      const validationResult = {
        isValid: true,
        metrics: this.initializeMetrics(),
        issues: [],
        integrityScore: 0
      };

      // Execute validation phases
      await this.validateUnitsAndCustomers(validationResult);
      await this.validateBuildingReferences(validationResult);
      await this.validateProjectHierarchy(validationResult);
      await this.calculateIntegrityScore(validationResult);

      // Generate professional report
      this.generateValidationReport(validationResult);

      return validationResult;

    } catch (error) {
      console.error('❌ VALIDATION FAILURE:', error.message);
      throw new Error(`Property validation failed: ${error.message}`);
    }
  }

  // ========================================================================
  // VALIDATION PHASE 1: UNITS & CUSTOMERS
  // ========================================================================

  /**
   * 📊 Validate units and their customer relationships
   */
  static async validateUnitsAndCustomers(validationResult) {
    console.log('📊 Phase 1: Validating Units and Customer Relationships\n');

    try {
      // Fetch all property units using enterprise service
      const unitsSnapshot = await firebaseServer.getDocs('units');
      const units = unitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      validationResult.metrics.totalUnits = units.length;

      // Identify sold units with customer references
      const soldUnits = units.filter(unit =>
        unit.status === 'sold' &&
        unit.soldTo &&
        unit.soldTo.trim() !== '' &&
        unit.soldTo !== 'Not sold'
      );

      validationResult.metrics.soldUnits = soldUnits.length;

      // Group units by customer
      const customerUnitMap = new Map();
      soldUnits.forEach(unit => {
        const customerId = unit.soldTo;
        if (!customerUnitMap.has(customerId)) {
          customerUnitMap.set(customerId, []);
        }
        customerUnitMap.get(customerId).push(unit);
      });

      console.log(`📈 Unit Metrics:`);
      console.log(`   • Total units: ${units.length}`);
      console.log(`   • Sold units: ${soldUnits.length}`);
      console.log(`   • Unique customers: ${customerUnitMap.size}\n`);

      // Validate customer references using enterprise ContactsService
      console.log('👥 Validating customer references...\n');

      const validCustomers = [];
      const customerValidationPromises = [];

      for (const [customerId, units] of customerUnitMap) {
        customerValidationPromises.push(
          this.validateCustomerReference(customerId, units, validationResult)
        );
      }

      const customerResults = await Promise.allSettled(customerValidationPromises);

      customerResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          validCustomers.push(result.value);
        }
      });

      validationResult.metrics.validCustomers = validCustomers.length;

      console.log(`📊 Customer Validation Results:`);
      console.log(`   • Valid customers: ${validCustomers.length}`);
      console.log(`   • Invalid references: ${customerUnitMap.size - validCustomers.length}\n`);

    } catch (error) {
      console.error('❌ Customer validation failed:', error.message);
      this.addValidationIssue(validationResult, {
        type: 'validation_error',
        severity: 'critical',
        entityId: 'customers',
        description: `Customer validation failed: ${error.message}`,
        affectedEntities: []
      });
    }
  }

  // ========================================================================
  // CUSTOMER REFERENCE VALIDATOR
  // ========================================================================

  /**
   * 👤 Validate individual customer reference
   */
  static async validateCustomerReference(customerId, units, validationResult) {
    try {
      const customer = await ContactsService.getContact(customerId);

      if (!customer) {
        this.addValidationIssue(validationResult, {
          type: 'missing_customer',
          severity: 'critical',
          entityId: customerId,
          description: `Customer ${customerId} not found in contacts`,
          affectedEntities: units.map(u => u.id)
        });
        return null;
      }

      const customerName = this.getCustomerDisplayName(customer);
      console.log(`✅ ${customerName} (${customerId}) - ${units.length} properties`);

      return {
        customerId,
        customerName,
        customerType: customer.type || 'individual',
        units,
        totalValue: this.calculateTotalPropertyValue(units)
      };

    } catch (error) {
      this.addValidationIssue(validationResult, {
        type: 'validation_error',
        severity: 'warning',
        entityId: customerId,
        description: `Customer validation error: ${error.message}`,
        affectedEntities: units.map(u => u.id)
      });
      return null;
    }
  }

    // ========================================================================
    // 3. ΕΠΑΛΉΘΕΥΣΗ ΚΤΙΡΊΩΝ
    // ========================================================================

    console.log('🏢 Στάδιο 3: Επαλήθευση κτιρίων...\n');

    // Get all unique building IDs from units
    const buildingIds = [...new Set(units.map(u => u.buildingId).filter(Boolean))];
    const validBuildings = [];
    const invalidBuildingIds = [];

    for (const buildingId of buildingIds) {
      try {
        const buildingDoc = await db.collection('buildings').doc(buildingId).get();

        if (buildingDoc.exists) {
          const building = { id: buildingDoc.id, ...buildingDoc.data() };
          const buildingUnits = units.filter(u => u.buildingId === buildingId);

          validBuildings.push({
            id: buildingId,
            name: building.name || 'Άγνωστο κτίριο',
            projectId: building.projectId,
            unitsCount: buildingUnits.length
          });

          console.log(`✅ ${building.name || buildingId} - ${buildingUnits.length} μονάδες`);
        } else {
          const buildingUnits = units.filter(u => u.buildingId === buildingId);
          invalidBuildingIds.push({
            id: buildingId,
            unitsCount: buildingUnits.length
          });

          console.log(`❌ ΜΗΔΕΝΙΚΟ ΚΤΙΡΙΟ: ${buildingId} - ${buildingUnits.length} μονάδες`);
        }
      } catch (error) {
        console.log(`⚠️  ΣΦΑΛΜΑ ΕΛΕΓΧΟΥ ΚΤΙΡΙΟΥ: ${buildingId} - ${error.message}`);
      }
    }

    console.log(`\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ ΚΤΙΡΙΩΝ:`);
    console.log(`   • Έγκυρα κτίρια: ${validBuildings.length}`);
    console.log(`   • Μη έγκυρα κτίρια: ${invalidBuildingIds.length}\n`);

    // ========================================================================
    // 4. ΕΠΑΛΉΘΕΥΣΗ ΈΡΓΩΝ
    // ========================================================================

    console.log('🏗️ Στάδιο 4: Επαλήθευση έργων...\n');

    // Get all unique project IDs from buildings
    const projectIds = [...new Set(validBuildings.map(b => b.projectId).filter(Boolean))];
    const validProjects = [];
    const invalidProjectIds = [];

    for (const projectId of projectIds) {
      try {
        const projectDoc = await db.collection('projects').doc(projectId.toString()).get();

        if (projectDoc.exists) {
          const project = { id: projectDoc.id, ...projectDoc.data() };
          const projectBuildings = validBuildings.filter(b => b.projectId.toString() === projectId.toString());

          validProjects.push({
            id: projectId,
            name: project.name || 'Άγνωστο έργο',
            buildingsCount: projectBuildings.length
          });

          console.log(`✅ ${project.name || projectId} - ${projectBuildings.length} κτίρια`);
        } else {
          const projectBuildings = validBuildings.filter(b => b.projectId.toString() === projectId.toString());
          invalidProjectIds.push({
            id: projectId,
            buildingsCount: projectBuildings.length
          });

          console.log(`❌ ΜΗΔΕΝΙΚΟ ΕΡΓΟ: ${projectId} - ${projectBuildings.length} κτίρια`);
        }
      } catch (error) {
        console.log(`⚠️  ΣΦΑΛΜΑ ΕΛΕΓΧΟΥ ΕΡΓΟΥ: ${projectId} - ${error.message}`);
      }
    }

    console.log(`\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ ΈΡΓΩΝ:`);
    console.log(`   • Έγκυρα έργα: ${validProjects.length}`);
    console.log(`   • Μη έγκυρα έργα: ${invalidProjectIds.length}\n`);

    // ========================================================================
    // 5. ΤΕΛΙΚΉ ΑΝΑΦΟΡΆ
    // ========================================================================

    console.log('\n📋 ΤΕΛΙΚΉ ΑΝΑΦΟΡΆ');
    console.log('===================\n');

    console.log('🎯 ΣΎΝΟΨΗ ΑΠΟΤΕΛΕΣΜΆΤΩΝ:');
    console.log(`   • Συνολικές μονάδες: ${units.length}`);
    console.log(`   • Πωληθείσες μονάδες: ${soldUnits.length} (${((soldUnits.length/units.length)*100).toFixed(1)}%)`);
    console.log(`   • Πελάτες με ακίνητα: ${validCustomers.length}`);
    console.log(`   • Κτίρια με μονάδες: ${validBuildings.length}`);
    console.log(`   • Έργα με κτίρια: ${validProjects.length}\n`);

    if (invalidCustomers.length > 0) {
      console.log('⚠️  ΠΡΟΒΛΗΜΑΤΙΚΟΙ ΠΕΛΑΤΕΣ:');
      invalidCustomers.forEach(customer => {
        console.log(`   • ${customer.id} - ${customer.unitsCount} μονάδες`);
      });
      console.log();
    }

    if (invalidBuildingIds.length > 0) {
      console.log('⚠️  ΠΡΟΒΛΗΜΑΤΙΚΑ ΚΤΙΡΙΑ:');
      invalidBuildingIds.forEach(building => {
        console.log(`   • ${building.id} - ${building.unitsCount} μονάδες`);
      });
      console.log();
    }

    if (invalidProjectIds.length > 0) {
      console.log('⚠️  ΠΡΟΒΛΗΜΑΤΙΚΑ ΕΡΓΑ:');
      invalidProjectIds.forEach(project => {
        console.log(`   • ${project.id} - ${project.buildingsCount} κτίρια`);
      });
      console.log();
    }

    // ========================================================================
    // 6. DETAILED CUSTOMER ANALYSIS
    // ========================================================================

    if (validCustomers.length > 0) {
      console.log('\n👥 ΛΕΠΤΟΜΕΡΗΣ ΑΝΑΛΥΣΗ ΠΕΛΑΤΩΝ:');
      console.log('================================\n');

      validCustomers.forEach(customer => {
        console.log(`📋 ${customer.name} (${customer.id}):`);
        customer.units.forEach(unit => {
          const building = validBuildings.find(b => b.id === unit.buildingId);
          const project = building ? validProjects.find(p => p.id.toString() === building.projectId.toString()) : null;

          console.log(`   • Μονάδα: ${unit.name || unit.id}`);
          console.log(`     - Κτίριο: ${building ? building.name : `ΜΗΔΕΝΙΚΟ (${unit.buildingId})`}`);
          console.log(`     - Έργο: ${project ? project.name : building ? `ΜΗΔΕΝΙΚΟ (${building.projectId})` : 'N/A'}`);
          console.log(`     - Status: ${unit.status}`);
        });
        console.log();
      });
    }

    // ========================================================================
    // 7. INTEGRITY SCORE
    // ========================================================================

    const totalIssues = invalidCustomers.length + invalidBuildingIds.length + invalidProjectIds.length;
    const totalEntities = customerIds.length + buildingIds.length + projectIds.length;
    const integrityScore = totalEntities > 0 ? ((totalEntities - totalIssues) / totalEntities * 100) : 100;

    console.log('\n🎯 INTEGRITY SCORE');
    console.log('===================');
    console.log(`📊 Data Integrity: ${integrityScore.toFixed(1)}%`);
    console.log(`✅ Έγκυρες συνδέσεις: ${totalEntities - totalIssues}/${totalEntities}`);
    console.log(`❌ Προβληματικές συνδέσεις: ${totalIssues}`);

    if (integrityScore >= 95) {
      console.log('🟢 ΕΞΑΙΡΕΤΙΚΗ εγκυρότητα δεδομένων!');
    } else if (integrityScore >= 80) {
      console.log('🟡 ΚΑΛΗ εγκυρότητα δεδομένων - μικρά προβλήματα');
    } else {
      console.log('🔴 ΠΡΟΒΛΗΜΑΤΙΚΗ εγκυρότητα δεδομένων - χρειάζεται διόρθωση');
    }

    console.log('\n✅ Έλεγχος ολοκληρώθηκε!\n');

  } catch (error) {
    console.error('❌ Σφάλμα κατά τον έλεγχο:', error);
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

if (require.main === module) {
  checkPropertyConnections().then(() => {
    console.log('🎯 Script completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = { checkPropertyConnections };