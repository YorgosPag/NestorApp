/**
 * Κοινόχρηστος χώρος κτιρίου — το σχήμα του εγγράφου `common_spaces` (ADR-931).
 *
 * Ανήκει στο **κτίριο** (`buildingId` υποχρεωτικό), όχι σε μονάδα, και προαιρετικά
 * φιλοξενείται σε όροφο (ADR-903 §6 — Revit `LevelId`). **Δεν** έχει εμπορικά πεδία:
 * κατά ΑΚ 1117 τα κοινόχρηστα δεν μεταβιβάζονται αυτοτελώς, άρα ούτε τιμή ούτε διάθεση.
 *
 * @see src/constants/common-space-categories.ts — το λεξιλόγιο (κατηγορία · φύση)
 * @see docs/centralized-systems/reference/adrs/ADR-931-common-spaces-entity.md
 */

import type { CommonSpaceCategory, CommonSpaceLegalNature } from '@/constants/common-space-categories';
import type { RecordLifecycleStatus } from '@/lib/firestore/trashed-status';
import type { OperationalStatus } from '@/constants/operational-statuses';
import type { HostedOnFloor } from '@/lib/floor/hosted-floor';
import type { CommonSpaceAreaSource } from '@/lib/common-spaces/common-space-area';

export interface CommonSpace {
  id: string;
  /** Ανθρώπινο όνομα, π.χ. «Κλιμακοστάσιο Α». */
  name: string;
  /** Ελεύθερος κωδικός (Revit Room Number). */
  code?: string;
  category: CommonSpaceCategory;
  legalNature: CommonSpaceLegalNature;
  /** Μόνο για `exclusive_use`: οι ιδιοκτησίες (ίδιου κτιρίου) που έχουν την αποκλειστική χρήση. */
  exclusiveUsePropertyIds?: string[];
  /** Κύκλος ζωής εγγραφής — ζωντανή ή στον κάδο (ADR-281). */
  status: RecordLifecycleStatus;
  /** Φυσική χρηστικότητα — ίδιο λεξιλόγιο με ακίνητα/αποθήκες (ADR-777 §8.60.20). */
  operationalStatus?: OperationalStatus;
  buildingId: string;
  projectId?: string;
  companyId?: string;
  linkedCompanyId?: string | null;
  /** ADR-903 §6 — `floorId` = αυθεντία · `floor`/`floorKind` = αντίγραφο του server. Απόν = εκτείνεται σε όλο το κτίριο. */
  floorId?: HostedOnFloor['floorId'];
  floor?: HostedOnFloor['floor'];
  floorKind?: HostedOnFloor['floorKind'];
  /** Καθαρό εμβαδόν σε m² — η **ενεργή** τιμή· απόν = αδήλωτο (ποτέ 0 ως «άγνωστο»). */
  area?: number;
  /**
   * ADR-931 Β1 — Σ εμβαδών (m²) των περιγραμμάτων κάτοψης που δένουν τον χώρο. Το γράφει **μόνο ο server**·
   * απόν = δεν σχεδιάστηκε σε καμία κάτοψη.
   */
  drawnArea?: number;
  /** ADR-931 Β1 — `drawn` ⇒ το `area` ακολουθεί το σχέδιο· απόν/`declared` ⇒ το `area` το δήλωσε άνθρωπος. */
  areaSource?: CommonSpaceAreaSource;
  description?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  /** SPEC-256A: μετρητής έκδοσης για αισιόδοξο έλεγχο σύγκρουσης. */
  _v?: number;
}
