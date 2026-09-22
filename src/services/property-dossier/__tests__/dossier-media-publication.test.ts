/**
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Α41.1 · Α41.2 του ADR-866 Φ1.3** — «ποια αρχεία του φακέλου φεύγουν, και ως τι;»
 * @related ADR-866 §2.11 · services/property-dossier/dossier-media-publication · lib/owner-property/owner-media-publication
 *
 * 🔑 **Κανένα mock**: ο επιλογέας ρωτά τις **πραγματικές** εμβέλειες καρτέλας του φακέλου (`propertyDossierFileTabOf` →
 * `mediaTabScopePolicy` → `matchesFileScopes`). Τα σχήματα αρχείων είναι αυτά που **μετρήθηκαν** στην παραγωγή
 * (`files_personal`, 2026-09-22): φωτογραφία `sales/photos/view`, πρόοδος `construction/photos/progress`, τοπογραφικό
 * `admin/documents/study-topographic`.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | αδήλωτο αρχείο φεύγει (π.χ. `orderByDeclaration` αντί φίλτρου δήλωσης) | Α41.1 «αδήλωτο» |
 * | η σειρά από τα αρχεία, όχι από τη δήλωση | Α41.1 «σειρά» |
 * | χωρίς έλεγχο κατόχου (`entityId`/`userId`) | Α41.1 «ξένο» |
 * | κατηγορία αντί καρτέλας (`floorplans` ⇒ κάτοψη) | Α41.1 «τοπογραφικό» |
 * | πτώση στο `media[]` όταν υπάρχει φάκελος | Α41.2 |
 */

import {
  dossierMediaMaterial,
  publishedDossierMediaSources,
  type DossierMediaCandidate,
  type DossierMediaOwner,
} from '../dossier-media-publication';
import { ownerListingMediaSources } from '@/lib/owner-property/owner-media-publication';
import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';
import type { OwnerPropertyMedia } from '@/types/owner-property';

const DOSSIER: DossierMediaOwner = { id: 'pdos_a', label: 'Σπίτι', userId: 'user-1', type: 'land' };
const AT = '2026-09-22T10:41:33.000Z';

function file(id: string, over: Partial<DossierMediaCandidate> = {}): DossierMediaCandidate {
  return {
    id,
    entityType: 'property_dossier',
    entityId: DOSSIER.id,
    userId: DOSSIER.userId,
    storagePath: `people/user-1/entities/property_dossier/pdos_a/domains/sales/categories/photos/files/${id}.png`,
    contentType: 'image/png',
    status: 'ready',
    lifecycleState: 'active',
    isDeleted: false,
    createdAt: AT,
    domain: 'sales',
    category: 'photos',
    purpose: 'view',
    ...over,
  };
}

const VIEW = file('file_view');
const PROGRESS = file('file_progress', { domain: 'construction', purpose: 'progress' });
const TOPOGRAPHIC = file('file_topo', { domain: 'admin', category: 'documents', purpose: 'study-topographic' });
const TITLE_DEED = file('file_deed', { domain: 'admin', category: 'documents', purpose: 'study-title-deed' });

function paths(sources: ReturnType<typeof publishedDossierMediaSources>): string[] {
  return sources.map((source) => source.privateStoragePath.split('/').pop() ?? '');
}

