/**
 * <â ENTERPRISE DATABASE ARCHITECTURE AUDIT
 *
 * £šŸ Ÿ£:  »®Á·Â ±½¬»ÅÃ· Ä·Â database architecture ³¹± floors
 * £¤‘¤‘¡: Fortune 500 database audit standards
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

interface EnterpriseDatabaseAudit {
  auditTimestamp: string;
  compliance: {
    level: 'ENTERPRISE' | 'ACCEPTABLE' | 'UNACCEPTABLE';
    score: number;
    blockers: string[];
  };
  collections: {
    normalizedFloors: {
      exists: boolean;
      documentCount: number;
      sampleDocuments: any[];
      idPatterns: {
        enterprise: { count: number; examples: string[] };
        mpakalikoNumeric: { count: number; examples: string[] };
      };
    };
    subcollectionFloors: {
      buildingsChecked: number;
      totalSubcollectionFloors: number;
      sampleStructure: Array<{
        buildingId: string;
        floorCount: number;
        floorIds: string[];
      }>;
    };
  };
  architecture: {
    currentPattern: 'NORMALIZED' | 'SUBCOLLECTIONS' | 'MIXED' | 'UNKNOWN';
    migrationRequired: boolean;
  };
  recommendations: {
    immediate: string[];
    migration: string[];
  };
}

export async function GET(): Promise<NextResponse<EnterpriseDatabaseAudit>> {
  console.log('<â ENTERPRISE DATABASE AUDIT: Starting...');

  try {
    const audit: EnterpriseDatabaseAudit = {
      auditTimestamp: new Date().toISOString(),
      compliance: { level: 'UNACCEPTABLE', score: 0, blockers: [] },
      collections: {
        normalizedFloors: {
          exists: false, documentCount: 0, sampleDocuments: [],
          idPatterns: { enterprise: { count: 0, examples: [] }, mpakalikoNumeric: { count: 0, examples: [] } }
        },
        subcollectionFloors: { buildingsChecked: 0, totalSubcollectionFloors: 0, sampleStructure: [] }
      },
      architecture: { currentPattern: 'UNKNOWN', migrationRequired: false },
      recommendations: { immediate: [], migration: [] }
    };

    // AUDIT 1: Normalized Floors
    console.log('=Ê AUDIT 1: Normalized floors collection...');
    try {
      const floorsSnapshot = await getDocs(query(collection(db, COLLECTIONS.FLOORS), limit(50)));
      audit.collections.normalizedFloors.exists = true;
      audit.collections.normalizedFloors.documentCount = floorsSnapshot.docs.length;

      if (floorsSnapshot.docs.length > 0) {
        audit.collections.normalizedFloors.sampleDocuments = floorsSnapshot.docs.slice(0, 2).map(doc => ({
          id: doc.id, ...doc.data()
        }));

        // ID Analysis
        floorsSnapshot.docs.forEach(doc => {
          const id = doc.id;
          if (id.match(/^floor_-?\d+$/)) {
            audit.collections.normalizedFloors.idPatterns.mpakalikoNumeric.count++;
            if (audit.collections.normalizedFloors.idPatterns.mpakalikoNumeric.examples.length < 3) {
              audit.collections.normalizedFloors.idPatterns.mpakalikoNumeric.examples.push(id);
            }
          } else if (id.length >= 15) {
            audit.collections.normalizedFloors.idPatterns.enterprise.count++;
            if (audit.collections.normalizedFloors.idPatterns.enterprise.examples.length < 3) {
              audit.collections.normalizedFloors.idPatterns.enterprise.examples.push(id);
            }
          }
        });
      }
      console.log(`   Normalized floors: ${audit.collections.normalizedFloors.documentCount} documents`);
    } catch (error) {
      console.log(`   L Normalized floors error: ${error}`);
    }

    // AUDIT 2: Subcollections
    console.log('<× AUDIT 2: Checking subcollections...');
    try {
      const buildingsSnapshot = await getDocs(query(collection(db, COLLECTIONS.BUILDINGS), limit(10)));
      const buildingsToCheck = buildingsSnapshot.docs.slice(0, 5);
      audit.collections.subcollectionFloors.buildingsChecked = buildingsToCheck.length;

      for (const buildingDoc of buildingsToCheck) {
        try {
          const floorsSnapshot = await getDocs(collection(db, COLLECTIONS.BUILDINGS, buildingDoc.id, 'floors'));
          if (floorsSnapshot.docs.length > 0) {
            audit.collections.subcollectionFloors.totalSubcollectionFloors += floorsSnapshot.docs.length;
            audit.collections.subcollectionFloors.sampleStructure.push({
              buildingId: buildingDoc.id,
              floorCount: floorsSnapshot.docs.length,
              floorIds: floorsSnapshot.docs.map(doc => doc.id)
            });
          }
        } catch (error) {
          console.log(`     Error checking ${buildingDoc.id}`);
        }
      }
      console.log(`   Subcollection floors: ${audit.collections.subcollectionFloors.totalSubcollectionFloors}`);
    } catch (error) {
      console.log(`   L Subcollections error: ${error}`);
    }

    // ANALYSIS
    const hasNormalized = audit.collections.normalizedFloors.documentCount > 0;
    const hasSubcollection = audit.collections.subcollectionFloors.totalSubcollectionFloors > 0;

    if (hasNormalized && hasSubcollection) audit.architecture.currentPattern = 'MIXED';
    else if (hasSubcollection) audit.architecture.currentPattern = 'SUBCOLLECTIONS';
    else if (hasNormalized) audit.architecture.currentPattern = 'NORMALIZED';
    else audit.architecture.currentPattern = 'UNKNOWN';

    audit.architecture.migrationRequired = audit.architecture.currentPattern !== 'NORMALIZED';

    // SCORING
    let score = 0;
    if (audit.architecture.currentPattern === 'NORMALIZED') score += 50;
    else if (audit.architecture.currentPattern === 'SUBCOLLECTIONS') score += 25;

    const totalFloorIds = audit.collections.normalizedFloors.idPatterns.enterprise.count +
                         audit.collections.normalizedFloors.idPatterns.mpakalikoNumeric.count;
    if (totalFloorIds > 0) {
      const enterpriseRatio = audit.collections.normalizedFloors.idPatterns.enterprise.count / totalFloorIds;
      score += enterpriseRatio * 50;
    }

    audit.compliance.score = Math.round(score);
    if (audit.compliance.score >= 80) audit.compliance.level = 'ENTERPRISE';
    else if (audit.compliance.score >= 60) audit.compliance.level = 'ACCEPTABLE';
    else audit.compliance.level = 'UNACCEPTABLE';

    // BLOCKERS
    if (audit.collections.normalizedFloors.idPatterns.mpakalikoNumeric.count > 0) {
      audit.compliance.blockers.push('œ ‘š‘›™šŸ floor IDs detected');
      audit.recommendations.immediate.push('=¨ Replace ¼À±º¬»¹º¿ floor IDs with enterprise codes');
    }

    if (audit.architecture.currentPattern === 'SUBCOLLECTIONS') {
      audit.compliance.blockers.push('Subcollection architecture prevents efficient querying');
      audit.recommendations.migration.push('<× MIGRATE floors to normalized collection');
    }

    if (!hasNormalized && !hasSubcollection) {
      audit.compliance.blockers.push('NO FLOORS DATA found');
      audit.recommendations.immediate.push('=¨ CREATE floors data with enterprise architecture');
    }

    console.log(` AUDIT COMPLETE: ${audit.compliance.level} (${audit.compliance.score}/100)`);
    return NextResponse.json(audit);

  } catch (error) {
    console.error('L ENTERPRISE AUDIT FAILED:', error);
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 });
  }
}