import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { getAllActiveCompanies } from '@/services/companies.service';

export const GET = withErrorHandling(async (request: NextRequest) => {
  console.log('🏢 API: Loading active companies...');

  try {
    const companies = await getAllActiveCompanies();

    console.log(`✅ API: Found ${companies.length} active companies`);

    return apiSuccess({
      companies,
      count: companies.length
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