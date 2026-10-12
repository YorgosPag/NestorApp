/**
 * LEVELS SYSTEM - Configuration
 * Types, interfaces, and configuration for level management
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { BimRenderSettings } from '../../config/bim-render-settings-types';
import type { ThermalEnvelopeSpec } from '../../bim/types/thermal-envelope-types';

/** 🏢 ADR-309 Phase 3: Context-aware floorplan type — set by wizard on import */
export type FloorplanType = 'project' | 'building' | 'floor' | 'unit';

export interface Level {
  id: string;
  name: string;
  order: number;
  isDefault: boolean;
  visible: boolean;
  /** Ο μισθωτής του επιπέδου — γράφεται server-side στη δημιουργία (ADR-286). Κάτοχος του στόχου γέννησης (ADR-913). */
  companyId?: string;
  floorId?: string;    // Σύνδεση με building floor (ADR-237, SPEC-237A)
  buildingId?: string; // Building ID del piano collegato — derivato al link-time (ADR-237)
  /** 🏢 ENTERPRISE: Persistent link to cadFiles/files document ID for scene auto-load */
  sceneFileId?: string;
  /** 🏢 ENTERPRISE: Original filename for display in Levels panel */
  sceneFileName?: string;
  /** 🏢 ADR-309 Phase 3: Type of floorplan — drives context-aware title in LevelPanel */
  floorplanType?: FloorplanType;
  /** 🏢 ADR-309 Phase 3: Human-readable entity label (e.g. "Κτίριο Α", "1ος Όροφος") */
  entityLabel?: string;
  /**
   * ADR-651 Φάση Ι — ο **χειρόγραφος αριθμός φύλλου** αυτού του ορόφου στο σετ εκτύπωσης
   * (π.χ. «Α-05», «ΑΡΧ-2»). Κενό/απόν ⇒ **αυτόματη** αρίθμηση από τη ΘΕΣΗ στο σετ (Α-1, Α-2…).
   *
   * Πρακτική ηγετών: ο αριθμός φύλλου είναι **ιδιότητα του φύλλου** (Revit Sheet Number,
   * AutoCAD SSM «Rename & Renumber»), με ρητή επιλογή «αυτόματο κατά θέση ή δικό μου ID»
   * (ArchiCAD Layout ID). Το φύλλο μας **ΕΙΝΑΙ** ο όροφος (§5.5) ⇒ εδώ είναι η θέση του,
   * και μηδέν δεύτερη πηγή αλήθειας.
   */
  sheetNumberOverride?: string | null;
  /** 🏢 ADR-309 Phase 3: Project ID — set by wizard on import */
  projectId?: string;
  /**
   * ADR-914 — το **ακίνητο** του οποίου κάτοψη είναι αυτό το επίπεδο (`floorplanType: 'unit'`).
   * Χωρίς αυτό το επίπεδο ακινήτου δεν είχε κάτοχο για τον στόχο αποθήκευσής του (ADR-913 §7.1):
   * ο `floorId` του θα το έκανε «κάτοψη ΟΡΟΦΟΥ». Ο όροφος μένει το κλειδί εμβέλειας των BIM
   * οντοτήτων (ADR-420)· το ακίνητο είναι ο **κάτοχος του αρχείου**.
   */
  propertyId?: string;
  /** ADR-375 Phase B.2: per-view BIM render settings (Revit ViewPlan equivalent). */
  bimRenderSettings?: BimRenderSettings;
  /** ADR-375 Phase B.3: FK → dxf_viewer_view_templates. When set, signals that
   *  bimRenderSettings is a snapshot of the linked template; edits to the
   *  template are fanned out to all levels with the same FK. */
  appliedViewTemplateId?: string | null;
  /** ADR-396 P7: per-floor ETICS thermal envelope spec (preset + display driver). */
  thermalEnvelopeSpec?: ThermalEnvelopeSpec | null;
}

/**
 * ADR-914 — η δέσμευση ενός επιπέδου **τη στιγμή της γέννησής του**, πέρα από τον όροφο.
 *
 * Ο στόχος αποθήκευσης ενός κενού επιπέδου παράγεται από τη δέσμευσή του (ADR-913). Αν το
 * επίπεδο γεννηθεί αδέσμευτο και δεθεί με δεύτερη εγγραφή, στο ενδιάμεσο ο στόχος δείχνει στον
 * χώρο της εταιρείας και μετά στο έργο — ίδιο αρχείο, δύο paths. Γι' αυτό τα πεδία ταξιδεύουν
 * ΜΕ τη δημιουργία, ποτέ μετά.
 */
