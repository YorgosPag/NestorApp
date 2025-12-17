import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { withErrorHandling, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';

export const GET = withErrorHandling(async (request: NextRequest) => {
  console.log('🔍 [DEBUG] Fetching all Firestore data for analysis...');

  try {
    // Get all companies
    const companiesQuery = collection(db, COLLECTIONS.CONTACTS);
    const companiesSnapshot = await getDocs(companiesQuery);
    const companies = companiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).filter(item => item.type === 'company');

    console.log(`🏢 Found ${companies.length} companies`);

    // Get all projects
    const projectsQuery = collection(db, COLLECTIONS.PROJECTS);
    const projectsSnapshot = await getDocs(projectsQuery);
    const projects = projectsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`🏗️ Found ${projects.length} projects`);

    // Analyze the data
    const companiesInfo = companies.map(company => ({
      id: company.id,
      name: company.companyName,
      type: company.type,
      status: company.status || 'UNDEFINED'
    }));

    const projectsInfo = projects.map(project => ({
      id: project.id,
      name: project.name,
      companyId: project.companyId || 'UNDEFINED',
      company: project.company || 'UNDEFINED',
      hasBuildings: !!project.buildings && project.buildings.length > 0
    }));

    // Cross-reference
    const companiesWithProjects = companiesInfo.map(company => {
      const companyProjects = projects.filter(p =>
        p.companyId === company.id || p.company === company.name
      );
      return {
        ...company,
        projectsCount: companyProjects.length,
        projects: companyProjects.map(p => ({ id: p.id, name: p.name }))
      };
    });

    return apiSuccess({
      companies: companiesInfo,
      projects: projectsInfo,
      companiesWithProjects,
      summary: {
        totalCompanies: companies.length,
        totalProjects: projects.length,
        companiesWithProjects: companiesWithProjects.filter(c => c.projectsCount > 0).length
      }
    }, 'Firestore data analysis complete');

  } catch (error: unknown) {
    console.error('❌ [DEBUG] Error fetching Firestore data:', error);
    throw error;
  }
}, {
  operation: 'debugFirestoreData',
  entityType: 'debug',
  entityId: 'all'
});