/**
 * Nestor Enterprise Cloud Functions — Admin SDK, scheduled, atomic ops.
 * ADR-032 (Trash) · ADR-029 (Search)
 */

// 🔍 SEARCH INDEX TRIGGERS (ADR-029) — single writer of search_documents per entity type.
// Handoff: docs/handoffs/2026-04-22-search-ssot-refactor.md
export {
  onProjectWrite, onBuildingWrite, onFloorWrite, onPropertyWrite, onContactWrite,
  onFileWrite, onParkingWrite, onStorageWrite, onOpportunityWrite,
  onCommunicationWrite, onTaskWrite,
} from './search/indexTriggers';

// 📜 ENTITY AUDIT CDC TRIGGERS (ADR-195 Phase 1 PoC) — dual-write with source='cdc'
// for coverage comparison against the service-layer audit during rollout.
export { auditContactWrite } from './audit/contact-audit-trigger';
// 🧱 PROCUREMENT (ADR-330 Phase 4.5) — material price sync on PO → delivered.
export { materialPriceSyncOnPODelivery } from './procurement/material-price-sync.cf';

// 🖼️ FLOORPLAN BACKGROUND (ADR-340 Phase 7, D4) — ref-count fileId on background
// delete; if 0 references remain, delete files/{fileId} + Storage object.
export { onDeleteFloorplanBackground } from './floorplan-background/onDeleteFloorplanBackground';

// 🏢 FLOOR · UNITS COUNTER (ADR-236) — maintain floors.units on property write.
export { onPropertyWriteFloorUnits } from './aggregation/floorUnitsAggregation';

// 📡 CONVEYANCE CDC RELAY (ADR-905 §6) — files/properties/projects writes → signed webhook → the app,
// where the view's own judges decide which case views get a signal (the ONE signal writer).
export { onConveyanceFileWrite, onConveyancePropertyWrite, onConveyanceProjectWrite } from './conveyance/dependency-relay';

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// 🗑️ ΑΦΑΙΡΕΘΗΚΕ (ADR-899 §2.2 · 2026-10-31): το `scheduledFilePurge` — ΔΕΥΤΕΡΗ αγωγός εκκαθάρισης του κάδου αρχείων,
// παράλληλη με το cron της εφαρμογής (`lib/cron/jobs/file-purge.job.ts` → `purgeFileRecord`, ο ΕΝΑΣ γραφέας). Έσβηνε ΜΟΝΟ
// το `storagePath` (τα συνοδευτικά — μικρογραφίες, σκηνές — έμεναν για πάντα), ο έλεγχος δέσμευσης ήταν καθρέφτης που
// αγνοούσε τη διατήρηση (`isPreserved`) και το σημάδι Πρωτοκόλλου (record), και ό,τι το cron της εφαρμογής ΠΑΡΕΛΕΙΠΕ σκόπιμα
// (κρατημένο, στον κάδο με ληγμένο `purgeAt`) το έσβηνε αυτό λίγες ώρες μετά. Μία αγωγός διαγραφής, όπως Drive/Box.
// ⚠️ Η αφαίρεση από τον κώδικα ΔΕΝ τη σβήνει από το cloud: το `firebase deploy --only functions` ρωτά — απόφαση Giorgio.

// ΑΦΑΙΡΕΘΗΚΑΝ (ADR-873 Φάση 0): callables `manualPurgeFile` + `getTrashStats` —
// μηδέν καταναλωτές, και το `getTrashStats` δεχόταν `data.companyId` από τον
// πελάτη (διαρροή μεταξύ εταιρειών). Η αφαίρεση από τον κώδικα ΔΕΝ τα σβήνει
// από το cloud: το `firebase deploy --only functions` ρωτά για διαγραφή (το
// `--force` διαγράφει χωρίς ερώτηση) — απόφαση Giorgio, ADR-873 §5.

// STORAGE TRIGGERS (ADR-694 mark-and-sweep — ΜΟΝΟ ο sweeper διαγράφει):
//  - onStorageFinalize  → mark-only παρατηρητής, ΜΗΔΕΝ διαγραφή (Α1)
//  - orphanSweeper      → ο μοναδικός destructive δρόμος· dry-run χωρίς
//                         `ORPHAN_SWEEP_ENABLED=true` (Α3)
//  - orphanSpikeAlert   → ADR-327 Layer 3 observability
//  - onDxfProcessedFinalize → DXF thumbnail (άσχετο με custody)
export { onStorageFinalize } from './storage/orphan-cleanup';
export { orphanSweeper } from './storage/orphan-sweeper';
export { onDxfProcessedFinalize } from './storage/dxf-thumbnail-onfinalize';
export { orphanSpikeAlert } from './storage/orphan-spike-alert';
//  - onImageDimensionsFinalize → ADR-899 §3.7: διαστάσεις εικόνας (μετά EXIF) στην εγγραφή + metadata αντικειμένου
export { onImageDimensionsFinalize } from './storage/image-dimensions-onfinalize';

// ADR-895 Φ2 — οι ΙΔΙΟΙ δύο handlers για τον κάδο πρωτοτύπων ΕΕ: gen2 στο `europe-west3`
// (Eventarc: ίδια περιοχή με τον κάδο· bytes ΕΕ επεξεργάζονται μόνο στην ΕΕ). Λεπτά bindings,
// κανένα αντίγραφο σώματος — `storage/regional-storage-triggers.ts`.
export {
  onStorageFinalizeFilesEu,
  onDxfProcessedFinalizeFilesEu,
  onImageDimensionsFinalizeFilesEu,
} from './storage/regional-storage-triggers';
