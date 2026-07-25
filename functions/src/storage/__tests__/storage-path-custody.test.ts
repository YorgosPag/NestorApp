/**
 * ADR-694 Α2 — κλειδώνει τη σύμβαση κηδεμονίας: **η απουσία απόδειξης ιδιοκτησίας ΔΕΝ
 * είναι απόδειξη ορφανότητας**.
 *
 * Το προηγούμενο μοντέλο ταύτιζε τα δύο και διέγραψε **61 νόμιμα αρχεία σε 13 ημέρες**
 * (28 υφές υλικών, 20 imported meshes, 10 γεωμετρίες μπλοκ, 3 μικρογραφίες — ADR-694 §2.3).
 * Δύο ξεχωριστά σφάλματα, δύο ξεχωριστές ομάδες test εδώ:
 *
 *   1. **Λάθος κλειδί**: για το `…/bim-material-textures/{materialId}/albedo.jpg` έβγαζε
 *      `fileId = "albedo"` (το κανάλι!) αντί για το `materialId` (τον φάκελο).
 *   2. **Λάθος default**: ό,τι δεν αναγνώριζε το θεωρούσε σκουπίδι.
 *
 * Το πιο σημαντικό test του αρχείου είναι το «άγνωστο path → ΠΟΤΕ orphaned»: αυτό είναι
 * που κάνει το 4ο incident αδύνατο για κάθε ΜΕΛΛΟΝΤΙΚΟ υποσύστημα, χωρίς να χρειάζεται
 * κανείς να θυμηθεί τίποτα.
 */

import { resolveCustody } from '../storage-path-custody';
import { candidateKeyFixtures } from './custody-test-fixtures';

describe('resolveCustody — κλειδί ιδιοκτησίας ανά σχήμα path (ADR-694 Α2)', () => {
  const COMPANY = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';
  const MATERIAL = 'bmat_34929e3b-fab1-46a9-90c6-a61b4a223c22';

  it('υφή υλικού: κλειδί = ο ΦΑΚΕΛΟΣ (materialId), όχι το basename «albedo» ← η ρίζα του ADR-694', async () => {
    const db = candidateKeyFixtures({ docs: { [`bim_materials/${MATERIAL}`]: true } });
    const out = await resolveCustody(
      db,
      `companies/${COMPANY}/bim-material-textures/${MATERIAL}/albedo.jpg`,
    );
    expect(out).toEqual({ kind: 'claimed', rule: 'bim-material-textures', ownerId: MATERIAL });
  });

  it('υφή υλικού με ΔΙΑΓΡΑΜΜΕΝΟ υλικό → orphaned (σπασμένη αναφορά = θετική απόδειξη)', async () => {
    const db = candidateKeyFixtures({ docs: {} });
    const out = await resolveCustody(
      db,
      `companies/${COMPANY}/bim-material-textures/${MATERIAL}/normal.png`,
    );
    expect(out).toEqual({ kind: 'orphaned', rule: 'bim-material-textures', ownerId: MATERIAL });
  });

  it('μικρογραφία υλικού: κλειδί = basename χωρίς κατάληξη', async () => {
    const db = candidateKeyFixtures({ docs: { [`bim_materials/${MATERIAL}`]: true } });
    const out = await resolveCustody(
      db,
      `companies/${COMPANY}/bim-material-thumbnails/${MATERIAL}.jpg`,
    );
    expect(out).toEqual({ kind: 'claimed', rule: 'bim-material-thumbnails', ownerId: MATERIAL });
  });

  it('συνημμένο σχολίου: κλειδί = ο ΦΑΚΕΛΟΣ (commentId) — 5 συνημμένα × 2 objects ανά σχόλιο', async () => {
    const commentId = 'cmt_bim_4a10edd4-1b0e-4d1e-9a2f-2b3c4d5e6f70';
    const db = candidateKeyFixtures({ docs: { [`bim_comments/${commentId}`]: true } });
    const out = await resolveCustody(
      db,
      `companies/${COMPANY}/bim-comment-attachments/${commentId}/att_9f2c1d3e.png`,
    );
    expect(out).toEqual({ kind: 'claimed', rule: 'bim-comment-attachments', ownerId: commentId });
  });

  it('μικρογραφία συνημμένου (-thumb) → ΙΔΙΟΣ ιδιοκτήτης· το suffix δεν αλλάζει κλειδί', async () => {
    const commentId = 'cmt_bim_8676c811-77aa-4b2c-8d1e-0f9a8b7c6d5e';
    const db = candidateKeyFixtures({ docs: { [`bim_comments/${commentId}`]: true } });
    const out = await resolveCustody(
      db,
      `companies/${COMPANY}/bim-comment-attachments/${commentId}/att_9f2c1d3e-thumb.jpg`,
    );
    expect(out).toEqual({ kind: 'claimed', rule: 'bim-comment-attachments', ownerId: commentId });
  });

  it('συνημμένο με ΔΙΑΓΡΑΜΜΕΝΟ σχόλιο → orphaned (το σενάριο upload-πέτυχε/create-απέτυχε)', async () => {
    const commentId = 'cmt_bim_10b153e4-3c5d-4e6f-9a0b-1c2d3e4f5a6b';
    const db = candidateKeyFixtures({ docs: {} });
    const out = await resolveCustody(
      db,
      `companies/${COMPANY}/bim-comment-attachments/${commentId}/att_9f2c1d3e.png`,
    );
    expect(out).toEqual({ kind: 'orphaned', rule: 'bim-comment-attachments', ownerId: commentId });
  });

  it('γεωμετρία μπλοκ: κλειδί = blockId (10 τέτοια διαγράφηκαν 18–21/07)', async () => {
    const blockId = 'blklib_13697df4-4b38-4e8b-8dc4-8a44f9bb7814';
    const db = candidateKeyFixtures({ docs: { [`block_library/${blockId}`]: true } });
    const out = await resolveCustody(db, `companies/${COMPANY}/block-library/${blockId}.json`);
    expect(out).toEqual({ kind: 'claimed', rule: 'block-library', ownerId: blockId });
  });

  it('imported mesh: κλειδί σε ΠΕΔΙΟ (params.uploadId), όχι doc id — Ν οντότητες → 1 αρχείο', async () => {
    const uploadId = 'imesh_61eb5fc9-0733-4860-a735-e527ddca570b';
    const db = candidateKeyFixtures({
      query: { [`floorplan_imported_meshes:params.uploadId=${uploadId}`]: 'ent_1' },
    });
    const out = await resolveCustody(
      db,
      `companies/${COMPANY}/projects/proj_1/imported-meshes/${uploadId}.glb`,
    );
    expect(out).toEqual({ kind: 'claimed', rule: 'imported-meshes', ownerId: uploadId });
  });

  it('canonical FileRecord: `…/files/{fileId}.{ext}` (ADR-031)', async () => {
    const db = candidateKeyFixtures({ docs: { 'files/file_abc': true } });
    const out = await resolveCustody(
      db,
      `companies/${COMPANY}/projects/p1/entities/floor/f1/categories/floorplans/files/file_abc.pdf`,
    );
    expect(out).toEqual({ kind: 'claimed', rule: 'files', ownerId: 'file_abc' });
  });
});

