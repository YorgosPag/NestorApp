/**
 * @fileoverview **ΤΙ ΕΓΓΡΑΦΟ `files_personal` ΓΕΝΝΑ Η ΕΠΙΒΕΒΑΙΩΣΗ ΠΕΡΙΓΡΑΜΜΑΤΟΣ** — το σχέδιο του τοπογράφου (ADR-920 §14.11 Ζ3 · Π3).
 * @related lib/listings/terrain-file-record (ο αδελφός: η ΠΗΓΗ εδάφους) · config/upload-entry-points/entries-studies
 *   (`study-admin-topographic`) · lib/terrain/plot-outline/plot-outline-confirmation (το περίγραμμα που κουβαλά)
 * @module lib/listings/topographic-drawing-file-record
 *
 * 🔑 **ΕΓΓΡΑΦΟ ΤΟΥ ΑΝΘΡΩΠΟΥ, ΟΧΙ ΑΡΧΕΙΟ ΛΕΙΤΟΥΡΓΙΑΣ** — αντίθετα με την πηγή εδάφους (JSON του διακομιστή, αόρατο). Γεννιέται
 * με τα **ίδια** domain/category/purpose με την είσοδο «Τοπογραφικό Διάγραμμα» του φακέλου, άρα φαίνεται εκεί όπου ο άνθρωπος
 * ήδη βάζει τοπογραφικά: στην **πρώτη** καρτέλα («Τοπογραφικό» στη γη — Giorgio 2026-09-19, άγκυρα Α38.1), ποτέ στα «Έγγραφα».
 * Όπως στο Procore τα σχέδια έχουν δικό τους εργαλείο, χωριστό από τα έγγραφα. Οι τιμές **διαβάζονται** από την είσοδο,
 * δεν αντιγράφονται: αν η είσοδος μετακομίσει, το σχέδιο μετακομίζει μαζί της.
 *
 * 🔒 **ΙΔΙΩΤΙΚΟ ΑΠΟ ΚΟΥΝΙΑ** (Π8): **χωρίς** `classification` ⇒ ιδιωτικό (ο φρουρός δημοσίευσης ρωτά `=== 'public'`). Το
 * διάγραμμα ονομάζει όμορους και είναι έργο του τοπογράφου· βγαίνει μόνο με ρητή πράξη του ανθρώπου, όπως κάθε αρχείο του.
 *
 * 🔑 **Η ΤΑΥΤΟΤΗΤΑ `terrain/plot-drawing`** κάνει δύο δουλειές: (α) νέο σχέδιο **διαδέχεται** το προηγούμενο (ISO 19650) με
 * τον **ίδιο** κριτή διαδοχής του υλικού· (β) είναι η **κηδεμονία** του περιγράμματος — το πεδίο δεν το γράφει ποτέ πελάτης
 * (`publicationBornAbsent`), άρα μόνο σχέδιο που γέννησε ο server δίνει «επιβεβαιωμένο περίγραμμα».
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import { canonicalMimeForExt } from '@/config/file-types/classification-registry';
import { findEntryPoint } from '@/config/upload-entry-points';
import type { UploadEntryPoint } from '@/config/upload-entry-points/types';
import type { SurveyFileKind } from '@/lib/terrain/survey-import/survey-file-kind';
import { buildPendingFileRecordData, type BuildPendingFileRecordResult } from '@/services/file-record';

/** Η ταυτότητα του σχεδίου του περιγράμματος — ΕΝΑ ανά φάκελο, αδελφό πρόθεμα του `terrain/measured`. */
export const TOPOGRAPHIC_DRAWING_IDENTITY = 'terrain/plot-drawing';

/** Η είσοδος του φακέλου όπου ζει κάθε τοπογραφικό διάγραμμα — η ΜΙΑ απάντηση στο «σε ποια καρτέλα;». */
export const TOPOGRAPHIC_DRAWING_ENTRY_POINT_ID = 'study-admin-topographic';

/** Τα δύο είδη που η πόρτα ξέρει να ξαναδιαβάσει (Π10: το DWG αρνείται ως τότε) — υποσύνολο του ΕΝΟΣ λεξιλογίου ειδών. */
export type TopographicDrawingKind = Extract<SurveyFileKind, 'dxf' | 'pdf'>;

export interface TopographicDrawingFileRequest {
  readonly home: { readonly userId: string; readonly dossierId: string };
  readonly createdBy: string;
  readonly kind: TopographicDrawingKind;
  /** Το όνομα που έδωσε ο άνθρωπος — εμφανίζεται στον φάκελο· η διαδρομή αποθήκευσης είναι μόνο από ID. */
  readonly originalFilename: string;
}

/** Η είσοδος του φακέλου — δηλωμένη στο config· η απουσία της είναι σφάλμα προγραμματισμού, όχι άρνηση του ανθρώπου. */
function topographicEntryPoint(): UploadEntryPoint {
  const entry = findEntryPoint(ENTITY_TYPES.PROPERTY_DOSSIER, TOPOGRAPHIC_DRAWING_ENTRY_POINT_ID);
  if (entry === undefined) throw new Error(`Upload entry point «${TOPOGRAPHIC_DRAWING_ENTRY_POINT_ID}» is not offered by the dossier`);
  return entry;
}

/** 🏆 **Το έγγραφο του σχεδίου στον φάκελο** — σε αναμονή (`PENDING`), όπως κάθε ανέβασμα. */
export function buildTopographicDrawingFileRecord(request: TopographicDrawingFileRequest): BuildPendingFileRecordResult {
  const { domain, category, purpose } = topographicEntryPoint();
  return buildPendingFileRecordData({
    userId: request.home.userId,
    entityType: ENTITY_TYPES.PROPERTY_DOSSIER,
    entityId: request.home.dossierId,
    domain,
    category,
    purpose,
    // Ο τύπος από το ΕΙΔΟΣ που έκρινε ο server στα bytes, μέσω του μητρώου τύπων — ποτέ το `File.type` του browser.
    contentType: canonicalMimeForExt(request.kind),
    originalFilename: request.originalFilename,
    createdBy: request.createdBy,
    ext: request.kind,
    publicationIdentity: TOPOGRAPHIC_DRAWING_IDENTITY,
  });
}
