// Alternative API route using Client SDK (same as seed scripts)
import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    console.log(`🏗️ API (Client SDK): Loading projects for companyId: "${params.companyId}"`);
    
    // Use Client SDK (same as seed scripts)
    console.log('🔍 DEBUG: Fetching ALL projects to see available companyIds...');
    const allProjectsQuery = query(collection(db, 'projects'));
    const allSnapshot = await getDocs(allProjectsQuery);
    console.log(`🔍 DEBUG: Total projects in Firestore: ${allSnapshot.docs.length}`);
    
    allSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`🔍 DEBUG: Project ID=${doc.id}, companyId="${data.companyId}", company="${data.company}", name="${data.name}"`);
    });
    
    // Now do the specific query
    const projectsQuery = query(
      collection(db, 'projects'),
      where('companyId', '==', params.companyId)
    );
    
    const snapshot = await getDocs(projectsQuery);
    console.log('🔍 Found', snapshot.docs.length, 'projects');
    console.log(`🏗️ API (Client SDK): Found ${snapshot.docs.length} projects for companyId "${params.companyId}"`);
    
    const projects = snapshot.docs.map(doc => ({
      id: parseInt(doc.id),
      ...doc.data()
    }));
    
    console.log(`🏗️ API (Client SDK): Projects:`, projects.map(p => ({
      id: p.id,
      name: p.name,
      company: p.company
    })));
    
    return NextResponse.json({ 
      success: true, 
      projects,
      companyId: params.companyId,
      source: 'client-sdk'
    });
    
  } catch (error) {
    console.error('🏗️ API (Client SDK): Error loading projects:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        projects: [],
        companyId: params.companyId,
        source: 'client-sdk'
      },
      { status: 500 }
    );
  }
}