import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

/** Company data for analysis */
interface CompanyData {
  id: string;
  name: string;
  industry?: string;
  vatNumber?: string;
  status?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function GET(req: NextRequest) {
  console.log('🔍 Starting company analysis...');

  try {
    // Get all contacts with type 'company'
    const companiesQuery = query(
      collection(db, COLLECTIONS.CONTACTS),
      where('type', '==', 'company')
    );

    const snapshot = await getDocs(companiesQuery);
    console.log(`📊 Found ${snapshot.size} companies total`);

    const companies: CompanyData[] = [];
    const companyNameCounts: Record<string, number> = {};

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const company = {
        id: doc.id,
        name: data.companyName,
        industry: data.industry,
        vatNumber: data.vatNumber,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };

      companies.push(company);

      // Count occurrences of each company name
      if (companyNameCounts[data.companyName]) {
        companyNameCounts[data.companyName]++;
      } else {
        companyNameCounts[data.companyName] = 1;
      }
    });

    // Find duplicates
    const duplicates = Object.entries(companyNameCounts)
      .filter(([name, count]) => count > 1)
      .map(([name, count]) => ({
        name,
        count,
        companies: companies.filter(c => c.name === name)
      }));

    // Check project connections based on known mappings
    console.log('🏗️ Checking project connections...');

    // 🏢 ENTERPRISE: Dynamic company analysis - NO HARDCODED NAMES
    const primaryCompanyNames = (process.env.NEXT_PUBLIC_PRIMARY_COMPANY_NAMES ||
      'Main Company,Primary Company').split(',').map(name => name.trim());

    const companiesWithProjects = companies.filter(company => {
      // Check if company is primary company by configurable name patterns
      const isPrimaryCompany = primaryCompanyNames.some(primaryName =>
        company.name.includes(primaryName)
      ) || company.isPrimary === true;

      return isPrimaryCompany;
    });

    console.log('🏢 Building connections: Skipping external API calls (simplified analysis)');

    const analysis = {
      totalCompanies: companies.length,
      uniqueCompanyNames: Object.keys(companyNameCounts).length,
      duplicateNames: duplicates.length,
      duplicates: duplicates,
      connections: {
        withProjects: {
          count: companiesWithProjects.length,
          companies: companiesWithProjects,
          note: "Companies with known project connections (mapping to 'pagonis' project system)"
        }
      },
      allCompanies: companies
    };

    console.log(`📈 Analysis complete:
    - Total companies: ${analysis.totalCompanies}
    - Unique names: ${analysis.uniqueCompanyNames}
    - Duplicate names: ${analysis.duplicateNames}
    - Companies with projects: ${analysis.connections.withProjects.count}`);

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('❌ Error analyzing companies:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze companies'
      },
      { status: 500 }
    );
  }
}