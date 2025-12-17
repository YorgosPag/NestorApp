/**
 * 🔍 FLOORS DEBUG ENDPOINT - ENTERPRISE DATABASE ANALYSIS
 *
 * ΠΡΟΒΛΗΜΑ: 500 errors στο floors API
 * ΥΠΟΠΤΟ: Μπακάλικο floor IDs (floor_-1, floor_0, κλπ) αντί enterprise random codes
 *
 * ΣΚΟΠΟΣ:
 * 1. Ανάλυση της τρέχουσας δομής floors collection
 * 2. Εντοπισμός μπακάλικο IDs vs enterprise IDs
 * 3. Έλεγχος subcollections vs normalized structure
 *
 * @author Claude Enterprise Database Analysis System
 * @date 2025-12-17
 * @priority CRITICAL - Navigation floors δεν λειτουργούν
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

interface FloorAnalysisResult {
  success: boolean;
  analysis: {
    normalizedFloors: {
      exists: boolean;
      count: number;
      sampleIds: string[];
      hasBuildings: boolean;
      buildingIds: string[];
    };
    subCollectionFloors: {
      checked: boolean;
      buildings: Array<{
        buildingId: string;
        hasFloors: boolean;
        floorCount: number;
        floorIds: string[];
      }>;
    };
    enterpriseAssessment: {
      hasEnterpriseIds: boolean;
      hasMpakalikoIds: boolean;
      idPatterns: {
        pattern: string;
        count: number;
        examples: string[];
      }[];
    };
  };
  recommendations: string[];
}

export async function GET(request: NextRequest): Promise<NextResponse<FloorAnalysisResult>> {
  try {
    console.log('🔍 FLOORS DEBUG ANALYSIS: Starting comprehensive database inspection...');

    const result: FloorAnalysisResult = {
      success: false,
      analysis: {
        normalizedFloors: {
          exists: false,
          count: 0,
          sampleIds: [],
          hasBuildings: false,
          buildingIds: []
        },
        subCollectionFloors: {
          checked: false,
          buildings: []
        },
        enterpriseAssessment: {
          hasEnterpriseIds: false,
          hasMpakalikoIds: false,
          idPatterns: []
        }
      },
      recommendations: []
    };

    // STEP 1: Check normalized floors collection
    console.log('📊 Step 1: Analyzing normalized floors collection...');
    try {
      const floorsSnapshot = await getDocs(collection(db, COLLECTIONS.FLOORS));

      result.analysis.normalizedFloors.exists = true;
      result.analysis.normalizedFloors.count = floorsSnapshot.docs.length;

      const allFloorIds = floorsSnapshot.docs.map(doc => doc.id);
      result.analysis.normalizedFloors.sampleIds = allFloorIds.slice(0, 10); // First 10 IDs

      // Check for building IDs in floor documents
      const buildingIds: string[] = [];
      floorsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.buildingId) {
          buildingIds.push(data.buildingId);
        }
      });

      result.analysis.normalizedFloors.hasBuildings = buildingIds.length > 0;
      result.analysis.normalizedFloors.buildingIds = [...new Set(buildingIds)].slice(0, 5);

      console.log(`   Found ${floorsSnapshot.docs.length} floors in normalized collection`);
      console.log(`   Sample IDs: [${result.analysis.normalizedFloors.sampleIds.join(', ')}]`);
      console.log(`   Building IDs found: ${buildingIds.length > 0 ? buildingIds.length : 'NONE'}`);

    } catch (error) {
      console.log(`   ❌ Normalized floors collection error: ${error}`);
    }

    // STEP 2: Check subcollection structure (buildings/{buildingId}/floors)
    console.log('🏗️ Step 2: Checking subcollection structure...');
    try {
      // First get some building IDs from buildings collection
      const buildingsSnapshot = await getDocs(collection(db, COLLECTIONS.BUILDINGS));
      const buildingIds = buildingsSnapshot.docs.slice(0, 5).map(doc => doc.id); // Check first 5 buildings

      result.analysis.subCollectionFloors.checked = true;

      for (const buildingId of buildingIds) {
        try {
          // Check if building has floors subcollection
          const buildingFloorsSnapshot = await getDocs(collection(db, COLLECTIONS.BUILDINGS, buildingId, 'floors'));

          const buildingFloorAnalysis = {
            buildingId,
            hasFloors: buildingFloorsSnapshot.docs.length > 0,
            floorCount: buildingFloorsSnapshot.docs.length,
            floorIds: buildingFloorsSnapshot.docs.map(doc => doc.id)
          };

          result.analysis.subCollectionFloors.buildings.push(buildingFloorAnalysis);

          console.log(`   Building ${buildingId}: ${buildingFloorAnalysis.floorCount} floors in subcollection`);
          if (buildingFloorAnalysis.floorCount > 0) {
            console.log(`     Floor IDs: [${buildingFloorAnalysis.floorIds.join(', ')}]`);
          }

        } catch (error) {
          console.log(`   ❌ Error checking building ${buildingId}: ${error}`);
          result.analysis.subCollectionFloors.buildings.push({
            buildingId,
            hasFloors: false,
            floorCount: 0,
            floorIds: []
          });
        }
      }

    } catch (error) {
      console.log(`   ❌ Subcollection check failed: ${error}`);
    }

    // STEP 3: Enterprise vs Μπακάλικο ID Analysis
    console.log('🎯 Step 3: Enterprise vs Μπακάλικο ID Analysis...');

    // Collect all floor IDs from both sources
    const allFloorIds: string[] = [
      ...result.analysis.normalizedFloors.sampleIds,
      ...result.analysis.subCollectionFloors.buildings.flatMap(b => b.floorIds)
    ];

    // Analyze ID patterns
    const idPatterns: { [pattern: string]: string[] } = {};

    allFloorIds.forEach(id => {
      if (id.match(/^floor_-?\d+$/)) {
        // Μπακάλικο pattern: floor_1, floor_-1, floor_0
        idPatterns['ΜΠΑΚΑΛΙΚΟ_NUMERIC'] = idPatterns['ΜΠΑΚΑΛΙΚΟ_NUMERIC'] || [];
        idPatterns['ΜΠΑΚΑΛΙΚΟ_NUMERIC'].push(id);
      } else if (id.match(/^floor_[a-zA-Z0-9]{15,}$/)) {
        // Enterprise pattern: floor_8kJ2mN9pQ4rX7sY1wZ3v
        idPatterns['ENTERPRISE_RANDOM'] = idPatterns['ENTERPRISE_RANDOM'] || [];
        idPatterns['ENTERPRISE_RANDOM'].push(id);
      } else if (id.match(/^[a-zA-Z0-9]{20,}$/)) {
        // Pure random: 8kJ2mN9pQ4rX7sY1wZ3vM1nP
        idPatterns['PURE_RANDOM'] = idPatterns['PURE_RANDOM'] || [];
        idPatterns['PURE_RANDOM'].push(id);
      } else {
        // Other patterns
        idPatterns['OTHER'] = idPatterns['OTHER'] || [];
        idPatterns['OTHER'].push(id);
      }
    });

    // Convert to result format
    result.analysis.enterpriseAssessment.idPatterns = Object.entries(idPatterns).map(([pattern, examples]) => ({
      pattern,
      count: examples.length,
      examples: examples.slice(0, 5)
    }));

    result.analysis.enterpriseAssessment.hasMpakalikoIds = !!idPatterns['ΜΠΑΚΑΛΙΚΟ_NUMERIC'];
    result.analysis.enterpriseAssessment.hasEnterpriseIds = !!(idPatterns['ENTERPRISE_RANDOM'] || idPatterns['PURE_RANDOM']);

    console.log('📊 ID Pattern Analysis:');
    result.analysis.enterpriseAssessment.idPatterns.forEach(pattern => {
      console.log(`   ${pattern.pattern}: ${pattern.count} floors, examples: [${pattern.examples.join(', ')}]`);
    });

    // STEP 4: Generate Recommendations
    console.log('💡 Step 4: Generating recommendations...');

    if (result.analysis.enterpriseAssessment.hasMpakalikoIds) {
      result.recommendations.push('🚨 ΚΡΙΣΙΜΟ: Βρέθηκαν ΜΠΑΚΑΛΙΚΟ floor IDs! Χρειάζεται migration σε enterprise random codes');
    }

    if (result.analysis.normalizedFloors.count === 0 && result.analysis.subCollectionFloors.buildings.some(b => b.hasFloors)) {
      result.recommendations.push('📊 Floors βρίσκονται σε subcollections, όχι σε normalized collection - το API θα πρέπει να διορθωθεί');
    }

    if (result.analysis.normalizedFloors.count > 0 && !result.analysis.normalizedFloors.hasBuildings) {
      result.recommendations.push('⚠️ Normalized floors δεν έχουν buildingId references - λάθος σχήμα');
    }

    const totalFloors = result.analysis.normalizedFloors.count +
      result.analysis.subCollectionFloors.buildings.reduce((sum, b) => sum + b.floorCount, 0);

    if (totalFloors === 0) {
      result.recommendations.push('🚨 ΜΗΔΕΝ floors σε όλη τη βάση! Χρειάζεται δημιουργία floors με enterprise architecture');
    }

    if (result.analysis.enterpriseAssessment.hasEnterpriseIds && result.analysis.enterpriseAssessment.hasMpakalikoIds) {
      result.recommendations.push('🔄 Mixed ID patterns detected - χρειάζεται uniformity σε enterprise standards');
    }

    // STEP 5: Final Assessment
    const hasNoFloors = totalFloors === 0;
    const hasWrongStructure = result.analysis.normalizedFloors.count === 0 && result.analysis.subCollectionFloors.buildings.some(b => b.hasFloors);
    const hasMpakalikoIds = result.analysis.enterpriseAssessment.hasMpakalikoIds;

    if (hasNoFloors) {
      result.success = false;
      console.log('❌ CRITICAL: NO FLOORS FOUND IN DATABASE');
    } else if (hasWrongStructure) {
      result.success = false;
      console.log('❌ CRITICAL: WRONG STRUCTURE - Floors in subcollections but API expects normalized');
    } else if (hasMpakalikoIds) {
      result.success = false;
      console.log('❌ CRITICAL: ΜΠΑΚΑΛΙΚΟ IDs DETECTED - Not enterprise standard');
    } else {
      result.success = true;
      console.log('✅ FLOORS DATABASE ANALYSIS COMPLETE');
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ FLOORS DEBUG ANALYSIS FAILED:', error);

    return NextResponse.json({
      success: false,
      analysis: {
        normalizedFloors: { exists: false, count: 0, sampleIds: [], hasBuildings: false, buildingIds: [] },
        subCollectionFloors: { checked: false, buildings: [] },
        enterpriseAssessment: { hasEnterpriseIds: false, hasMpakalikoIds: false, idPatterns: [] }
      },
      recommendations: [`Debug analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    }, { status: 500 });
  }
}