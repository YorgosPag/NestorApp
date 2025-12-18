import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { getAllActiveCompanies } from '@/services/companies.service';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';

export const GET = withErrorHandling(async (request: NextRequest) => {
  console.log('🏢 API: Loading active companies...');

  try {
    // 🚀 ENTERPRISE CACHING: Check cache first
    const cachedCompanies = CacheHelpers.getCachedCompanies();
    if (cachedCompanies) {
      console.log(`⚡ API: CACHE HIT - Returning ${cachedCompanies.length} cached companies`);
      return apiSuccess({
        companies: cachedCompanies,
        count: cachedCompanies.length,
        cached: true
      }, `Found ${cachedCompanies.length} cached companies`);
    }

    console.log('🔍 API: Cache miss - Fetching from Firestore...');
    const companies = await getAllActiveCompanies();

    // 💾 ENTERPRISE CACHING: Store in cache for future requests
    CacheHelpers.cacheCompanies(companies);

    console.log(`✅ API: Found ${companies.length} active companies (cached for 5 minutes)`);

    return apiSuccess({
      companies,
      count: companies.length,
      cached: false
    }, `Found ${companies.length} active companies`);

  } catch (error: unknown) {
    console.error('❌ API: Error loading companies:', error);

    // Enhanced error details for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error,
      timestamp: new Date().toISOString()
    };

    console.error('❌ API: Detailed error info:', errorDetails);

    throw error; // Let withErrorHandling handle the response
  }
}, {
  operation: 'loadActiveCompanies',
  entityType: 'companies',
  entityId: 'all'
});