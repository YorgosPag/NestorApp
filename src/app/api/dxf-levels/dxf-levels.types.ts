import type { ConflictResponseBody } from '@/types/versioning';

export interface DxfLevelDocument {
  id: string;
  name: string;
  order: number;
  isDefault: boolean;
  visible: boolean;
  floorId?: string | null;
  sceneFileId?: string | null;
  sceneFileName?: string | null;
  companyId?: string;
  createdBy?: string;

  // ── ADR-759 Φ3: μεταδεδομένα του ΦΥΛΛΟΥ, από την πινακίδα του τοπογράφου ──────
  // Ανήκουν στο σχέδιο, ΠΟΤΕ στο έργο (ADR-745 §7): ένα έργο έχει δεκάδες σχέδια σε άλλες
  // κλίμακες και ημερομηνίες — γραμμένα στο έργο, το τελευταίο που ανοίγεις σβήνει το προηγούμενο.
  //
  // ⚠️ **Τρεις θέσεις, όχι δύο.** Ο τύπος από μόνος του δεν αποθηκεύει τίποτα: το
  // `UpdateDxfLevelSchema` πρέπει να τα δηλώνει **και** ο `handleUpdateDxfLevel` να τα αντιγράφει
  // ρητά στο `updates` — η λίστα εκεί είναι **allowlist**, όχι spread (βλ. σχόλιο στο schema).

  /** «ΙΟΥΛΙΟΣ 2026» — ό,τι γράφει η πινακίδα, **ως κείμενο**: δεν είναι πάντα πλήρης ημερομηνία. */
  studyDate?: string | null;
  /** «ΤΟΠΟΓΡΑΦΙΚΟ ΔΙΑΓΡΑΜΜΑ» — το είδος όπως το δηλώνει ο συντάκτης του σχεδίου. */
  drawingType?: string | null;
  /**
   * «1:200» — η κλίμακα του **ξένου** σχεδίου, ως κείμενο.
   *
   * 🔴 **ΔΕΝ είναι το `bimRenderSettings.drawingScale`** παρότι «ταιριάζει». Εκείνο είναι η
   * **δική μας** κλίμακα απόδοσης (οδηγεί πάχη γραμμών και μεγέθη συμβόλων)· αυτό είναι δήλωση
   * του τοπογράφου. Συγχωνευμένα, μια ανάγνωση πινακίδας θα άλλαζε **πώς ζωγραφίζει** ο Νέστωρ.
   */
  scale?: string | null;
  /** «Τ1» — ο αριθμός φύλλου **του συντάκτη**, ανεξάρτητος από το `sheetNumberOverride` (ADR-651). */
  drawingNumber?: string | null;

  [key: string]: unknown;
}

export type DxfLevelsListSuccess = {
  success: true;
  levels: DxfLevelDocument[];
  stats: {
    totalLevels: number;
    floorId?: string;
  };
  message?: string;
};

export type DxfLevelsListError = {
  success: false;
  error: string;
  details?: string;
};

export type DxfLevelsListResponse = DxfLevelsListSuccess | DxfLevelsListError;

export interface DxfLevelCreateResponse {
  levelId: string;
}

export type DxfLevelUpdateResponse =
  | { success: true; message: string; _v?: number }
  | { success: false; error: string; details?: string }
  | ConflictResponseBody;

export type DxfLevelDeleteResponse =
  | { success: true; message: string }
  | { success: false; error: string; details?: string };
