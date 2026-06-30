/**
 * Πραγματική εγκεκριμένη στατική μελέτη ως **machine SSoT αναφοράς** (ADR-479).
 *
 * Κωδικοποιεί τις canonical παραδοχές των τευχών STATICS 2025 (έργο «2η Αναθεώρηση
 * 288/08», Θέρμη Θεσσαλονίκης· κτίρια Κ1/Κ2/Κ3· μελετητής Γρ. Παγώνης) — υλικά,
 * φορτία ανά χρήση, σεισμικά, έδαφος, επικαλύψεις ανά στοιχείο, ιδιοπεριόδους.
 *
 * Σαν Revit project template: το τεύχος είναι το OUTPUT μιας πραγματικής μελέτης·
 * εδώ το κρατάμε ως **ζωντανό συμβόλαιο**. Το `reference-static-report.test.ts`
 * γεφυρώνει αυτό το reference με τα engine defaults (providers/constants) — αν
 * κάποια default τιμή αποκλίνει από την πραγματική εγκεκριμένη μελέτη, το test το
 * δείχνει ακριβώς. Είναι ΕΠΙΣΗΣ το machine SSoT του human-readable
 * `docs/centralized-systems/reference/structural-guides/static-report-reference-parameters.json`
 * (το JSON guard-άρεται έναντι αυτού του module από το ίδιο test — μηδέν silent drift).
 *
 * Pure data — zero deps πέραν των engine type aliases. Μονάδες: φορτία kPa (=kN/m²),
 * πυκνότητα kN/m³, μέτρα ελαστικότητας GPa, επικαλύψεις mm, ιδιοπεριόδους sec.
 *
 * @see ./structural-preset-defaults.ts — ο preset factory που συνθέτει τα defaults
 * @see docs/centralized-systems/reference/structural-guides/greek-static-report-guide.md
 * @see docs/centralized-systems/reference/adrs/ADR-479-structural-project-presets.md
 */

import type { ConcreteGrade } from '../concrete-grades';
import type { StructuralCodeId } from '../codes';
import type { OccupancyCategory } from '../loads/occupancy-loads';
import type { SeismicGroundType } from '../loads/seismic-params';

/** Επικαλύψεις οπλισμού (cnom, mm) ανά δομικό στοιχείο — επιλογή της μελέτης (XC3). */
export interface ReferenceCovers {
  readonly slabMm: number;
  readonly beamMm: number;
  readonly columnMm: number;
  readonly foundationMm: number;
}

/** Σεισμικές παραδοχές της μελέτης (EC8 + Ελληνικό Εθνικό Προσάρτημα). */
export interface ReferenceSeismic {
  readonly hazardZone: string;
  readonly groundType: SeismicGroundType;
  /** a_gR/g — λόγος επιτάχυνσης αναφοράς εδάφους. */
  readonly groundAccelRatio: number;
  readonly importanceFactorGammaI: number;
  /** Συντελεστής συμπεριφοράς q (ίδιος κατά X/Y στη μελέτη). */
  readonly behaviourFactorQ: number;
  /** ψ1/ψ2 κινητών φορτίων (EN1990 Annex A1). */
  readonly psi1: number;
  readonly psi2: number;
}

/** Παράμετροι έδρασης/εδάφους (SLS). */
export interface ReferenceSoil {
  readonly allowableBearingKpa: number;
  readonly undrainedShearSuKpa: number;
  readonly elasticModulusKpa: number;
}

/** Per-building δυναμικά χαρακτηριστικά (το ΜΟΝΟ που διαφέρει μεταξύ Κ1/Κ2/Κ3). */
export interface ReferenceBuildingDynamics {
  readonly id: string;
  readonly naturalPeriodTxSec: number;
  readonly naturalPeriodTySec: number;
}

/** Πλήρης εγγραφή αναφοράς μιας στατικής μελέτης. */
export interface StaticReportReference {
  readonly projectName: string;
  readonly software: string;
  readonly codeId: StructuralCodeId;
  readonly concreteGrade: ConcreteGrade;
  readonly rebarGrade: string;
  readonly concreteElasticGpa: number;
  readonly steelElasticGpa: number;
  readonly reinforcedConcreteUnitWeightKnM3: number;
  /** Χαρακτηριστικά ωφέλιμα φορτία q_k (kPa) ανά structural occupancy της μελέτης. */
  readonly imposedLoadsKpa: Partial<Record<OccupancyCategory, number>>;
  /** Κυρίαρχη χρήση κτιρίου (πολυκατοικία → residential). */
  readonly primaryOccupancy: OccupancyCategory;
  readonly seismic: ReferenceSeismic;
  readonly soil: ReferenceSoil;
  readonly covers: ReferenceCovers;
  /** ULS θεμελιώδης συνδυασμός (EN1990 6.10) που χρησιμοποίησε η μελέτη. */
  readonly ulsFactors: { readonly gammaG: number; readonly gammaQ: number };
  readonly buildings: readonly ReferenceBuildingDynamics[];
}

/**
 * **SSoT** — Θέρμη 288/08 (Κ1/Κ2/Κ3). Frozen ώστε κανείς consumer να μην τη
 * μεταλλάσσει κατά λάθος (είναι ιστορικό record πραγματικής μελέτης).
 *
 * Οι τιμές φορτίων/χρήσης/σεισμού/εδάφους χαρτογραφούνται 1:1 στα engine SSoT
 * (`OCCUPANCY_IMPOSED_KPA`, `DEFAULT_SEISMIC_*`, `DEFAULT_CONCRETE_GRADE`,
 * `EN1990_ULS_FACTORS`, `REBAR_GRADE`). Οι επικαλύψεις είναι **επιλογή** της μελέτης
 * (≥ των code minima των providers — η σχέση `engineMin ≤ study` ελέγχεται στο test).
 */
export const THERMI_288_08: StaticReportReference = Object.freeze({
  projectName: '2η Αναθεώρηση 288/08 — Θέρμη Θεσσαλονίκης',
  software: 'STATICS 2025',
  codeId: 'eurocode',
  concreteGrade: 'C25/30',
  rebarGrade: 'B500C',
  concreteElasticGpa: 31.0,
  steelElasticGpa: 200.0,
  reinforcedConcreteUnitWeightKnM3: 25.0,
  imposedLoadsKpa: {
    residential: 2.0,
    shopping: 5.0,
  },
  primaryOccupancy: 'residential',
  seismic: {
    hazardZone: 'I',
    groundType: 'B' as const,
    groundAccelRatio: 0.16,
    importanceFactorGammaI: 1.0,
    behaviourFactorQ: 2.0,
    psi1: 0.5,
    psi2: 0.3,
  },
  soil: {
    allowableBearingKpa: 150,
    undrainedShearSuKpa: 70,
    elasticModulusKpa: 50000,
  },
  covers: {
    slabMm: 30,
    beamMm: 35,
    columnMm: 35,
    foundationMm: 60,
  },
  ulsFactors: { gammaG: 1.35, gammaQ: 1.5 },
  buildings: [
    { id: 'K1', naturalPeriodTxSec: 0.32, naturalPeriodTySec: 0.36 },
    { id: 'K2', naturalPeriodTxSec: 0.35, naturalPeriodTySec: 0.31 },
    { id: 'K3', naturalPeriodTxSec: 0.36, naturalPeriodTySec: 0.35 },
  ],
});
