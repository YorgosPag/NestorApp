import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';

export const dynamic = 'force-dynamic';

/** Firestore document data — avoids `any` */
type DocData = Record<string, unknown>;

/** Summarised file record for the JSON response */
interface FileSummary {
  id: string;
  entityType: unknown;
  entityId: unknown;
  companyId: unknown;
  domain: unknown;
  category: unknown;
  purpose: unknown;
  status: unknown;
  isDeleted: unknown;
  ext: unknown;
  contentType: unknown;
  originalFilename: unknown;
  downloadUrl: 'EXISTS' | 'MISSING';
}

function summariseFile(doc: DocData & { id: string }): FileSummary {
  return {
    id: doc.id,
    entityType: doc.entityType,
    entityId: doc.entityId,
    companyId: doc.companyId,
    domain: doc.domain,
    category: doc.category,
    purpose: doc.purpose,
    status: doc.status,
    isDeleted: doc.isDeleted,
    ext: doc.ext,
    contentType: doc.contentType,
    originalFilename: doc.originalFilename,
    downloadUrl: doc.downloadUrl ? 'EXISTS' : 'MISSING',
  };
}

export const GET = async (request: NextRequest) => {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const unitId = req.nextUrl.searchParams.get('unitId');
      if (!unitId) {
        return NextResponse.json({ error: 'unitId query parameter is required' }, { status: 400 });
      }

      const db = getAdminFirestore();

      // 1. Get unit document
      const unitDoc = await db.collection(COLLECTIONS.UNITS).doc(unitId).get();
      const unitData = unitDoc.exists ? (unitDoc.data() as DocData) : null;

      // 2. Get floor document if floorId exists
      const floorId = (unitData?.floorId as string) ?? null;
      let floorData: (DocData & { id: string }) | null = null;
      if (floorId) {
        const floorDoc = await db.collection(COLLECTIONS.FLOORS).doc(floorId).get();
        floorData = floorDoc.exists
          ? { id: floorDoc.id, ...(floorDoc.data() as DocData) }
          : null;
      }

      // 3. Query files collection for floor records
      let floorFiles: (DocData & { id: string })[] = [];
      if (floorId) {
        const floorFilesSnap = await db
          .collection(COLLECTIONS.FILES)
          .where(FIELDS.ENTITY_TYPE, '==', 'floor')
          .where(FIELDS.ENTITY_ID, '==', floorId)
          .get();
        floorFiles = floorFilesSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as DocData),
        }));
      }

      // 4. Query files collection for unit floorplan records
      const unitFilesSnap = await db
        .collection(COLLECTIONS.FILES)
        .where(FIELDS.ENTITY_TYPE, '==', 'unit')
        .where(FIELDS.ENTITY_ID, '==', unitId)
        .where('category', '==', 'floorplans')
        .get();
      const unitFiles: (DocData & { id: string })[] = unitFilesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as DocData),
      }));

      // 5. Legacy floor_floorplans collection
      let legacyFloorplans: (DocData & { id: string })[] = [];
      if (floorId) {
        const legacySnap = await db
          .collection(COLLECTIONS.FLOOR_FLOORPLANS)
          .where(FIELDS.FLOOR_ID, '==', floorId)
          .get();
        legacyFloorplans = legacySnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as DocData),
        }));
      }

      return NextResponse.json({
        unitId,
        unit: unitData
          ? {
              floorId: unitData.floorId,
              buildingId: unitData.buildingId,
              companyId: unitData.companyId,
              name: unitData.name,
              floor: unitData.floor,
            }
          : null,
        floorId,
        floor: floorData,
        floorFiles: {
          count: floorFiles.length,
          records: floorFiles.map(summariseFile),
        },
        unitFloorplanFiles: {
          count: unitFiles.length,
          records: unitFiles.map(summariseFile),
        },
        legacyFloorplans: {
          count: legacyFloorplans.length,
          records: legacyFloorplans,
        },
      });
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
};
