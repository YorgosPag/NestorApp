import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Quick fixing project company IDs...');

    const fixes = [
      // Fix existing project 1001
      {
        projectId: '1001',
        companyId: 'pzNUy8ksddGCtcQMqumR', // Correct ID for Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.
        action: 'update'
      },
      // Fix project 1002
      {
        projectId: '1002',
        companyId: 'pzNUy8ksddGCtcQMqumR',
        action: 'update'
      },
      // Fix project 1003
      {
        projectId: '1003',
        companyId: 'pzNUy8ksddGCtcQMqumR',
        action: 'update'
      },
      // Create new projects for other companies
      {
        projectId: '1004',
        companyId: 'HZ1anF4UaYEzqhpU2ilM', // ΑΛΥΣΙΔΑ ΑΕ
        companyName: 'ΑΛΥΣΙΔΑ ΑΕ',
        action: 'create'
      },
      {
        projectId: '1005',
        companyId: 'JQ2eU1MwmtqHXxsuujrK', // J&P ΑΒΑΞ ΑΕ
        companyName: 'J&P ΑΒΑΞ ΑΕ',
        action: 'create'
      },
      {
        projectId: '1006',
        companyId: 'SLw9O6yys0Lf6Ql3yw5g', // ΜΥΤΙΛΗΝΑΙΟΣ ΑΕ
        companyName: 'ΜΥΤΙΛΗΝΑΙΟΣ ΑΕ',
        action: 'create'
      },
      {
        projectId: '1007',
        companyId: 'VdqPobCgzGqaEJULEyoJ', // ΤΕΡΝΑ ΑΕ
        companyName: 'ΤΕΡΝΑ ΑΕ',
        action: 'create'
      },
      {
        projectId: '1008',
        companyId: 'XRh6PJG1lbkpVFQD0TXo', // ΑΚΤΩΡ ΑΤΕ
        companyName: 'ΑΚΤΩΡ ΑΤΕ',
        action: 'create'
      }
    ];

    const results = [];

    for (const fix of fixes) {
      try {
        if (fix.action === 'update') {
          // Update existing project
          const projectRef = doc(db, 'projects', fix.projectId);
          await updateDoc(projectRef, {
            companyId: fix.companyId,
            updatedAt: new Date().toISOString()
          });
          console.log(`✅ Updated project ${fix.projectId} with companyId ${fix.companyId}`);
          results.push({
            projectId: fix.projectId,
            action: 'updated',
            companyId: fix.companyId
          });

        } else if (fix.action === 'create') {
          // Create new project
          const newProject = {
            name: `Εμπορικό Κέντρο ${fix.companyName}`,
            title: `Ανάπτυξη εμπορικού κέντρου - ${fix.companyName}`,
            address: `Κεντρική Λεωφόρος, Αθήνα`,
            city: "Αθήνα",
            company: fix.companyName,
            companyId: fix.companyId,
            status: "planning",
            progress: 10,
            startDate: "2024-02-01",
            completionDate: "2026-06-30",
            totalValue: 1500000,
            totalArea: 2500.5,
            lastUpdate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            buildings: [
              {
                id: "building_1_main",
                name: "ΚΤΙΡΙΟ Α - Κύριο",
                description: "Κύριο κτίριο εμπορικού κέντρου",
                status: "planning",
                totalArea: 2000.5,
                units: 15,
                floors: [
                  { id: "floor_0", name: "Ισόγειο", number: 0, units: 10 },
                  { id: "floor_1", name: "1ος Όροφος", number: 1, units: 5 }
                ]
              },
              {
                id: "building_2_parking",
                name: "ΚΤΙΡΙΟ Β - Πάρκινγκ",
                description: "Υπόγειο πάρκινγκ",
                status: "planning",
                totalArea: 500,
                units: 100,
                floors: [
                  { id: "floor_-1", name: "Υπόγειο", number: -1, units: 100 }
                ]
              }
            ]
          };

          const projectRef = doc(db, 'projects', fix.projectId);
          await setDoc(projectRef, newProject);
          console.log(`✅ Created project ${fix.projectId} for ${fix.companyName}`);
          results.push({
            projectId: fix.projectId,
            action: 'created',
            companyId: fix.companyId,
            companyName: fix.companyName
          });
        }

      } catch (error) {
        console.error(`❌ Failed to process ${fix.action} for project ${fix.projectId}:`, error);
        results.push({
          projectId: fix.projectId,
          action: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} project fixes`,
      results
    });

  } catch (error) {
    console.error('❌ Error in quick fix:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}