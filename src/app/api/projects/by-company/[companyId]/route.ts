// Alternative API route using Client SDK (same as seed scripts)
import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { withErrorHandling, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: { companyId: string } }
) => {
    console.log(`🏗️ API (Client SDK): Loading projects for companyId: "${params.companyId}"`);

    try {
      // 🚀 ENTERPRISE CACHING: Check cache first
      const cachedProjects = CacheHelpers.getCachedProjectsByCompany(params.companyId);
      if (cachedProjects) {
        console.log(`⚡ API: CACHE HIT - Returning ${cachedProjects.length} cached projects for company ${params.companyId}`);
        return apiSuccess({
          projects: cachedProjects,
          companyId: params.companyId,
          source: 'cache',
          cached: true
        }, `Found ${cachedProjects.length} cached projects for company ${params.companyId}`);
      }

      console.log('🔍 API: Cache miss - Fetching from Firestore...');

      // 🚀 PERFORMANCE: Skip the debugging "fetch ALL projects" - go directly to specific query
      const projectsQuery = query(
        collection(db, COLLECTIONS.PROJECTS),
        where('companyId', '==', params.companyId)
      );

      const snapshot = await getDocs(projectsQuery);
      console.log(`🏗️ API (Client SDK): Found ${snapshot.docs.length} projects for companyId "${params.companyId}"`);

      const projects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 💾 ENTERPRISE CACHING: Store in cache for future requests
      CacheHelpers.cacheProjectsByCompany(params.companyId, projects);

      console.log(`✅ API: Found ${projects.length} projects for company ${params.companyId} (cached for 3 minutes)`);

      return apiSuccess({
        projects,
        companyId: params.companyId,
        source: 'firestore',
        cached: false
      }, `Found ${projects.length} projects for company ${params.companyId}`);

    } catch (error: unknown) {
      console.error('❌ [Projects API] Error details:', {
        companyId: params.companyId,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : { message: String(error) },
        timestamp: new Date().toISOString()
      });

      throw error; // Re-throw for withErrorHandling
    }
}, {
  operation: 'loadProjectsByCompany',
  entityType: COLLECTIONS.PROJECTS,
  entityId: 'params.companyId'
});