// Alternative API route using Client SDK (same as seed scripts)
import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { withErrorHandling, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: { companyId: string } }
) => {
    console.log(`🏗️ API (Client SDK): Loading projects for companyId: "${params.companyId}"`);
    
    // Use Client SDK (same as seed scripts)
    console.log('🔍 DEBUG: Fetching ALL projects to see available companyIds...');
    const allProjectsQuery = query(collection(db, COLLECTIONS.PROJECTS));
    const allSnapshot = await getDocs(allProjectsQuery);
    console.log(`🔍 DEBUG: Total projects in Firestore: ${allSnapshot.docs.length}`);

    allSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`🔍 DEBUG: Project ID=${doc.id}, companyId="${data.companyId}", company="${data.company}", name="${data.name}"`);
    });

    // Now do the specific query
    const projectsQuery = query(
      collection(db, COLLECTIONS.PROJECTS),
      where('companyId', '==', params.companyId)
    );
    
    const snapshot = await getDocs(projectsQuery);
    console.log('🔍 Found', snapshot.docs.length, 'projects');
    console.log(`🏗️ API (Client SDK): Found ${snapshot.docs.length} projects for companyId "${params.companyId}"`);
    
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`🏗️ API (Client SDK): Projects:`, projects.map(p => ({
      id: p.id,
      name: p.name,
      company: p.company
    })));
    
    return apiSuccess({
      projects,
      companyId: params.companyId,
      source: 'client-sdk'
    }, `Found ${projects.length} projects for company ${params.companyId}`);
}, {
  operation: 'loadProjectsByCompany',
  entityType: 'projects',
  entityId: 'params.companyId'
});