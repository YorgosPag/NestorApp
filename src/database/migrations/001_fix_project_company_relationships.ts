/**
 * Migration 001: Fix Project-Company Relationships
 *
 * PROBLEM:
 * - Projects have incorrect or empty companyId values
 * - Navigation cannot display projects under companies
 * - Data integrity is compromised
 *
 * SOLUTION:
 * - Map projects to correct company IDs based on company names
 * - Validate data integrity before and after migration
 * - Provide rollback capability
 */

import { Migration, MigrationStep } from './types';
import { collection, query, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

interface ProjectRecord {
  id: string;
  name: string;
  company: string;
  companyId: string;
  [key: string]: unknown;
}

interface CompanyRecord {
  id: string;
  companyName: string;
  type?: string;
  status?: string;
  [key: string]: unknown;
}

interface MigrationData {
  companies: CompanyRecord[];
  projects: ProjectRecord[];
  mappings: Array<{
    projectId: string;
    projectName: string;
    oldCompanyId: string;
    newCompanyId: string;
    companyName: string;
  }>;
}

class ProjectCompanyMigrationSteps {
  private migrationData: MigrationData = {
    companies: [],
    projects: [],
    mappings: []
  };

  /**
   * Step 1: Analyze current data state
   */
  analyzeDataStep(): MigrationStep {
    return {
      stepId: 'analyze_data',
      description: 'Analyze current projects and companies data',
      execute: async () => {
        console.log('📊 Analyzing current data state...');

        // Fetch all companies
        const companiesSnapshot = await getDocs(
          query(collection(db, COLLECTIONS.CONTACTS))
        );

        this.migrationData.companies = companiesSnapshot.docs
          .map(doc => {
            const data = doc.data() as CompanyRecord;
            return {
              id: doc.id,
              ...data
            };
          })
          .filter(contact => contact.type === 'company' && contact.status === 'active') as CompanyRecord[];

        console.log(`   Found ${this.migrationData.companies.length} active companies`);

        // Fetch all projects
        const projectsSnapshot = await getDocs(collection(db, COLLECTIONS.PROJECTS));
        this.migrationData.projects = projectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProjectRecord[];

        console.log(`   Found ${this.migrationData.projects.length} projects`);

        // Analyze mapping requirements
        for (const project of this.migrationData.projects) {
          const matchingCompany = this.migrationData.companies.find(
            company => company.companyName === project.company
          );

          if (matchingCompany && project.companyId !== matchingCompany.id) {
            this.migrationData.mappings.push({
              projectId: project.id,
              projectName: project.name,
              oldCompanyId: project.companyId || '<empty>',
              newCompanyId: matchingCompany.id,
              companyName: matchingCompany.companyName
            });
          }
        }

        console.log(`   Found ${this.migrationData.mappings.length} projects requiring companyId updates`);

        return {
          affectedRecords: this.migrationData.mappings.length,
          analysis: {
            totalCompanies: this.migrationData.companies.length,
            totalProjects: this.migrationData.projects.length,
            projectsNeedingUpdate: this.migrationData.mappings.length
          }
        };
      },
      validate: async () => {
        return this.migrationData.companies.length > 0 && this.migrationData.projects.length > 0;
      }
    };
  }

  /**
   * Step 2: Validate mapping correctness
   */
  validateMappingsStep(): MigrationStep {
    return {
      stepId: 'validate_mappings',
      description: 'Validate project-company mappings for data integrity',
      execute: async () => {
        console.log('🔍 Validating project-company mappings...');

        const validationResults = {
          validMappings: 0,
          invalidMappings: 0,
          warnings: [] as string[]
        };

        for (const mapping of this.migrationData.mappings) {
          // Verify company exists
          const companyExists = this.migrationData.companies.some(
            company => company.id === mapping.newCompanyId
          );

          if (!companyExists) {
            validationResults.invalidMappings++;
            validationResults.warnings.push(
              `Invalid mapping for project ${mapping.projectName}: Company ID ${mapping.newCompanyId} not found`
            );
          } else {
            validationResults.validMappings++;
          }
        }

        console.log(`   ✅ Valid mappings: ${validationResults.validMappings}`);
        console.log(`   ⚠️  Invalid mappings: ${validationResults.invalidMappings}`);

        if (validationResults.warnings.length > 0) {
          console.log('   Warnings:');
          validationResults.warnings.forEach(warning => console.log(`     - ${warning}`));
        }

        if (validationResults.invalidMappings > 0) {
          throw new Error(`Found ${validationResults.invalidMappings} invalid mappings. Migration aborted.`);
        }

        return {
          affectedRecords: validationResults.validMappings,
          data: validationResults
        };
      },
      validate: async () => {
        return this.migrationData.mappings.every(mapping =>
          this.migrationData.companies.some(company => company.id === mapping.newCompanyId)
        );
      }
    };
  }

  /**
   * Step 3: Execute project updates
   */
  updateProjectsStep(): MigrationStep {
    return {
      stepId: 'update_projects',
      description: 'Update project companyId fields with correct values',
      execute: async () => {
        console.log('📝 Updating project companyId fields...');

        const updateResults = {
          successfulUpdates: 0,
          failedUpdates: 0,
          errors: [] as string[]
        };

        for (const mapping of this.migrationData.mappings) {
          try {
            const projectRef = doc(db, COLLECTIONS.PROJECTS, mapping.projectId);

            await updateDoc(projectRef, {
              companyId: mapping.newCompanyId,
              updatedAt: new Date().toISOString(),
              migrationInfo: {
                migrationId: '001_fix_project_company_relationships',
                migratedAt: new Date().toISOString(),
                oldCompanyId: mapping.oldCompanyId,
                newCompanyId: mapping.newCompanyId
              }
            });

            updateResults.successfulUpdates++;
            console.log(`   ✅ Updated ${mapping.projectName}: ${mapping.oldCompanyId} → ${mapping.newCompanyId}`);

          } catch (error) {
            updateResults.failedUpdates++;
            const errorMessage = `Failed to update ${mapping.projectName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            updateResults.errors.push(errorMessage);
            console.error(`   ❌ ${errorMessage}`);
          }
        }

        console.log(`   📊 Summary: ${updateResults.successfulUpdates} successful, ${updateResults.failedUpdates} failed`);

        if (updateResults.failedUpdates > 0) {
          throw new Error(`${updateResults.failedUpdates} project updates failed. See errors above.`);
        }

        return {
          affectedRecords: updateResults.successfulUpdates,
          updateResults
        };
      },
      rollback: async () => {
        console.log('🔄 Rolling back project updates...');

        for (const mapping of this.migrationData.mappings) {
          try {
            const projectRef = doc(db, COLLECTIONS.PROJECTS, mapping.projectId);

            await updateDoc(projectRef, {
              companyId: mapping.oldCompanyId === '<empty>' ? '' : mapping.oldCompanyId,
              updatedAt: new Date().toISOString()
            });

            console.log(`   ↩️ Rolled back ${mapping.projectName}`);
          } catch (error) {
            console.error(`   ❌ Failed to rollback ${mapping.projectName}: ${error}`);
          }
        }
      },
      validate: async () => {
        // Verify all projects have been updated correctly
        for (const mapping of this.migrationData.mappings) {
          const projectDoc = await getDoc(doc(db, COLLECTIONS.PROJECTS, mapping.projectId));
          if (projectDoc.exists()) {
            const projectData = projectDoc.data();
            if (projectData.companyId !== mapping.newCompanyId) {
              return false;
            }
          }
        }
        return true;
      }
    };
  }

  /**
   * Step 4: Verify data integrity post-migration
   */
  verifyIntegrityStep(): MigrationStep {
    return {
      stepId: 'verify_integrity',
      description: 'Verify data integrity after migration',
      execute: async () => {
        console.log('✅ Verifying post-migration data integrity...');

        // Re-fetch projects to verify changes
        const projectsSnapshot = await getDocs(collection(db, COLLECTIONS.PROJECTS));
        const updatedProjects = projectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProjectRecord[];

        const integrityResults = {
          projectsWithValidCompanyIds: 0,
          orphanProjects: 0,
          totalProjects: updatedProjects.length
        };

        for (const project of updatedProjects) {
          const hasValidCompanyId = this.migrationData.companies.some(
            company => company.id === project.companyId
          );

          if (hasValidCompanyId) {
            integrityResults.projectsWithValidCompanyIds++;
          } else {
            integrityResults.orphanProjects++;
            console.log(`   ⚠️ Orphan project: ${project.name} (companyId: "${project.companyId}")`);
          }
        }

        console.log(`   📊 Integrity Check Results:`);
        console.log(`     - Total projects: ${integrityResults.totalProjects}`);
        console.log(`     - Projects with valid companyIds: ${integrityResults.projectsWithValidCompanyIds}`);
        console.log(`     - Orphan projects: ${integrityResults.orphanProjects}`);

        const integrityScore = (integrityResults.projectsWithValidCompanyIds / integrityResults.totalProjects) * 100;
        console.log(`     - Data integrity: ${integrityScore.toFixed(1)}%`);

        return {
          affectedRecords: integrityResults.projectsWithValidCompanyIds,
          data: integrityResults
        };
      },
      validate: async () => {
        // Consider migration successful if at least 80% of projects have valid company IDs
        const projectsSnapshot = await getDocs(collection(db, COLLECTIONS.PROJECTS));
        const updatedProjects = projectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProjectRecord[];

        const validProjects = updatedProjects.filter(project =>
          this.migrationData.companies.some(company => company.id === project.companyId)
        );

        const integrityScore = (validProjects.length / updatedProjects.length) * 100;
        return integrityScore >= 80;
      }
    };
  }
}

// Export the migration definition
export function createProjectCompanyRelationshipsMigration(): Migration {
  const migrationSteps = new ProjectCompanyMigrationSteps();

  return {
    id: '001_fix_project_company_relationships',
    version: '1.0.0',
    name: 'Fix Project-Company Relationships',
    description: 'Corrects incorrect companyId values in projects to establish proper relationships with companies',
    author: 'Claude Enterprise Migration System',
    createdAt: new Date(),
    dependencies: [],
    steps: [
      migrationSteps.analyzeDataStep(),
      migrationSteps.validateMappingsStep(),
      migrationSteps.updateProjectsStep(),
      migrationSteps.verifyIntegrityStep()
    ]
  };
}
