/**
 * @jest-environment node
 *
 * =============================================================================
 * 🧩 ΑΓΚΥΡΕΣ: ΤΟ PURGE ΣΒΗΝΕΙ ΚΑΙ ΤΑ ΣΥΝΟΔΕΥΤΙΚΑ (ADR-899 §2.2 · ADR-191 document management)
 * =============================================================================
 *
 * | ομάδα | ερώτημα | μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Μ | τα ονόματα του μητρώου = ό,τι **βρέθηκε στον κάδο της παραγωγής** (2026-10-01); | αλλαγή επιθέματος/βάσης |
 * | Μ | ο γραφέας ονομάζει **από το μητρώο**; | επιστροφή του χειρόγραφου `_thumb.webp` |
 * | Φ | ο φρουρός αφήνει ξένα αντικείμενα (στέλεχος ≠ id · άλλος φάκελος · `file_abcd`); | φρουρός `startsWith(stem)` χωρίς id |
 * | Σ | το purge σβήνει **και** το ξεχασμένο `.processed.json` (δείκτης αντικατεστημένος από το CAD); | μόνο δείκτες, χωρίς μητρώο |
 * | Σ | κάθε συνοδευτικό στον **κάδο του γραφέα του** (ΕΕ πρωτότυπο ⇒ client μικρογραφία στον κανονικό); | ένας κάδος για όλα |
 * | Σ | άρνηση σε συνοδευτικό ⇒ η εγγραφή **ΔΕΝ** γίνεται `purged`· 404 ⇒ αθώο | `refused` αγνοημένο |
 * | Σ | δέσμευση στο πρωτότυπο ⇒ **κανένα** συνοδευτικό δεν αγγίζεται | συνοδευτικά πριν από το πρωτότυπο |
 * | Γ | η ΓΚΠΔ περνά την εγγραφή στον ΕΝΑ γραφέα και μηδενίζει τους δείκτες | επιστροφή στο `{ storagePath, storagePlacement }` |
 *
 * Πλαστά μόνο ο δίσκος (`FakeFirestore`) και οι κάδοι — μητρώο, φρουρός, κριτής και γραφέας εκτελούνται αληθινά.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

const LEGACY_BUCKET = 'pagonis-87766.firebasestorage.app';

let fake: FakeFirestore;
/** Κάθε κλήση `delete` ως `κάδος:μονοπάτι`, με τη σειρά που έγινε. */
let deletions: string[] = [];
/** Απάντηση ανά `κάδος:μονοπάτι` — απόν ⇒ επιτυχία. */
let failures: Record<string, number> = {};

function fakeBucket(label: string, name: string) {
  return {
    name,
    file: (path: string) => ({
      delete: async (): Promise<void> => {
        const key = `${label}:${path}`;
        deletions.push(key);
        const code = failures[key];
        if (code !== undefined) throw Object.assign(new Error(`code ${code}`), { code });
      },
    }),
  };
}

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
  FieldValue: { serverTimestamp: () => ({ __fieldValue: 'serverTimestamp' }) },
  getAdminBucket: () => fakeBucket('legacy', LEGACY_BUCKET),
  getFilesEuBucket: () => fakeBucket('eu', 'eu-bucket'),
}));
jest.mock('@/services/enterprise-id.service', () => ({ generateAuditId: () => 'audit_test' }));

import {
  FILE_COMPANION_KIND_NAMES,
  fileCompanionPath,
  isCompanionPathOf,
} from '@/lib/files/file-companion-objects';
import { buildThumbnailPath } from '@/components/shared/files/utils/generate-upload-thumbnail';
import { companionTargetsOf } from '../file-companion-purge';
import { purgeFileRecord } from '../file-purge-helpers';

