// 🏢 ENTERPRISE: Multi-address support (ADR-167)
import type { ProjectAddress } from './project/addresses';
import type { LandownerEntry } from '@/types/ownership-table';
// 🏢 ADR-186 §8b: Project-level ΝΟΚ building-code (Phase 2 CRUD form)
import type { ProjectBuildingCodePhase2 } from '@/types/project-building-code';
// ADR-287 — SSoT imports (χρειάζονται locally για use στο Project interface,
// επιπρόσθετα των κάτωθι `export type {X}` re-exports για backward-compat).
import type { ProjectStatus } from '@/constants/project-statuses';
import type { ProjectType } from '@/constants/project-types';

// ADR-287 — ProjectStatus SSoT: canonical union lives στο
// `src/constants/project-statuses.ts`. Re-exported εδώ για backward-compat.
export type { ProjectStatus };

// ADR-308 — Soft-delete mixin
import type { SoftDeletableFields } from '@/types/soft-deletable';

// ADR-369 — 3-tier Revit reference system (surveyPoint / basePoint / northRotation)
import type {
  ProjectSurveyPoint,
  ProjectBasePoint,
} from '@/types/project-elevation.schemas';
export type { ProjectSurveyPoint, ProjectBasePoint } from '@/types/project-elevation.schemas';
// ADR-782 §24 — υπόβαθρο, ΟΧΙ γεωαναφορά: ξεχωριστό αρχείο σχήματος επίτηδες (δες το docblock του).
import type { ProjectBasemapPlacement } from '@/types/project-basemap-placement.schemas';
export type { ProjectBasemapPlacement } from '@/types/project-basemap-placement.schemas';

// ADR-376 Phase C.2 — Per-project Opening Tag Style override (DXF Viewer BIM)
import type { OpeningTagStyle } from '@/subapps/dxf-viewer/bim/services/opening-tag-style-service';
export type { OpeningTagStyle } from '@/subapps/dxf-viewer/bim/services/opening-tag-style-service';

// ADR-287 — ProjectType SSoT: canonical union lives στο
// `src/constants/project-types.ts`. Re-exported εδώ για backward-compat.
export type { ProjectType };

/** 🏢 ENTERPRISE: Priority levels for project management */
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';

/** 🏢 ENTERPRISE: Risk assessment levels */
export type ProjectRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** 🏢 ENTERPRISE: Complexity levels for project estimation */
export type ProjectComplexity = 'simple' | 'moderate' | 'complex' | 'highly_complex';

export interface Project extends SoftDeletableFields {
  id: string;
  /** 🏢 ENTERPRISE: Human-readable project code (e.g., "PRJ-001") */
  projectCode?: string;
  name: string;
  title: string;
  status: ProjectStatus;
  company: string;
  companyId: string;
  /** 🏢 ADR-232: Business entity link (separate from tenant companyId) */
  linkedCompanyId?: string | null;
  /** 🏢 ADR-232: Denormalized company display name */
  linkedCompanyName?: string | null;

  // 🏢 LEGACY: Backward compatibility (kept for migration)
  // Use addresses[] for new data, these for existing records
  address: string;
  city: string;

  // 🏢 ENTERPRISE: Multi-address system (ADR-167)
  /** Project addresses - supports multiple entrances, deliveries, etc. */
  addresses?: ProjectAddress[];

  progress: number;
  totalValue: number;
  startDate?: string;
  completionDate?: string;
  lastUpdate: string;
  totalArea: number;

  // 🏢 ENTERPRISE: Extended project fields for advanced filtering (2026-01-19)
  /** Project description for search and display */
  description?: string;
  /** Project location (city/region) for filtering */
  location?: string;
  /** Client/customer name */
  client?: string;
  /** Project type classification */
  type?: ProjectType;
  /** Project priority level */
  priority?: ProjectPriority;
  /** Risk assessment level */
  riskLevel?: ProjectRiskLevel;
  /** Project complexity level */
  complexity?: ProjectComplexity;
  /** Total budget in euros */
  budget?: number;
  /** Expected duration in months */
  duration?: number;
  /** Start year for year-based filtering */
  startYear?: number;
  /** Expected end date (ISO string) */
  endDate?: string;
  buildingBlock?: string;
  /**
   * Αριθμός οικοπέδου μέσα στο Ο.Τ. (π.χ. «01β») — ADR-759 Φ3.
   *
   * Δίπλα στο `buildingBlock` και **όχι** στη διεύθυνση: είναι αναγνωριστικό του ακινήτου στο
   * σχέδιο πόλης, όχι ταχυδρομική πληροφορία. Το ίδιο έλεγε ήδη το `resolve-location.ts`
   * («ανήκει στο ακίνητο, όχι στη διεύθυνση») χωρίς να έχει πού να το γράψει.
   */
  plotNumber?: string;
  protocolNumber?: string;
  licenseNumber?: string;
  /** Αρχή έκδοσης αδείας */
  issuingAuthority?: string;
  /** Ημερομηνία έκδοσης αδείας (ISO string) */
  issueDate?: string;

