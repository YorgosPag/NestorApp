// Alternative API route using Client SDK (same as seed scripts)
import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { withErrorHandling, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';

// ✅ ENTERPRISE FIX: Force dynamic rendering to prevent static generation errors
// This API route depends on runtime data (companyId parameter + Firestore queries)
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) => {
    // 🚀 Next.js 15: params must be awaited before accessing properties
    const { companyId } = await params;

    // 🎯 PRODUCTION: Reduced API logging για καθαρότερη κονσόλα
    // console.log(`🏗️ API (Client SDK): Loading projects for companyId: "${companyId}"`);

    try {
      // 🚀 ENTERPRISE CACHING: Check cache first
      const cachedProjects = CacheHelpers.getCachedProjectsByCompany(companyId);
      if (cachedProjects) {
        // 🎯 PRODUCTION: Reduced cache logging
        // console.log(`⚡ API: CACHE HIT - Returning ${cachedProjects.length} cached projects for company ${companyId}`);
        return apiSuccess({
          projects: cachedProjects,
          companyId: companyId,
          source: 'cache',
          cached: true
        }, `Found ${cachedProjects.length} cached projects for company ${companyId}`);
      }

      // 🎯 PRODUCTION: Reduced verbosity
      // console.log('🔍 API: Cache miss - Fetching from Firestore...');

      // 🚀 PERFORMANCE: Skip the debugging "fetch ALL projects" - go directly to specific query
      const projectsQuery = query(
        collection(db, COLLECTIONS.PROJECTS),
        where('companyId', '==', companyId)
      );

      const snapshot = await getDocs(projectsQuery);
      console.log(`🏗️ API (Client SDK): Found ${snapshot.docs.length} projects for companyId "${companyId}"`);

      const projects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 💾 ENTERPRISE CACHING: Store in cache for future requests
      CacheHelpers.cacheProjectsByCompany(companyId, projects);

      console.log(`✅ API: Found ${projects.length} projects for company ${companyId} (cached for 3 minutes)`);

      return apiSuccess({
        projects,
        companyId: companyId,
        source: 'firestore',
        cached: false
      }, `Found ${projects.length} projects for company ${companyId}`);

    } catch (error: unknown) {
      console.error('❌ [Projects API] Error details:', {
        companyId: companyId,
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
  entityId: 'companyId'
});