const DIR = 'companies/comp_1/entities/property/prop_1/domains/construction/categories/floorplans/files/';
const DXF_ID = 'file_89f1e53b';
const DXF = `${DIR}${DXF_ID}.dxf`;
const PHOTO_ID = 'file_474b4d3c';
const PHOTO = `${DIR}${PHOTO_ID}.png`;
const firebaseUrl = (path: string, bucket = LEGACY_BUCKET): string =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=t`;

/** Το σχήμα μιας πραγματικής εγγραφής DXF της παραγωγής: ο δείκτης σκηνής **αντικατεστάθη** από το autosave του CAD. */
const dxfRecord = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  companyId: 'comp_1',
  lifecycleState: 'trashed',
  storagePath: DXF,
  thumbnailStoragePath: `${DXF}.thumbnail.png`,
  thumbnailUrl: firebaseUrl(`${DXF}.thumbnail.png`),
  downloadUrl: firebaseUrl(`${DIR}${DXF_ID}.scene.json`),
  processedData: { processedDataPath: `${DIR}${DXF_ID}.scene.json`, processedDataUrl: firebaseUrl(`${DIR}${DXF_ID}.scene.json`) },
  ...extra,
});

beforeEach(() => {
  fake = new FakeFirestore();
  deletions = [];
  failures = {};
});

describe('Μ — το μητρώο ονομάτων', () => {
  it('🔴 Μ1 — τα ονόματα είναι ΑΚΡΙΒΩΣ όσα βρέθηκαν στον κάδο της παραγωγής (2026-10-01)', () => {
    expect(FILE_COMPANION_KIND_NAMES.map((kind) => fileCompanionPath(DXF, kind))).toEqual([
      `${DIR}${DXF_ID}_thumb.webp`,
      `${DXF}_thumb.png`,
      `${DXF}.thumbnail.png`,
      `${DXF}.processed.json`,
      `${DIR}${DXF_ID}.scene.json`,
    ]);
  });

  it('🔴 Μ2 — ο γραφέας μικρογραφίας ανεβάσματος ονομάζει ΑΠΟ το μητρώο (και η τελεία φακέλου δεν είναι κατάληξη)', () => {
    expect(buildThumbnailPath(PHOTO)).toBe(`${DIR}${PHOTO_ID}_thumb.webp`);
    expect(buildThumbnailPath('companies/c.v2/files/file_x')).toBe('companies/c.v2/files/file_x_thumb.webp');
  });

  it('🔴 Μ3 — κανένας γραφέας δεν ξαναγράφει επίθεμα με το χέρι', () => {
    const source = (file: string): string => readFileSync(join(process.cwd(), file), 'utf8');
    expect(source('src/services/floorplans/floorplan-save-orchestrator.ts')).not.toMatch(/`\$\{storagePath\}_thumb/);
    expect(source('src/app/api/floorplans/process/floorplan-process.service.ts')).not.toMatch(/\.processed\.json`/);
    expect(source('src/services/floorplans/dxf-thumbnail-selfheal.ts')).not.toMatch(/'\.thumbnail\.png'/);
    expect(source('functions/src/storage/dxf-thumbnail-onfinalize.ts')).not.toMatch(/'\.thumbnail\.png'|\}\.processed\.json`/);
  });
});

describe('Φ — ο φρουρός: ποτέ ξένο αντικείμενο', () => {
  it.each([
    ['ίδιο το πρωτότυπο', DXF, false],
    ['ίδιο όνομα + επίθεμα', `${DXF}.thumbnail.png`, true],
    ['id + `_`', `${DIR}${DXF_ID}_thumb.webp`, true],
    ['id + `.`', `${DIR}${DXF_ID}.scene.json`, true],
    ['άλλο αρχείο με κοινό πρόθεμα id', `${DIR}${DXF_ID}abcd_thumb.webp`, false],
    ['άλλος φάκελος', `companies/comp_2/files/${DXF_ID}_thumb.webp`, false],
  ] as const)('%s', (_label, candidate, expected) => {
    expect(isCompanionPathOf(DXF_ID, DXF, candidate)).toBe(expected);
  });

  it('🔴 Φ2 — στέλεχος που ΔΕΝ είναι το id ⇒ κανένα συνοδευτικό με βάση το στέλεχος (θα ήταν άλλου αρχείου)', () => {
    const targets = companionTargetsOf({ fileId: 'file_p', storagePath: 'people/u/scan.pdf' }).map((t) => t.path);
    expect(targets).not.toContain('people/u/scan_thumb.webp');
    expect(targets).toContain('people/u/scan.pdf.thumbnail.png');
  });

  it('🔴 Φ3 — δείκτης σε ΞΕΝΟ κάδο ⇒ αγνοείται', () => {
    const targets = companionTargetsOf({
      fileId: PHOTO_ID,
      storagePath: PHOTO,
      thumbnailUrl: firebaseUrl(`${DIR}${PHOTO_ID}_custom.webp`, 'someone-else.appspot.com'),
    }).map((t) => t.path);
    expect(targets).not.toContain(`${DIR}${PHOTO_ID}_custom.webp`);
  });
});

