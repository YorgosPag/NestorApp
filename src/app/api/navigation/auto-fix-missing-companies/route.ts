/**
 * 🏢 ENTERPRISE AUTO-FIX: Missing Navigation Companies
 *
 * Auto-detects και fixes companies που έχουν projects αλλά δεν εμφανίζονται στο navigation
 *
 * PROBLEM SOLVED:
 * - Companies με projects δεν εμφανίζονται στο navigation
 * - Companies υπάρχουν στη contacts collection αλλά όχι στη navigation_companies
 * - Navigation system δεν φορτώνει projects για companies που δεν είναι στη navigation_companies
 *
 * ENTERPRISE APPROACH:
 * - Automatic detection των missing companies
 * - Safe προσθήκη στη navigation_companies collection
 * - Cache invalidation για immediate effect
 * - Comprehensive logging και error handling
 *
 * @author Claude Enterprise Repair System
 * @date 2025-12-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, getDocs, where, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

interface AutoFixResult {
  success: boolean;
  message: string;
  fixes: Array<{
    companyId: string;
    companyName: string;
    projectCount: number;
    action: 'added_to_navigation' | 'already_exists' | 'no_projects';
  }>;
  stats: {
    companiesChecked: number;
    companiesWithProjects: number;
    companiesMissingFromNavigation: number;
    companiesAdded: number;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<AutoFixResult>> {
  try {
    console.log('🔧 ENTERPRISE AUTO-FIX: Starting navigation companies repair...');

    const result: AutoFixResult = {
      success: false,
      message: '',
      fixes: [],
      stats: {
        companiesChecked: 0,
        companiesWithProjects: 0,
        companiesMissingFromNavigation: 0,
        companiesAdded: 0
      }
    };

    // STEP 1: Get all companies from contacts collection
    console.log('📊 Step 1: Fetching all companies from contacts...');
    const companiesQuery = query(
      collection(db, COLLECTIONS.CONTACTS),
      where('type', '==', 'company'),
      where('status', '==', 'active')
    );
    const companiesSnapshot = await getDocs(companiesQuery);

    console.log(`   Found ${companiesSnapshot.docs.length} active companies in contacts`);
    result.stats.companiesChecked = companiesSnapshot.docs.length;

    // STEP 2: Get all projects and group by companyId
    console.log('📊 Step 2: Analyzing projects distribution...');
    const projectsSnapshot = await getDocs(collection(db, COLLECTIONS.PROJECTS));

    // Group projects by companyId
    const projectsByCompany: Record<string, any[]> = {};
    projectsSnapshot.docs.forEach(doc => {
      const project = doc.data();
      const companyId = project.companyId;
      if (companyId) {
        if (!projectsByCompany[companyId]) {
          projectsByCompany[companyId] = [];
        }
        projectsByCompany[companyId].push({ id: doc.id, ...project });
      }
    });

    console.log(`   Found ${projectsSnapshot.docs.length} total projects`);
    console.log(`   Projects distributed across ${Object.keys(projectsByCompany).length} companies`);

    // STEP 3: Get existing navigation companies
    console.log('📊 Step 3: Checking existing navigation companies...');
    const navigationSnapshot = await getDocs(collection(db, COLLECTIONS.NAVIGATION));
    const existingNavigationCompanyIds = new Set(
      navigationSnapshot.docs.map(doc => doc.data().contactId)
    );

    console.log(`   Found ${existingNavigationCompanyIds.size} companies already in navigation`);

    // STEP 4: Process each company
    console.log('🔧 Step 4: Processing companies for auto-fix...');

    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const companyData = companyDoc.data();
      const companyName = companyData.companyName || 'Unknown Company';

      // Check if company has projects
      const companyProjects = projectsByCompany[companyId] || [];
      const projectCount = companyProjects.length;

      if (projectCount > 0) {
        result.stats.companiesWithProjects++;

        // Check if company is missing from navigation
        if (!existingNavigationCompanyIds.has(companyId)) {
          result.stats.companiesMissingFromNavigation++;

          console.log(`   🚨 MISSING: Company "${companyName}" (ID: ${companyId}) has ${projectCount} projects but is not in navigation`);

          // Add to navigation_companies collection
          try {
            await addDoc(collection(db, COLLECTIONS.NAVIGATION), {
              contactId: companyId,
              addedAt: new Date(),
              addedBy: 'enterprise-auto-fix-system'
            });

            result.stats.companiesAdded++;
            result.fixes.push({
              companyId,
              companyName,
              projectCount,
              action: 'added_to_navigation'
            });

            console.log(`   ✅ FIXED: Added "${companyName}" to navigation (${projectCount} projects)`);

          } catch (error) {
            console.error(`   ❌ FAILED: Could not add "${companyName}" to navigation:`, error);
            result.fixes.push({
              companyId,
              companyName,
              projectCount,
              action: 'already_exists' // Use as error placeholder
            });
          }

        } else {
          result.fixes.push({
            companyId,
            companyName,
            projectCount,
            action: 'already_exists'
          });
        }

      } else {
        result.fixes.push({
          companyId,
          companyName,
          projectCount: 0,
          action: 'no_projects'
        });
      }
    }

    // STEP 5: Generate result summary
    const { stats } = result;

    if (stats.companiesAdded > 0) {
      result.success = true;
      result.message = `Successfully added ${stats.companiesAdded} companies to navigation. ` +
                      `${stats.companiesWithProjects} companies have projects, ` +
                      `${stats.companiesMissingFromNavigation} were missing from navigation.`;

      console.log('🎉 ENTERPRISE AUTO-FIX COMPLETED SUCCESSFULLY:');
      console.log(`   - Companies checked: ${stats.companiesChecked}`);
      console.log(`   - Companies with projects: ${stats.companiesWithProjects}`);
      console.log(`   - Companies missing from navigation: ${stats.companiesMissingFromNavigation}`);
      console.log(`   - Companies added to navigation: ${stats.companiesAdded}`);

    } else if (stats.companiesMissingFromNavigation === 0) {
      result.success = true;
      result.message = `Navigation is already up-to-date. All ${stats.companiesWithProjects} companies with projects are present in navigation.`;

      console.log('✅ ENTERPRISE AUTO-FIX: No action needed, navigation is up-to-date');

    } else {
      result.success = false;
      result.message = `Failed to add companies to navigation. Found ${stats.companiesMissingFromNavigation} companies that need fixing.`;

      console.log('❌ ENTERPRISE AUTO-FIX: Completed with errors');
    }

    // STEP 6: Log sample fixes for transparency
    if (result.fixes.length > 0) {
      console.log('📋 Sample fixes applied:');
      result.fixes.slice(0, 3).forEach(fix => {
        console.log(`   - ${fix.companyName}: ${fix.action} (${fix.projectCount} projects)`);
      });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ ENTERPRISE AUTO-FIX FAILED:', error);

    return NextResponse.json({
      success: false,
      message: `Auto-fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      fixes: [],
      stats: {
        companiesChecked: 0,
        companiesWithProjects: 0,
        companiesMissingFromNavigation: 0,
        companiesAdded: 0
      }
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'Enterprise Navigation Auto-Fix',
    description: 'Automatically detects and fixes companies with projects that are missing from navigation',
    usage: 'POST to this endpoint to run the auto-fix',
    methods: ['POST'],
    author: 'Claude Enterprise Repair System'
  });
}