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

// 🏢 ENTERPRISE: Collections configuration (JavaScript version)
const COLLECTIONS = {
  CONTACTS: process.env.NEXT_PUBLIC_CONTACTS_COLLECTION || 'contacts',
  UNITS: process.env.NEXT_PUBLIC_UNITS_COLLECTION || 'units',
  PROJECTS: process.env.NEXT_PUBLIC_PROJECTS_COLLECTION || 'projects',
  BUILDINGS: process.env.NEXT_PUBLIC_BUILDINGS_COLLECTION || 'buildings'
};
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
      const unitsSnapshot = await firebaseServer.getDocs(COLLECTIONS.UNITS);
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
  // VALIDATION PHASE 2: BUILDING REFERENCES
  // ========================================================================

  /**
   * 🏢 Validate building references and project hierarchy
   */
  static async validateBuildingReferences(validationResult) {
    console.log('🏢 Phase 2: Validating Building References\n');

    try {
      // Get all units to extract building references
      const unitsSnapshot = await firebaseServer.getDocs(COLLECTIONS.UNITS);
      const units = unitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Extract unique building IDs
      const buildingIds = [...new Set(units
        .map(unit => unit.buildingId)
        .filter(id => id && id.trim() !== '')
      )];

      console.log(`📋 Found ${buildingIds.length} unique building references\n`);

      // Validate each building reference
      const validBuildings = [];
      const buildingValidationPromises = buildingIds.map(buildingId =>
        this.validateBuildingReference(buildingId, units, validationResult)
      );

      const buildingResults = await Promise.allSettled(buildingValidationPromises);

      buildingResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          validBuildings.push(result.value);
        }
      });

      validationResult.metrics.validBuildings = validBuildings.length;

      console.log(`📊 Building Validation Results:`);
      console.log(`   • Valid buildings: ${validBuildings.length}`);
      console.log(`   • Invalid references: ${buildingIds.length - validBuildings.length}\n`);

    } catch (error) {
      console.error('❌ Building validation failed:', error.message);
      this.addValidationIssue(validationResult, {
        type: 'validation_error',
        severity: 'critical',
        entityId: 'buildings',
        description: `Building validation failed: ${error.message}`,
        affectedEntities: []
      });
    }
  }

  // ========================================================================
  // BUILDING REFERENCE VALIDATOR
  // ========================================================================

  /**
   * 🏢 Validate individual building reference
   */
  static async validateBuildingReference(buildingId, units, validationResult) {
    try {
      const buildingSnapshot = await firebaseServer.getDocs('buildings', [
        { field: '__name__', operator: '==', value: buildingId }
      ]);

      if (buildingSnapshot.docs.length === 0) {
        const affectedUnits = units.filter(u => u.buildingId === buildingId);
        this.addValidationIssue(validationResult, {
          type: 'invalid_building',
          severity: 'critical',
          entityId: buildingId,
          description: `Building ${buildingId} not found`,
          affectedEntities: affectedUnits.map(u => u.id)
        });
        return null;
      }

      const building = { id: buildingSnapshot.docs[0].id, ...buildingSnapshot.docs[0].data() };
      const buildingUnits = units.filter(u => u.buildingId === buildingId);
      const buildingName = building.name || building.title || 'Unnamed Building';

      console.log(`✅ ${buildingName} (${buildingId}) - ${buildingUnits.length} units`);

      return {
        id: buildingId,
        name: buildingName,
        projectId: building.projectId,
        unitsCount: buildingUnits.length,
        address: building.address || null
      };

    } catch (error) {
      this.addValidationIssue(validationResult, {
        type: 'validation_error',
        severity: 'warning',
        entityId: buildingId,
        description: `Building validation error: ${error.message}`,
        affectedEntities: []
      });
      return null;
    }
  }

  // ========================================================================
  // VALIDATION PHASE 3: PROJECT HIERARCHY
  // ========================================================================

  /**
   * 🏗️ Validate project hierarchy and relationships
   */
  static async validateProjectHierarchy(validationResult) {
    console.log('🏗️ Phase 3: Validating Project Hierarchy\n');

    try {
      // Get all buildings to extract project references
      const buildingsSnapshot = await firebaseServer.getDocs('buildings');
      const buildings = buildingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Extract unique project IDs
      const projectIds = [...new Set(buildings
        .map(building => building.projectId)
        .filter(id => id && String(id).trim() !== '')
        .map(id => String(id))
      )];

      console.log(`📋 Found ${projectIds.length} unique project references\n`);

      // Use enterprise ProjectsService for validation
      const validProjects = [];
      const projectValidationPromises = projectIds.map(projectId =>
        this.validateProjectReference(projectId, buildings, validationResult)
      );

      const projectResults = await Promise.allSettled(projectValidationPromises);

      projectResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          validProjects.push(result.value);
        }
      });

      validationResult.metrics.validProjects = validProjects.length;

      console.log(`📊 Project Validation Results:`);
      console.log(`   • Valid projects: ${validProjects.length}`);
      console.log(`   • Invalid references: ${projectIds.length - validProjects.length}\n`);

    } catch (error) {
      console.error('❌ Project validation failed:', error.message);
      this.addValidationIssue(validationResult, {
        type: 'validation_error',
        severity: 'critical',
        entityId: 'projects',
        description: `Project validation failed: ${error.message}`,
        affectedEntities: []
      });
    }
  }

  // ========================================================================
  // PROJECT REFERENCE VALIDATOR
  // ========================================================================

  /**
   * 🏗️ Validate individual project reference
   */
  static async validateProjectReference(projectId, buildings, validationResult) {
    try {
      // Use enterprise ProjectsService
      const project = await ProjectsService.getProject(projectId);

      if (!project) {
        const affectedBuildings = buildings.filter(b => String(b.projectId) === projectId);
        this.addValidationIssue(validationResult, {
          type: 'invalid_project',
          severity: 'critical',
          entityId: projectId,
          description: `Project ${projectId} not found`,
          affectedEntities: affectedBuildings.map(b => b.id)
        });
        return null;
      }

      const projectBuildings = buildings.filter(b => String(b.projectId) === projectId);
      const projectName = project.name || project.title || 'Unnamed Project';

      console.log(`✅ ${projectName} (${projectId}) - ${projectBuildings.length} buildings`);

      return {
        id: projectId,
        name: projectName,
        buildingsCount: projectBuildings.length,
        status: project.status || 'unknown',
        location: project.location || null
      };

    } catch (error) {
      this.addValidationIssue(validationResult, {
        type: 'validation_error',
        severity: 'warning',
        entityId: projectId,
        description: `Project validation error: ${error.message}`,
        affectedEntities: []
      });
      return null;
    }
  }

  // ========================================================================
  // INTEGRITY SCORE CALCULATION
  // ========================================================================

  /**
   * 📊 Calculate overall data integrity score
   */
  static async calculateIntegrityScore(validationResult) {
    const { metrics, issues } = validationResult;

    // Count critical issues that affect integrity
    const criticalIssues = issues.filter(issue => issue.severity === 'critical').length;
    const warningIssues = issues.filter(issue => issue.severity === 'warning').length;

    // Calculate base score from valid entities
    const totalEntities = metrics.totalUnits + metrics.validCustomers + metrics.validBuildings + metrics.validProjects;
    const totalIssues = criticalIssues * 2 + warningIssues; // Weight critical issues more

    // Enterprise-grade scoring algorithm
    let integrityScore = 100;

    // Deduct for missing or invalid references
    if (totalEntities > 0) {
      const issueRatio = totalIssues / totalEntities;
      integrityScore = Math.max(0, 100 - (issueRatio * 50));
    }

    // Additional deductions for specific integrity violations
    if (criticalIssues > 0) {
      integrityScore -= Math.min(30, criticalIssues * 5);
    }

    validationResult.integrityScore = Math.max(0, Math.round(integrityScore));
    validationResult.isValid = validationResult.integrityScore >= 80 && criticalIssues === 0;

    metrics.orphanedRecords = criticalIssues;
  }

  // ========================================================================
  // ENTERPRISE VALIDATION REPORT GENERATOR
  // ========================================================================

  /**
   * 📋 Generate comprehensive validation report
   */
  static generateValidationReport(validationResult) {
    const { metrics, issues, integrityScore, isValid } = validationResult;

    console.log('\n📋 ENTERPRISE VALIDATION REPORT');
    console.log('==================================\n');

    // Executive Summary
    console.log('🎯 Executive Summary:');
    console.log(`   • Overall Status: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`   • Data Integrity Score: ${integrityScore}%`);
    console.log(`   • Total Issues Found: ${issues.length}`);
    console.log(`   • Critical Issues: ${issues.filter(i => i.severity === 'critical').length}`);
    console.log('');

    // Metrics Overview
    console.log('📊 Entity Metrics:');
    console.log(`   • Total Property Units: ${metrics.totalUnits}`);
    console.log(`   • Sold Units: ${metrics.soldUnits} (${metrics.totalUnits > 0 ? ((metrics.soldUnits/metrics.totalUnits)*100).toFixed(1) : 0}%)`);
    console.log(`   • Valid Customers: ${metrics.validCustomers}`);
    console.log(`   • Valid Buildings: ${metrics.validBuildings}`);
    console.log(`   • Valid Projects: ${metrics.validProjects}`);
    console.log(`   • Orphaned Records: ${metrics.orphanedRecords}`);
    console.log('');

    // Issues Breakdown
    if (issues.length > 0) {
      console.log('⚠️  Issues Breakdown:');
      const issuesByType = this.groupIssuesByType(issues);

      Object.entries(issuesByType).forEach(([type, typeIssues]) => {
        console.log(`   • ${type.replace('_', ' ').toUpperCase()}: ${typeIssues.length} issues`);
      });
      console.log('');

      // Critical Issues Detail
      const criticalIssues = issues.filter(issue => issue.severity === 'critical');
      if (criticalIssues.length > 0) {
        console.log('🔴 Critical Issues Requiring Immediate Attention:');
        criticalIssues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue.description}`);
          console.log(`      Entity: ${issue.entityId}`);
          console.log(`      Affected: ${issue.affectedEntities.length} related entities`);
        });
        console.log('');
      }
    }

    // Integrity Assessment
    console.log('🎯 Data Integrity Assessment:');
    if (integrityScore >= 95) {
      console.log('   🟢 EXCELLENT - Enterprise-grade data integrity');
    } else if (integrityScore >= 85) {
      console.log('   🟡 GOOD - Minor issues detected');
    } else if (integrityScore >= 70) {
      console.log('   🟠 FAIR - Moderate integrity issues');
    } else {
      console.log('   🔴 POOR - Significant integrity problems requiring attention');
    }
    console.log('');

    // Recommendations
    this.generateRecommendations(validationResult);
  }

  // ========================================================================
  // ENTERPRISE UTILITY METHODS
  // ========================================================================

  /**
   * 📋 Initialize validation metrics structure
   */
  static initializeMetrics() {
    return {
      totalUnits: 0,
      soldUnits: 0,
      validCustomers: 0,
      validBuildings: 0,
      validProjects: 0,
      orphanedRecords: 0
    };
  }

  /**
   * ⚠️ Add validation issue to results
   */
  static addValidationIssue(validationResult, issue) {
    validationResult.issues.push({
      timestamp: new Date().toISOString(),
      ...issue
    });
  }

  /**
   * 👤 Get professional customer display name
   */
  static getCustomerDisplayName(customer) {
    if (customer.type === 'company') {
      return customer.companyName || customer.name || 'Unnamed Company';
    }

    const firstName = customer.firstName || '';
    const lastName = customer.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'Unnamed Individual';
  }

  /**
   * 💰 Calculate total property value for customer
   */
  static calculateTotalPropertyValue(units) {
    return units.reduce((total, unit) => {
      const value = parseFloat(unit.price || unit.value || 0);
      return total + (isNaN(value) ? 0 : value);
    }, 0);
  }

  /**
   * 📊 Group issues by type for reporting
   */
  static groupIssuesByType(issues) {
    return issues.reduce((groups, issue) => {
      const type = issue.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(issue);
      return groups;
    }, {});
  }

  /**
   * 💡 Generate actionable recommendations
   */
  static generateRecommendations(validationResult) {
    const { issues, integrityScore } = validationResult;

    console.log('💡 Recommendations:');

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      console.log('   1. Address critical data integrity issues immediately');
      console.log('   2. Review customer and building reference integrity');
      console.log('   3. Implement data validation constraints');
    }

    if (integrityScore < 85) {
      console.log('   4. Establish regular data quality monitoring');
      console.log('   5. Implement automated validation workflows');
    }

    console.log('   6. Consider implementing foreign key constraints');
    console.log('   7. Schedule regular data integrity audits');
    console.log('');
  }

}

// ============================================================================
// ENTERPRISE EXECUTION HANDLER
// ============================================================================

/**
 * 🚀 Enterprise validation execution with proper error handling
 */
async function executeValidation() {
  try {
    console.log('🚀 Starting Enterprise Property Validation...\n');

    const validationResult = await PropertyRelationshipValidator.validatePropertyRelationships();

    console.log('\n✅ Validation completed successfully');
    console.log(`📊 Final Integrity Score: ${validationResult.integrityScore}%`);
    console.log(`🎯 System Status: ${validationResult.isValid ? 'HEALTHY' : 'NEEDS ATTENTION'}\n`);

    return validationResult;

  } catch (error) {
    console.error('❌ Enterprise validation failed:', error.message);
    console.error('📋 Stack trace:', error.stack);
    throw error;
  }
}

// ============================================================================
// MODULE EXPORTS & EXECUTION
// ============================================================================

if (require.main === module) {
  executeValidation()
    .then((result) => {
      console.log('🎯 Enterprise validation completed successfully');
      process.exit(result.isValid ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Enterprise validation failed:', error.message);
      process.exit(1);
    });
}

// Export enterprise validator for integration
module.exports = {
  PropertyRelationshipValidator,
  executeValidation
};