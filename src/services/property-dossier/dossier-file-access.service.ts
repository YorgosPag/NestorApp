import 'server-only';

/**
 * =============================================================================
 * Ο επαγγελματίας ανοίγει/κατεβάζει αρχείο του **φακέλου ιδιώτη** — ο ΠΡΟΣΑΡΜΟΓΕΑΣ φακέλου της πόρτας αρχείων (ADR-916 Φ-Ε1)
 * =============================================================================
 *
 * **Κρίνε → φάκελος ζωντανός → κρίση εύρους → (κοινός πυρήνας) υπόγραψε → κατέγραψε**, όπως μεταβίβαση και έκδοση:
 * 1. η συμμετοχή: δική του, ενεργή **τώρα** (ο ΕΝΑΣ κριτής `judgeDossierEngagement`)
 * 2. ο φάκελος: ενεργός και ακόμη του κατόχου που κάλεσε (αλλαγή χεριών ⇒ `not-found`)
 * 3. το αρχείο: ανάμεσα στα **έτοιμα** του φακέλου, στο βιβλίο του κατόχου, και **φτάνει** στο εύρος (καρτέλα · όχι
 *    εξαιρεμένο) — η **ίδια** κρίση με τη λίστα της όψης (`dossierFileReach`). Αλλιώς `not-found`, ίδιο με ανύπαρκτο.
 * 4. ίχνος στο **Ιστορικό του φακέλου** (προσωπικό βιβλίο του κατόχου, `performedBy` = ο επαγγελματίας): «Ο δικηγόρος
 *    άνοιξε / κατέβασε έγγραφο — όνομα» — όπως η μεταβίβαση γράφει στην υπόθεση και η έκδοση στο ακίνητο (ADR-916 §10,
 *    2026-11-18· ως τότε έπεφτε **μόνο** στο βιβλίο του αρχείου και ο κάτοχος δεν το έβλεπε). Δεν γράφτηκε ⇒ **ρίχνει** ⇒
 *    `failed`: **κανένας** σύνδεσμος χωρίς ίχνος.
 *
 * ⛔ Η διαδρομή έρχεται **από το έγγραφο**, ποτέ από το σύρμα· `files_personal` και `storage.rules` **δεν** ανοίγουν σε
 *    τρίτον — η πρόσβαση γίνεται **μόνο** εδώ, με σύνδεσμο 15′.
 *
 * @module services/property-dossier/dossier-file-access.service
 */

import type { Firestore } from 'firebase-admin/firestore';

import { isEngaged } from '@/lib/auth/engagement-judge';
import {
  openableFileOf,
  signAndRecordOpening,
  type EngagedFileOpening,
  type EngagedFileRequest,
} from '@/server/engagement-files/engaged-file-opening.server';
import type { DossierEngagement } from '@/types/engagement';
import type { PropertyDossier } from '@/types/property-dossier';
import { recordDossierDocumentOpened } from './dossier-access-audit';
import { hostedDossierOf, judgeDossierEngagement } from './dossier-engagement-host-adapter';
import { readDossierReadyFiles, type DossierReadyFile } from './dossier-media.reader';
import { dossierFileReach } from './dossier-share-reach';

/** Το αρχείο — **μόνο** αν είναι έτοιμο στον φάκελο **και** φτάνει στη συμμετοχή· αλλιώς `null` (≡ ανύπαρκτο). */
async function reachedFile(db: Firestore, dossier: PropertyDossier, engagement: DossierEngagement, fileId: string): Promise<DossierReadyFile | null> {
  const file = (await readDossierReadyFiles(db, dossier)).find((candidate) => candidate.id === fileId);
  return file !== undefined && dossierFileReach(dossier, file, engagement.reach) !== null ? file : null;
}

/** Ο επαγγελματίας ανοίγει/κατεβάζει ένα αρχείο του φακέλου που του δόθηκε. */
export async function openDossierFile(db: Firestore, engagement: DossierEngagement, request: EngagedFileRequest): Promise<EngagedFileOpening> {
  const decision = judgeDossierEngagement(engagement, request.uid, request.nowMs);
  if (!isEngaged(decision.verdict)) return { ok: false, rejection: 'denied', verdict: decision.verdict };
  const dossier = await hostedDossierOf(db, engagement);
  if (!dossier) return { ok: false, rejection: 'not-found' };
  const file = await reachedFile(db, dossier, engagement, request.fileId);
  return signAndRecordOpening({
    file: file === null ? null : openableFileOf(file, request.fileId),
    mode: request.mode,
    record: (opened) => recordDossierDocumentOpened(dossier, request, {
      role: engagement.role, mode: request.mode, fileId: request.fileId, fileName: opened.fileName,
    }),
    logData: { dossierId: dossier.id, fileId: request.fileId },
  });
}
