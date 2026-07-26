/**
 * Column foundation stub («κοντόστυλο») quantity split — SSoT (ADR-712).
 *
 * Η κολώνα που εδράζεται σε πέδιλο **επιμηκύνεται προς τα κάτω** ως την άνω παρειά του
 * (ADR-489 §6.1, `baseDropMm`). Μέχρι σήμερα αυτό ζούσε ΜΟΝΟ στο 3Δ render
 * (`bim-three-structural-converters`): το τμήμα από τη nominal βάση της κολώνας ως την άνω
 * παρειά του πεδίλου **δεν το χρέωνε κανείς** — ούτε η κολώνα (ξεκινά στη nominal βάση)
 * ούτε το πέδιλο (μετρά το δικό του prism).
 *
 * Εδώ ζει το ΕΝΑ σχήμα ποσοτήτων, κατά IFC `Qto_ColumnBaseQuantities`:
 *
 *   ┌──────────────── z_top (κορυφή κολώνας)
 *   │  NET     → OIK-2.03 «κολώνα ανωδομής»       (z_top − z_nominalBase) × A
 *   ├──────────────── z_nominalBase (FFL ορόφου + baseOffset)
 *   │  STUB    → OIK-2.07 «κοντό υποστύλωμα»      baseDropMm × A
 *   ├──────────────── z_footingTop (άνω παρειά πεδίλου)
 *   │  (πέδιλο — αμετάβλητο, OIK-2.02)
 *   └────────────────
 *
 *   GROSS (IFC GrossVolume) = NET + STUB — το πλήρες φυσικό στοιχείο.
 *
 * **Γιατί χωριστό άρθρο και όχι απλή αύξηση της κολώνας** (Giorgio 2026-07-26): το ΝΕΤ ΟΙΚ
 * τιμολογεί **χωριστά** σκυρόδεμα θεμελίων από ανωδομής. Ρίχνοντας το κοντόστυλο στο
 * OIK-2.03 η ποσότητα γίνεται σωστή αλλά η **τιμή** λάθος. Άρα ο διαχωρισμός δεν είναι
 * βελτίωση αναφοράς — είναι ορθότητα κόστους.
 *
 * **Μηδέν επικάλυψη με το πέδιλο**: η κολώνα σταματά ΣΤΗΝ άνω παρειά, δεν μπαίνει μέσα στον
 * όγκο του (η απόφαση του Giorgio· ίδιο όριο με Tekla/Revit join, IFC κρατά και τα δύο).
 * Άρα το πέδιλο μένει gross και δεν διπλομετράται τίποτα.
 *
 * Pure — zero React/DOM/Firestore. `baseDropMm ≤ 0` (καμία έδραση, ή πέδιλο ψηλότερα από τη
 * βάση) → μηδενικό stub, `gross === net` → **byte-for-byte η προηγούμενη συμπεριφορά**.
 *
 * @see ../structural/organism/derive-column-base-continuity.ts — η πηγή του baseDropMm
 * @see ../../hooks/data/column-boq-feed.ts — ο καταναλωτής (BOQ + schedule)
 * @see docs/centralized-systems/reference/adrs/ADR-712-column-boq-gross-net-foundation-stub.md
 */

/** Το πλήρες σχήμα ποσοτήτων μιας κολώνας που πατά (ή όχι) σε πέδιλο. */
export interface ColumnFoundationStubQuantities {
  /** Κατακόρυφη προέκταση προς τα κάτω (mm) — 0 όταν δεν υπάρχει έδραση σε πέδιλο. */
  readonly baseDropMm: number;
  /** Όγκος κοντόστυλου (m³) → OIK-2.07. 0 όταν `baseDropMm === 0`. */
  readonly stubVolumeM3: number;
  /** Όγκος ανωδομής (m³) → OIK-2.03. Ταυτόσημος με τον σημερινό όγκο της κολώνας. */
  readonly netVolumeM3: number;
  /** IFC GrossVolume (m³) = net + stub — το πλήρες φυσικό στοιχείο. */
  readonly grossVolumeM3: number;
}

const MM_TO_M = 1 / 1000;

/**
 * Χτίζει το σχήμα gross/net/stub από τον **ήδη υπολογισμένο** όγκο ανωδομής, το εμβαδό
 * διατομής και την προέκταση βάσης.
 *
 * @param netVolumeM3    ο σημερινός (ανωδομής) όγκος της κολώνας — profile-aware, όπως
 *                       τον παράγει το `computeColumnGeometry`.
 * @param footprintAreaM2 εμβαδό διατομής (m²) — `geometry.area`, η ΙΔΙΑ πηγή με τον όγκο,
 *                       ώστε stub και net να μη μπορούν να αποκλίνουν σε shaped διατομές
 *                       (Γ/Τ/Π/κυκλική): το κοντόστυλο έχει **την ίδια διατομή** με την κολώνα.
 * @param baseDropMm     προέκταση προς τα κάτω. Μη-πεπερασμένο / ≤0 → clamp στο 0.
 */
export function computeColumnFoundationStub(
  netVolumeM3: number,
  footprintAreaM2: number,
  baseDropMm: number,
): ColumnFoundationStubQuantities {
  const net = Number.isFinite(netVolumeM3) ? Math.max(0, netVolumeM3) : 0;
  const area = Number.isFinite(footprintAreaM2) ? Math.max(0, footprintAreaM2) : 0;
  // Ίδιο clamp με τον 3Δ πυρήνα (`Math.max(0, nominalBaseAbsMm - effectiveBaseZmm)`) —
  // ΠΟΤΕ αρνητικό stub: πέδιλο ψηλότερα από τη βάση δεν «αφαιρεί» κολώνα.
  const drop = Number.isFinite(baseDropMm) ? Math.max(0, baseDropMm) : 0;
  const stub = area * drop * MM_TO_M;
  return {
    baseDropMm: drop,
    stubVolumeM3: stub,
    netVolumeM3: net,
    grossVolumeM3: net + stub,
  };
}

/** True όταν η κολώνα έχει πραγματικό κοντόστυλο (→ ξεχωριστή γραμμή OIK-2.07). */
export function hasFoundationStub(q: ColumnFoundationStubQuantities | undefined): q is ColumnFoundationStubQuantities {
  return !!q && q.stubVolumeM3 > 0;
}