describe('Α41.1 — η δήλωση ΕΙΝΑΙ η εξουσιοδότηση, η καρτέλα ΕΙΝΑΙ το υλικό', () => {
  it('αδήλωτο αρχείο ΔΕΝ φεύγει, όσο κατάλληλο κι αν είναι', () => {
    expect(paths(publishedDossierMediaSources(DOSSIER, [VIEW, PROGRESS], ['file_view']))).toEqual(['file_view.png']);
  });

  it('η σειρά είναι της ΔΗΛΩΣΗΣ, όχι των αρχείων', () => {
    const sources = publishedDossierMediaSources(DOSSIER, [VIEW, PROGRESS], ['file_progress', 'file_view']);
    expect(paths(sources)).toEqual(['file_progress.png', 'file_view.png']);
  });

  it('τοπογραφικό (admin/documents) φεύγει ως ΚΑΤΟΨΗ — η καρτέλα της σελίδας, όχι η κατηγορία', () => {
    expect(dossierMediaMaterial(DOSSIER, TOPOGRAPHIC)).toEqual({ kind: 'floorplan', at: AT });
    expect(dossierMediaMaterial(DOSSIER, PROGRESS)).toEqual({ kind: 'photo' });
  });

  it('έγγραφα (συμβόλαιο, τίτλος) ΔΕΝ φεύγουν ποτέ, ακόμη κι αν δηλωθούν', () => {
    expect(publishedDossierMediaSources(DOSSIER, [TITLE_DEED], ['file_deed'])).toEqual([]);
  });

  it('ξένο αρχείο (άλλος φάκελος · άλλος κάτοχος) αγνοείται — ζώνη ασφαλείας πάνω από τον αναγνώστη', () => {
    const otherDossier = file('file_x', { entityId: 'pdos_other' });
    const otherOwner = file('file_y', { userId: 'user-2' });
    expect(publishedDossierMediaSources(DOSSIER, [otherDossier, otherOwner], ['file_x', 'file_y'])).toEqual([]);
  });

  it('μη έτοιμο · στα σκουπίδια · μη εικόνα ⇒ δεν φεύγει', () => {
    const files = [
      file('file_pending', { status: 'pending' }),
      file('file_trashed', { isDeleted: true, lifecycleState: 'trashed' }),
      file('file_dxf', { domain: 'construction', category: 'floorplans', purpose: 'property-floorplan', contentType: 'application/dxf' }),
    ];
    expect(publishedDossierMediaSources(DOSSIER, files, files.map((f) => f.id))).toEqual([]);
  });

  it('διπλή ταυτότητα μετρά μία φορά · όριο ραφιού', () => {
    const many = Array.from({ length: PUBLISHED_MEDIA_LIMIT + 3 }, (_, i) => file(`file_${i}`));
    const declared = ['file_0', 'file_0', ...many.map((f) => f.id)];
    const sources = publishedDossierMediaSources(DOSSIER, many, declared);
    expect(sources).toHaveLength(PUBLISHED_MEDIA_LIMIT);
    expect(new Set(paths(sources)).size).toBe(PUBLISHED_MEDIA_LIMIT);
  });
});

describe('Α41.2 — ΜΙΑ πηγή βιτρίνας, διπλή ανάγνωση: ο διακόπτης είναι η ΥΠΑΡΞΗ φακέλου', () => {
  const legacy: OwnerPropertyMedia[] = [
    { storagePath: 'owner_properties/user-1/ownp_a/old.png', fileName: 'old.png', sizeBytes: 1, uploadedAt: AT, published: true },
  ];
  const read = { dossier: DOSSIER, files: [VIEW] };

  it('χωρίς φάκελο ⇒ το παλιό `media[]`, αυτούσιο', () => {
    expect(ownerListingMediaSources({ media: legacy }, null).map((s) => s.privateStoragePath)).toEqual([
      'owner_properties/user-1/ownp_a/old.png',
    ]);
  });

  it('με φάκελο ⇒ η δήλωση πάνω στον φάκελο — το `media[]` ΔΕΝ διαβάζεται', () => {
    const listing = { media: legacy, dossierId: 'pdos_a', publishedFileIds: ['file_view'] };
    expect(paths(ownerListingMediaSources(listing, read))).toEqual(['file_view.png']);
  });

  it('με φάκελο και ΚΕΝΗ δήλωση ⇒ τίποτα (όχι πτώση στο `media[]`)', () => {
    expect(ownerListingMediaSources({ media: legacy, dossierId: 'pdos_a' }, read)).toEqual([]);
  });

  it('με φάκελο που δεν διαβάστηκε ή είναι ΑΛΛΟΣ ⇒ τίποτα', () => {
    const listing = { media: legacy, dossierId: 'pdos_a', publishedFileIds: ['file_view'] };
    expect(ownerListingMediaSources(listing, null)).toEqual([]);
    expect(ownerListingMediaSources({ ...listing, dossierId: 'pdos_b' }, read)).toEqual([]);
  });
});
