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
      const propertyId = req.nextUrl.searchParams.get('propertyId');
      if (!propertyId) {
        return NextResponse.json({ error: 'propertyId query parameter is required' }, { status: 400 });
      }

      const db = getAdminFirestore();

      // 1. Get property document
      const propertyDoc = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
      const propertyData = propertyDoc.exists ? (propertyDoc.data() as DocData) : null;

      // 2. Get floor document if floorId exists
      const floorId = (propertyData?.floorId as string) ?? null;
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

      // 4. Query files collection for property floorplan records
      const propertyFilesSnap = await db
        .collection(COLLECTIONS.FILES)
        .where(FIELDS.ENTITY_TYPE, '==', 'property')
        .where(FIELDS.ENTITY_ID, '==', propertyId)
        .where('category', '==', 'floorplans')
        .get();
      const propertyFiles: (DocData & { id: string })[] = propertyFilesSnap.docs.map((d) => ({
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
        propertyId,
        property: propertyData
          ? {
              floorId: propertyData.floorId,
              buildingId: propertyData.buildingId,
              companyId: propertyData.companyId,
              name: propertyData.name,
              floor: propertyData.floor,
            }
          : null,
        floorId,
        floor: floorData,
        floorFiles: {
          count: floorFiles.length,
          records: floorFiles.map(summariseFile),
        },
        propertyFloorplanFiles: {
          count: propertyFiles.length,
          records: propertyFiles.map(summariseFile),
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
