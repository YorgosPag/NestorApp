import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, deleteDoc, doc, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

/**
 * 🏢 ENTERPRISE: API για καθαρισμό διπλότυπων μονάδων
 *
 * Αυτό το endpoint:
 * 1. Βρίσκει όλες τις μονάδες με το ίδιο όνομα
 * 2. Κρατάει μόνο την πρώτη (την παλαιότερη)
 * 3. Διαγράφει τις υπόλοιπες
 *
 * @method GET - Προεπισκόπηση διπλότυπων (dry run)
 * @method DELETE - Πραγματικός καθαρισμός
 */

interface UnitRecord {
  id: string;
  name: string;
  buildingId?: string;
  floorId?: string;
}

export async function GET() {
  try {
    console.log('🔍 Analyzing duplicate units...');

    const unitsQuery = query(collection(db, COLLECTIONS.UNITS));
    const snapshot = await getDocs(unitsQuery);

    const units: UnitRecord[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      units.push({
        id: doc.id,
        name: data.name || 'UNNAMED',
        buildingId: data.buildingId,
        floorId: data.floorId,
      });
    });

    // Group by name
    const groupedByName = new Map<string, UnitRecord[]>();
    units.forEach((unit) => {
      const existing = groupedByName.get(unit.name) || [];
      existing.push(unit);
      groupedByName.set(unit.name, existing);
    });

    // Find duplicates (more than 1 unit with same name)
    const duplicateGroups: Array<{ name: string; keep: UnitRecord; toDelete: UnitRecord[] }> = [];
    let totalToDelete = 0;

    groupedByName.forEach((group, name) => {
      if (group.length > 1) {
        // Keep the first one, delete the rest
        const [keep, ...toDelete] = group;
        duplicateGroups.push({ name, keep, toDelete });
        totalToDelete += toDelete.length;
      }
    });

    return NextResponse.json({
      success: true,
      mode: 'preview',
      totalUnits: units.length,
      uniqueNames: groupedByName.size,
      duplicateGroups: duplicateGroups.length,
      totalToDelete,
      afterCleanup: units.length - totalToDelete,
      details: duplicateGroups.map((g) => ({
        name: g.name,
        keepId: g.keep.id,
        deleteIds: g.toDelete.map((u) => u.id),
        deleteCount: g.toDelete.length,
      })),
      message: `Found ${totalToDelete} duplicate units to delete. Use DELETE method to execute cleanup.`,
    });
  } catch (error) {
    console.error('❌ Error analyzing duplicates:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze duplicates',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🧹 Starting duplicate cleanup...');

    const unitsQuery = query(collection(db, COLLECTIONS.UNITS));
    const snapshot = await getDocs(unitsQuery);

    const units: UnitRecord[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      units.push({
        id: doc.id,
        name: data.name || 'UNNAMED',
        buildingId: data.buildingId,
        floorId: data.floorId,
      });
    });

    // Group by name
    const groupedByName = new Map<string, UnitRecord[]>();
    units.forEach((unit) => {
      const existing = groupedByName.get(unit.name) || [];
      existing.push(unit);
      groupedByName.set(unit.name, existing);
    });

    // Collect IDs to delete
    const idsToDelete: string[] = [];
    const deletedDetails: Array<{ name: string; deletedIds: string[] }> = [];

    groupedByName.forEach((group, name) => {
      if (group.length > 1) {
        // Keep the first one, delete the rest
        const [_keep, ...toDelete] = group;
        const deleteIds = toDelete.map((u) => u.id);
        idsToDelete.push(...deleteIds);
        deletedDetails.push({ name, deletedIds: deleteIds });
      }
    });

    if (idsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No duplicates found to delete',
        deleted: 0,
      });
    }

    // Delete duplicates
    console.log(`🗑️ Deleting ${idsToDelete.length} duplicate units...`);

    let deletedCount = 0;
    const errors: string[] = [];

    for (const id of idsToDelete) {
      try {
        await deleteDoc(doc(db, COLLECTIONS.UNITS, id));
        deletedCount++;
        console.log(`✅ Deleted: ${id}`);
      } catch (err) {
        console.error(`❌ Failed to delete ${id}:`, err);
        errors.push(id);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} duplicate units`,
      deleted: deletedCount,
      failed: errors.length,
      failedIds: errors.length > 0 ? errors : undefined,
      details: deletedDetails,
      remainingUnits: units.length - deletedCount,
    });
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cleanup duplicates',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