export interface LevelBirthBinding {
  readonly buildingId?: string | null;
  readonly projectId?: string;
  readonly propertyId?: string;
  readonly floorplanType?: FloorplanType;
  readonly entityLabel?: string;
}

/**
 * ADR-914 §2.15 — πώς **συμπεριφέρεται** η γέννηση, όχι τι γράφεται στο επίπεδο (αυτό είναι το
 * {@link LevelBirthBinding}). Δεν ταξιδεύει ποτέ στον διακομιστή.
 */
export interface AddLevelOptions {
  /**
   * `false` = το επίπεδο γεννιέται **στο παρασκήνιο**: μπαίνει στη λίστα, το ανοιχτό επίπεδο δεν
   * αλλάζει. Το ζητά όποιος γεννά επίπεδα που ο άνθρωπος **δεν ζήτησε να ανοίξει** (η αναπλήρωση
   * «όλοι οι όροφοι»). Απόν ⇒ ισχύει το `autoSelectNewLevel`, όπως πάντα.
   */
  readonly select?: boolean;
}

/** Η υπογραφή του `addLevel` — ΜΙΑ δήλωση για το context, τον resolver ορόφου και τον provisioner. */
export type AddLevel = (
  name: string,
  setAsDefault?: boolean,
  floorId?: string,
  birth?: LevelBirthBinding,
  options?: AddLevelOptions,
) => Promise<string | null>;

export interface FloorplanDoc {
  id: string;
  levelId: string;
  name: string;
  fileName: string;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  /**
   * ADR-368 — user-specified drawing coordinate units. When set, overrides
   * the DXF $INSUNITS declaration and resolveSceneUnits() heuristic so that
   * Greek DXF files (declared mm, actual meters) render dimensions correctly
   * without any patch-chain heuristics. Absent = auto-detect (legacy path).
   */
  userDrawingUnits?: SceneUnits;
  transform: {
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
  };
  bbox: {
    min: Point2D;
    max: Point2D;
  };
  importedAt: string;
  calibrated: boolean;
}

export interface CalibrationData {
  point1: {
    screen: Point2D;
    world: Point2D;
  };
  point2: {
    screen: Point2D;
    world: Point2D;
  };
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  realDistance: number;
}

export interface ImportWizardState {
  step: 'level' | 'units' | 'calibration' | 'preview' | 'complete';
  file?: File;
  selectedLevelId?: string;
  newLevelName?: string;
  /** ADR-368 — 'auto' = use resolveSceneUnits() heuristic; explicit value overrides. */
  userDrawingUnits?: SceneUnits | 'auto';
  calibration?: CalibrationData;
  floorplan?: FloorplanDoc;
}

export interface LevelSystemConfig {
  enableAutoSave: boolean;
  defaultUnits: FloorplanDoc['units'];
  maxLevels: number;
  firebaseCollection: string;
  defaultLevels: Omit<Level, 'id'>[];
}

export const DEFAULT_LEVEL_CONFIG: LevelSystemConfig = {
  enableAutoSave: true,
  defaultUnits: 'mm',
  maxLevels: 50,
  firebaseCollection: 'dxf_viewer_levels',
  defaultLevels: [
    { name: 'Επίπεδο 1', order: 0, isDefault: true, visible: true },
  ],
};

export interface LevelSystemSettings {
  showLevelNumbers: boolean;
  allowLevelReordering: boolean;
  enableLevelDuplication: boolean;
  showFloorplanThumbnails: boolean;
  autoSelectNewLevel: boolean;
}

export const DEFAULT_LEVEL_SETTINGS: LevelSystemSettings = {
  showLevelNumbers: true,
  allowLevelReordering: true,
  enableLevelDuplication: true,
  showFloorplanThumbnails: true,
  autoSelectNewLevel: true,
};

export const LEVELS_EXPORT_VERSION = '1.0' as const;

/**
 * Shared interface for Import Wizard actions to eliminate duplicates
 * Used by both hooks/common/useImportWizard.ts and systems/levels/useLevels.ts
 */
export interface ImportWizardActions {
  startImportWizard: (file: File) => void;
  setImportWizardStep: (step: ImportWizardState['step']) => void;
  setSelectedLevel: (levelId?: string, newLevelName?: string) => void;
  /** ADR-368 — set drawing-coordinate unit override from the wizard units step. */
  setUserDrawingUnits?: (units: SceneUnits | 'auto') => void;
  setCalibration: (calibration: CalibrationData) => void;
  cancelImportWizard?: () => void;
}
