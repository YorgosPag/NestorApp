import { NextRequest, NextResponse } from 'next/server';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Starting comprehensive projects analysis...');

    // 1. Πάρε ΟΛΑ τα projects
    const projectsSnapshot = await getDocs(collection(db, COLLECTIONS.PROJECTS));
    console.log(`🏗️ Total projects in database: ${projectsSnapshot.docs.length}`);

    const allProjects = projectsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        company: data.company,
        companyId: data.companyId,
        status: data.status,
        hasBuildings: data.buildings ? data.buildings.length : 0,
        lastUpdate: data.lastUpdate,
        updatedAt: data.updatedAt
      };
    });

    console.log('\n📊 ALL PROJECTS FOUND:');
    allProjects.forEach(project => {
      console.log(`🏗️ ID: ${project.id} | Name: ${project.name} | Company: ${project.company} | CompanyId: ${project.companyId} | Buildings: ${project.hasBuildings}`);
    });

    // 2. Πάρε ΟΛΑ τα contacts
    const contactsSnapshot = await getDocs(collection(db, COLLECTIONS.CONTACTS));
    console.log(`👥 Total contacts in database: ${contactsSnapshot.docs.length}`);

    const allContacts = contactsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        companyName: data.companyName,
        status: data.status,
        industry: data.industry
      };
    });

    const companies = allContacts.filter(contact => contact.type === 'company');
    console.log(`🏢 Total companies: ${companies.length}`);

    console.log('\n📊 ALL COMPANIES FOUND:');
    companies.forEach(company => {
      console.log(`🏢 ID: ${company.id} | Name: ${company.companyName} | Status: ${company.status} | Industry: ${company.industry}`);
    });

    // 3. Ανάλυση συσχετισμών
    console.log('\n🔗 COMPANY-PROJECT MATCHING ANALYSIS:');

    const matchingAnalysis = companies.map(company => {
      // Βρες projects που έχουν το ίδιο companyId
      const projectsByCompanyId = allProjects.filter(project => project.companyId === company.id);

      // Βρες projects που έχουν το ίδιο company name
      const projectsByCompanyName = allProjects.filter(project =>
        project.company && project.company.toLowerCase().includes(company.companyName.toLowerCase())
      );

      console.log(`🔗 Company: ${company.companyName} (ID: ${company.id})`);
      console.log(`   - Projects by ID match: ${projectsByCompanyId.length}`);
      console.log(`   - Projects by name match: ${projectsByCompanyName.length}`);

      if (projectsByCompanyId.length > 0) {
        projectsByCompanyId.forEach(p => console.log(`     ✅ By ID: ${p.name} (${p.id})`));
      }

      if (projectsByCompanyName.length > 0) {
        projectsByCompanyName.forEach(p => console.log(`     📝 By Name: ${p.name} (${p.id}) - CompanyId: ${p.companyId}`));
      }

      return {
        company: {
          id: company.id,
          name: company.companyName,
          status: company.status
        },
        projectsByCompanyId,
        projectsByCompanyName,
        totalProjects: projectsByCompanyId.length
      };
    });

    // 4. Εύρεση ορφανών projects
    const orphanProjects = allProjects.filter(project => {
      return !companies.some(company => company.id === project.companyId);
    });

    console.log('\n👤 ORPHAN PROJECTS (without valid company):');
    orphanProjects.forEach(project => {
      console.log(`🏗️ ${project.name} | CompanyId: "${project.companyId}" | Company: "${project.company}"`);
    });

    // 5. Στατιστικά
    const stats = {
      totalProjects: allProjects.length,
      totalCompanies: companies.length,
      companiesWithProjects: matchingAnalysis.filter(m => m.totalProjects > 0).length,
      companiesWithoutProjects: matchingAnalysis.filter(m => m.totalProjects === 0).length,
      orphanProjects: orphanProjects.length,
      projectsWithValidCompanyId: allProjects.filter(p =>
        companies.some(c => c.id === p.companyId)
      ).length
    };

    console.log('\n📈 STATISTICS:');
    console.log(`📊 Total Projects: ${stats.totalProjects}`);
    console.log(`🏢 Total Companies: ${stats.totalCompanies}`);
    console.log(`✅ Companies WITH Projects: ${stats.companiesWithProjects}`);
    console.log(`❌ Companies WITHOUT Projects: ${stats.companiesWithoutProjects}`);
    console.log(`👤 Orphan Projects: ${stats.orphanProjects}`);
    console.log(`🔗 Projects with Valid CompanyId: ${stats.projectsWithValidCompanyId}`);

    return NextResponse.json({
      success: true,
      analysis: {
        allProjects,
        companies,
        matchingAnalysis,
        orphanProjects,
        stats
      },
      summary: `Found ${stats.totalProjects} projects and ${stats.totalCompanies} companies. ${stats.companiesWithProjects} companies have projects, ${stats.orphanProjects} projects are orphaned.`
    });

  } catch (error) {
    console.error('❌ Error in projects analysis:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}