describe('resolveCustody — fail-safe default: άγνωστο ⇒ ΠΟΤΕ orphaned (ADR-694 Α1)', () => {
  const COMPANY = 'comp_x';

  it('🔴 ΤΟ ΚΡΙΣΙΜΟ: εντελώς άγνωστο σχήμα path → unknown, ΠΟΤΕ orphaned', async () => {
    const db = candidateKeyFixtures({ docs: {} });
    const out = await resolveCustody(
      db,
      `companies/${COMPANY}/some-future-subsystem/whatever/asset.bin`,
    );
    expect(out).toEqual({ kind: 'unknown', reason: 'no-custody-rule' });
    expect(out.kind).not.toBe('orphaned');
  });

  it.each([
    ['bim_environments', `companies/${COMPANY}/bim_environments/env_1.hdr`],
    ['bim_animations', `companies/${COMPANY}/bim_animations/anim_1/renders/job_1.png`],
    ['engineer-stamps', `companies/${COMPANY}/engineer-stamps/user_1.png`],
    ['quotes', `companies/${COMPANY}/quotes/q_1/portal-file_1.pdf`],
  ])('εκτεθειμένο path χωρίς κανόνα (%s) → unknown, άρα άθικτο', async (_name, path) => {
    const out = await resolveCustody(candidateKeyFixtures({ docs: {} }), path);
    expect(out.kind).toBe('unknown');
  });

  it('μη company-scoped (temp/, cad/) → unknown, εκτός δικαιοδοσίας', async () => {
    const out = await resolveCustody(candidateKeyFixtures({ docs: {} }), 'temp/upload-123.bin');
    expect(out).toEqual({ kind: 'unknown', reason: 'not-company-scoped' });
  });

  it('αποτυχία ερωτήματος Firestore → unknown, ΠΟΤΕ orphaned (μην ενεργείς στα τυφλά)', async () => {
    const db = candidateKeyFixtures({ throwOnGet: true });
    const out = await resolveCustody(
      db,
      `companies/${COMPANY}/bim-material-textures/bmat_1/albedo.jpg`,
    );
    expect(out).toEqual({ kind: 'unknown', reason: 'lookup-failed' });
  });
});

describe('resolveCustody — legacy αναγνώριση μόνο θετικά (ADR-031/312 back-compat)', () => {
  it('path χωρίς κανόνα αλλά με FileRecord claim → claimed μέσω legacy provider', async () => {
    const db = candidateKeyFixtures({ docs: { 'files/legacy_1': true } });
    const out = await resolveCustody(db, 'companies/c1/odd-legacy-folder/legacy_1.pdf');
    expect(out.kind).toBe('claimed');
  });

  it('κανόνας ταιριάζει & owner λείπει, ΑΛΛΑ υπάρχει FileRecord → claimed, όχι orphaned', async () => {
    const db = candidateKeyFixtures({ docs: { 'files/blk_1': true } });
    const out = await resolveCustody(db, 'companies/c1/block-library/blk_1.json');
    expect(out.kind).toBe('claimed');
  });
});