describe('Σ — ο γραφέας του purge', () => {
  it('🔴 Σ1 — πρωτότυπο ΠΡΩΤΟ, μετά κάθε συνοδευτικό — και το ξεχασμένο `.processed.json`', async () => {
    fake.seed(COLLECTIONS.FILES, DXF_ID, dxfRecord());

    const result = await purgeFileRecord({
      fileId: DXF_ID, custody: 'company', storagePath: DXF, performedBy: 'system:cron-purge', purgeReason: 'cron_trash',
    });

    expect(result).toEqual({ success: true, storageDeleted: true });
    expect(deletions[0]).toBe(`legacy:${DXF}`);
    expect(deletions).toEqual(expect.arrayContaining([
      `legacy:${DXF}.processed.json`,
      `legacy:${DXF}.thumbnail.png`,
      `legacy:${DIR}${DXF_ID}.scene.json`,
      `legacy:${DIR}${DXF_ID}_thumb.webp`,
    ]));
    expect(new Set(deletions).size).toBe(deletions.length);
  });

  it('🔴 Σ2 — πρωτότυπο στην ΕΕ: τα δίπλα-στο-πρωτότυπο στον κάδο ΕΕ, οι μικρογραφίες του client στον κανονικό', () => {
    const targets = companionTargetsOf({ fileId: PHOTO_ID, storagePath: PHOTO, storagePlacement: 'eu-originals' });
    const at = (path: string): string[] => targets.filter((t) => t.path === path).map((t) => t.placement);
    expect(at(`${PHOTO}.processed.json`)).toEqual(['eu-originals']);
    expect(at(`${DIR}${PHOTO_ID}_thumb.webp`)).toEqual(['legacy-default']);
  });

  it('🔴 Σ3 — συνοδευτικό αρνείται (403) ⇒ η εγγραφή ΔΕΝ γίνεται `purged`', async () => {
    fake.seed(COLLECTIONS.FILES, PHOTO_ID, { companyId: 'comp_1', lifecycleState: 'trashed', storagePath: PHOTO });
    failures[`legacy:${DIR}${PHOTO_ID}_thumb.webp`] = 403;

    const result = await purgeFileRecord({
      fileId: PHOTO_ID, custody: 'company', storagePath: PHOTO, performedBy: 'system:cron-purge', purgeReason: 'cron_trash',
    });

    expect(result).toEqual({ success: false, storageDeleted: false, error: 'storage-deletion-refused' });
    expect(fake.all<{ lifecycleState: string }>(COLLECTIONS.FILES)[0].lifecycleState).toBe('trashed');
  });

  it('🔑 Σ4 — παρονομαστής: συνοδευτικά που λείπουν (404) ⇒ αθώο, η εγγραφή γίνεται `purged`', async () => {
    fake.seed(COLLECTIONS.FILES, PHOTO_ID, { companyId: 'comp_1', lifecycleState: 'trashed', storagePath: PHOTO });
    failures[`legacy:${DIR}${PHOTO_ID}_thumb.webp`] = 404;

    const result = await purgeFileRecord({
      fileId: PHOTO_ID, custody: 'company', storagePath: PHOTO, performedBy: 'system:cron-purge', purgeReason: 'cron_trash',
    });

    expect(result).toEqual({ success: true, storageDeleted: true });
    expect(fake.all<{ lifecycleState: string }>(COLLECTIONS.FILES)[0].lifecycleState).toBe('purged');
  });

  it('🔴 Σ5 — δέσμευση στο πρωτότυπο ⇒ ΚΑΝΕΝΑ συνοδευτικό δεν αγγίζεται', async () => {
    fake.seed(COLLECTIONS.FILES, DXF_ID, dxfRecord());
    failures[`legacy:${DXF}`] = 403;

    const result = await purgeFileRecord({
      fileId: DXF_ID, custody: 'company', storagePath: DXF, performedBy: 'system:cron-purge', purgeReason: 'cron_trash',
    });

    expect(result.success).toBe(false);
    expect(deletions).toEqual([`legacy:${DXF}`]);
  });
});

describe('Γ — η ΓΚΠΔ περνά από τον ΕΝΑ γραφέα', () => {
  const route = readFileSync(join(process.cwd(), 'src/app/api/files/gdpr-delete/route.ts'), 'utf8');

  it('🔴 Γ1 — δίνει στον γραφέα ΟΛΗ την εγγραφή + το id (αλλιώς δεν βλέπει δείκτες ούτε στέλεχος)', () => {
    expect(route).toMatch(/deleteStorageObjectForPurge\(\{ \.\.\.data, fileId: fileDoc\.id, storagePath \}\)/);
  });

  it('🔴 Γ2 — μηδενίζει τους δείκτες συνοδευτικών από το ΙΔΙΟ μητρώο', () => {
    expect(route).toMatch(/FILE_COMPANION_POINTER_FIELDS/);
    expect(route).toMatch(/storagePath: null,\s*\.\.\.COMPANION_POINTERS_ERASED,/);
  });
});