  // 🏢 ENTERPRISE: Boolean feature flags for filtering
  /** Has all required permits */
  hasPermits?: boolean;
  /** Has secured financing */
  hasFinancing?: boolean;
  /** Ecological/green building project */
  isEcological?: boolean;
  /** Uses subcontractors */
  hasSubcontractors?: boolean;
  /** Project is currently active */
  isActive?: boolean;
  /** Has reported issues */
  hasIssues?: boolean;

  // 👷 IKA/EFKA LABOR COMPLIANCE (ADR-090)
  /** EFKA declaration data — αναγγελία έργου στο e-ΕΦΚΑ */
  efkaDeclaration?: import('@/components/projects/ika/contracts').EfkaDeclarationData;

  /** ADR-244: Οικοπεδούχοι — SSoT, χρησιμοποιείται στο Bartex + πίνακα ποσοστών */
  landowners?: LandownerEntry[] | null;
  /** ADR-244: Ποσοστό αντιπαροχής (%) — αν ισχύει σενάριο αντιπαροχής */
  bartexPercentage?: number | null;
  /** ADR-244: Denormalized contact IDs for Firestore array-contains queries */
  landownerContactIds?: string[] | null;

  /** ADR-186 §8b: Phase 2 ΝΟΚ building-code form data — null = not yet defined */
  buildingCode?: ProjectBuildingCodePhase2 | null;

  /**
   * ADR-759 Φ2 — FK → `survey_records` for the survey this project currently works from.
   *
   * 🔑 **Explicit, never derived.** A project accumulates several surveys (purchase →
   * implementation). Picking "the latest" by `orderBy(surveyDate)` would mean that
   * uploading an *older* survey silently changes which one is authoritative — the
   * lifecycle owner would be emergent instead of named (N.7.2 Q7). One field removes
   * the whole class of bug.
   *
   * `null`/absent = no survey chosen yet. The card still lists every record.
   */
  activeSurveyRecordId?: string | null;

  // ─── ADR-369: Project elevation reference (Tier 1 + Tier 2 + rotation) ──
  /** Γεωδαιτικό σημείο αναφοράς (Tier 1 — Survey Point). METRES + reference system. */
  surveyPoint?: ProjectSurveyPoint;
  /** Τοπικό μηδέν έργου (Tier 2 — Project Base Point). Offset από surveyPoint. */
  basePoint?: ProjectBasePoint;
  /** Rotation true-north → project grid, DEGREES. Default 0. */
  northRotation?: number;

  // ─── ADR-782 §24 — Χειροκίνητη τοποθέτηση ΥΠΟΒΑΘΡΟΥ (ποτέ γεωαναφορά) ────
  /**
   * Πού κάθεται η τοπική αρχή (0,0) του σχεδίου πάνω στη Γη **για τον χάρτη** — ΜΕΤΡΑ ΕΓΣΑ'87
   * + μοίρες. `null`/απόν = ο χρήστης δεν τοποθέτησε τίποτα με το χέρι, ο χάρτης ακολουθεί τη
   * δηλωμένη διεύθυνση.
   *
   * ⚠️ **ΔΕΝ είναι γεωαναφορά και δεν προάγεται ποτέ σε τέτοια** (απόφαση Giorgio 2026-08-10,
   * ADR-782 §23.1): είναι θέση που εκτιμήθηκε **με το μάτι** πάνω σε χάρτη εθελοντικής
   * χαρτογράφησης και δεν έχει καμία δουλειά σε πίνακες συντεταγμένων, εξαγωγή IFC ή τοπογραφικά
   * παραδοτέα. Τα τρία πεδία ADR-369 από πάνω είναι εκείνα, και μένουν ανέγγιχτα.
   */
  basemapPlacement?: ProjectBasemapPlacement | null;

  // ─── ADR-376 Phase C.2 — Per-project Opening Tag Style override ──────────
  /**
   * Custom styling override για opening-tag pills (font size, border width,
   * leader style/color/visibility, pill background colour). Undefined fields
   * fall back to canvas-pill SSoT defaults. `null` = reset (no overrides).
   */
  openingTagStyle?: OpeningTagStyle | null;
}

/**
 * ProjectSummary — Subset of Project for list/grid views and detail tabs.
 * SSoT: Derived via Pick — κάθε νέο πεδίο στο Project αρκεί να προστεθεί στο Pick.
 *
 * Used by:
 * - /api/projects/list (API response type)
 * - useFirestoreProjects hook
 * - useFirestoreProjectsPaginated hook
 */
export type ProjectSummary = Pick<Project,
  | 'id' | 'name' | 'title' | 'status' | 'company' | 'companyId'
  | 'address' | 'city' | 'addresses'
  | 'progress' | 'totalValue' | 'totalArea'
  | 'landowners' | 'bartexPercentage' | 'landownerContactIds'
> & {
  /** ADR-232: Business entity link */
  linkedCompanyId: string | null;
  /** ISO string — always defined (empty string default) */
  startDate: string;
  /** ISO string — always defined (empty string default) */
  completionDate: string;
  /** Computed: fieldToISO(updatedAt || lastUpdate) */
  lastUpdate: string;
};

export interface ProjectCustomer {
  contactId: string;
  name: string;
  phone: string | null;
  /** Email address for customer communication */
  email?: string;
  propertiesCount: number;
}

export interface ProjectStats {
  totalProperties: number;
  soldProperties: number;
  totalSoldArea: number;
}

/**
 * 🏢 ENTERPRISE: Project update payload for Firestore operations
 * Follows contacts.service.ts pattern for type-safe updates
 */
export type ProjectUpdatePayload = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>> & {
  updatedAt?: unknown; // FieldValue from Firestore
  /** Allow null to unlink company from project */
  companyId?: string | null;
  company?: string | null;
  /** 🏢 ADR-232: Business entity link */
  linkedCompanyId?: string | null;
  linkedCompanyName?: string | null;

};

/**
 * **Κλειδιά i18n** ανά κανονική κατάσταση έργου — ένα κλειδί, ποτέ έτοιμο κείμενο.
 *
 * 🔴 **ΗΤΑΝ ΣΚΛΗΡΑ ΕΛΛΗΝΙΚΑ** (ADR-806 §7 #2, N.11): οι έξι τιμές ήταν γραμμένες ως
 * ωμό κείμενο (`'Σχεδιασμός'`…) και ζωγραφίζονταν **αμετάφραστες** στην κάρτα έργου
 * (`useProjectCardModel.ts`) — δηλαδή **αγγλόφωνος χρήστης έβλεπε ελληνικά**, σε
 * component που είχε το `t` **ήδη στη γραμμή από πάνω**. Τα κλειδιά υπήρχαν **ήδη**
 * στο `projects.json` και των δύο γλωσσών· έλειπε μόνο το `deleted`, που προστέθηκε
 * σε **el+en πριν** αλλάξει αυτό το αρχείο (N.11: πρώτα το κλειδί, μετά ο κώδικας).
 *
 * ⚠️ **Ο ΤΥΠΟΣ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ ΠΛΗΡΟΤΗΤΑΣ**: `Record<ProjectStatus, string>` σημαίνει
 * ότι μια **έβδομη** κανονική κατάσταση στο `PROJECT_STATUSES` (ADR-287) σπάει εδώ τη
 * μεταγλώττιση, αντί να ζωγραφίσει ωμό κλειδί στην οθόνη.
 *
 * ⚠️ **ΔΕΝ ΕΙΝΑΙ ΦΡΟΥΡΟΣ ΕΓΚΥΡΟΤΗΤΑΣ.** Μέχρι σήμερα το `ProjectUpdateSchema` ρωτούσε
 * `value in PROJECT_STATUS_LABELS` — η οθόνη αποφάσιζε τι δέχεται το API. Αυτό κόπηκε:
 * ο φρουρός είναι το `isProjectStatus()` του SSoT.
 */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
    planning: 'projects.status.planning',
    in_progress: 'projects.status.inProgress',
    completed: 'projects.status.completed',
    on_hold: 'projects.status.onHold',
    cancelled: 'projects.status.cancelled',
    deleted: 'projects.status.deleted'
};
