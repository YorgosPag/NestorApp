/**
 * ADR-363 Phase 6.5 — BIM Material Library types (SSoT).
 *
 * Hybrid material library: 25 system-seeded generic essentials (no brand bias,
 * `defaultUnitCost: null`) + user-extensible per company/project scope. Stored
 * στο Firestore root collection `bim_materials/{materialId}` με `scope` field
 * για 3-level inheritance: project > company > system.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Q8
 */
import type { Timestamp } from 'firebase/firestore';

export type BimMaterialScope = 'system' | 'company' | 'project';

/** 11-category taxonomy per ADR-363 §Q8. */
export type BimMaterialCategory =
  | 'plaster'
  | 'masonry'
  | 'concrete'
  | 'insulation'
  | 'flooring'
  | 'window-frame'
  | 'door-frame'
  | 'paint'
  | 'roofing'
  | 'waterproofing'
  | 'other';

export type BimMaterialFireRating = 'EI30' | 'EI60' | 'EI90' | 'EI120' | 'none';

export type BimMaterialUnit = 'm' | 'm2' | 'm3' | 'kg' | 'pcs';

/**
 * ADR-413 §2D Phase 3 — user-uploaded PBR texture set (Revit «Appearance asset →
 * Generic/Image» με per-map slots) που RENDER-ΑΡΕΤΑΙ στο 3D viewport (τοίχοι κλπ).
 *
 * `albedo` (base color) είναι ο ΜΟΝΟΣ υποχρεωτικός χάρτης· normal/roughness/ao
 * είναι optional (`null` = δεν ανέβηκε → flat fallback για τον συγκεκριμένο χάρτη).
 * `tileSizeM` = το φυσικό μέγεθος ενός tile σε ΜΕΤΡΑ (Revit «Sample Size»): η cache
 * ρυθμίζει `texture.repeat = 1 / tileSizeM` ώστε η υφή να απλώνεται φυσικά πάνω σε
 * γεωμετρία με UVs σε world meters.
 *
 * Firestore-safe: ολόκληρο το object είναι `null` (καμία υφή) ή πλήρες με `null`
 * ανά optional map — mirror του conditional-spread pattern του `thumbnailUrl`.
 */
export interface PbrMaterialTextures {
  readonly albedoUrl: string | null;
  readonly normalUrl: string | null;
  readonly roughnessUrl: string | null;
  readonly aoUrl: string | null;
  /** Real-world repeat size of one texture tile, σε ΜΕΤΡΑ (Revit «Sample Size»). */
  readonly tileSizeM: number;
  /**
   * ADR-678 Βήμα 3 — SHA-256 (hex) των albedo bytes, για content-hash dedup των
   * υλικών που δημιουργούνται **αυτόματα** κατά το round-trip import ξένων υφών (C4D
   * `<library_images>` → νέο `bmat_*`). Η ίδια φωτογραφία-υφή που ξαναέρχεται (ίδια
   * bytes) → ίδιο hash → reuse του υπάρχοντος υλικού αντί για διπλότυπο (Maxon/Revit
   * asset dedup). `null` για υλικά που φτιάχνει ο χρήστης χειροκίνητα στο editor
   * (καμία αυτόματη dedup — ονομάζονται/επιλέγονται ρητά).
   */
  readonly albedoHash: string | null;
}

/**
 * ADR-687 Φ1 — per-material PBR visual appearance (C4D Material Editor «Εμφάνιση»):
 * ο χρήστης ορίζει ΤΟ δικό του χρώμα + γυαλάδα + μεταλλικότητα, ανεξάρτητα από την
 * κατηγορία. Χαρτογραφείται 1-1 στο three.js `MeshStandardMaterial` (μέσω
 * `appearanceToDef` → `buildMat`). `emissive`/`opacity` = Φ4.
 *
 * Firestore-safe: ολόκληρο το object είναι `null` (καμία ρητή εμφάνιση → fallback
 * στην κατηγορία, `getCategoryMaterialDef`) ή πλήρες — mirror του `pbrTextures`.
 */
export interface BimMaterialAppearance {
  /** User base colour ως `#rrggbb` (εκατομμύρια χρώματα, όχι preset swatch). */
  readonly baseColorHex: string;
  /** Μεταλλικότητα 0..1 (0 = μη μεταλλικό, 1 = μέταλλο). */
  readonly metalness: number;
  /** Τραχύτητα 0..1 (0 = γυαλιστερό, 1 = ματ). */
  readonly roughness: number;
  /**
   * ADR-687 Φ4 — αυτοφωτισμός (Revit «Self-illumination»): χρώμα `#rrggbb` που εκπέμπει το
   * υλικό (φώτα/LED/οθόνες). `emissiveIntensity` = ένταση (0 = σβηστό). Optional για
   * back-compat: παλιά persisted appearance objects (Φ1) δεν τα έχουν → default μαύρο/0.
   */
  readonly emissiveHex?: string;
  readonly emissiveIntensity?: number;
  /**
   * ADR-687 Φ4 — αδιαφάνεια 0..1 (Revit «Transparency»): 1 = αδιαφανές (default), <1 =
   * διαφανές (γυαλί/νερό/πλεξιγκλάς). Optional για back-compat (undefined → 1).
   */
  readonly opacity?: number;
  /**
   * ADR-687 Φ5 — clearcoat (βερνίκι/λούστρο/car-paint): δεύτερο λεπτό γυαλιστερό στρώμα
   * πάνω από τη βάση (Blender Principled «Clearcoat» / C4D). `clearcoat` 0..1 = ένταση
   * στρώματος· `clearcoatRoughness` 0..1 = γυαλάδα του (0 = καθρέφτης). Απαιτούν
   * `MeshPhysicalMaterial`. Optional για back-compat (undefined → 0 = σβηστό).
   */
  readonly clearcoat?: number;
  readonly clearcoatRoughness?: number;
  /**
   * ADR-687 Φ5 — transmission (αληθινό γυαλί/νερό με refraction, όχι απλό opacity):
   * `transmission` 0..1 = ποσοστό φωτός που περνά μέσα από τον όγκο· `ior` 1.0..2.333 =
   * δείκτης διάθλασης (γυαλί 1.5, νερό 1.33, διαμάντι 2.42)· `thickness` = πάχος όγκου για
   * volume-tint. Απαιτούν `MeshPhysicalMaterial`. Optional (undefined → transmission 0 /
   * ior 1.5 / thickness 0 = σβηστό).
   */
  readonly transmission?: number;
  readonly ior?: number;
  readonly thickness?: number;
}

/**
 * Persisted shape σε Firestore. Mirror του ADR-363 §Q8 schema 1:1.
 *
 * Firestore rejects `undefined` — optional fields are stored as `null` ή
 * conditionally spread στο writer (mirror StairPresetsService pattern).
 */
export interface BimMaterial {
  readonly id: string;
  readonly scope: BimMaterialScope;
  readonly nameEl: string;
  readonly nameEn: string;
  readonly category: BimMaterialCategory;
  readonly density: number | null;
  readonly defaultThickness: number | null;
  readonly fireRating: BimMaterialFireRating;
  /** Latin ΑΤΟΕ code (OIK-x.xx). Source: `bim/config/bim-to-atoe-mapping.ts`. */
  readonly atoeCategory: string;
  readonly atoeArticle: string | null;
  readonly defaultUnitCost: number | null;
  readonly defaultUnit: BimMaterialUnit;
  readonly brand: string | null;
  readonly brandModel: string | null;
  readonly notes: string | null;
  /**
   * ADR-413 §2D Phase 2 — user-uploaded appearance thumbnail (Revit «Appearance
   * asset → image»). Firebase Storage download URL, keyed by this material's id.
   * `null` = no custom image → falls back to the PBR albedo swatch (Phase 1).
   */
  readonly thumbnailUrl: string | null;
  /**
   * ADR-413 §2D Phase 3 — user-uploaded PBR texture set που render-άρεται στο 3D
   * (όχι μόνο 2D thumbnail). `null` = καμία υφή → flat κατά κατηγορία στο 3D.
   */
  readonly pbrTextures: PbrMaterialTextures | null;
  /**
   * ADR-687 Φ1 — per-material PBR appearance (χρώμα/γυαλάδα/μεταλλικότητα).
   * `null` = καμία ρητή εμφάνιση → fallback στην κατηγορία (`getCategoryMaterialDef`,
   * back-compat με τα system seeds + όλα τα υπάρχοντα υλικά).
   */
  readonly appearance: BimMaterialAppearance | null;
  /** System seed = non-deletable + non-editable από client. */
  readonly builtin: boolean;
  /** Scope-dependent: null για system, populated για company/project. */
  readonly companyId: string | null;
  /** Populated μόνο όταν scope='project'. */
  readonly projectId: string | null;
  readonly createdBy: string;
  readonly createdAt: Timestamp;
  readonly updatedBy: string;
  readonly updatedAt: Timestamp;
}

/**
 * Client-side write payload για `saveMaterial` / `updateMaterial`.
 * Excludes server-managed fields (id, builtin, timestamps, createdBy/updatedBy).
 * Scope=system is REJECTED από client (seeded once via Admin SDK script).
 */
export interface SaveBimMaterialInput {
  readonly scope: Exclude<BimMaterialScope, 'system'>;
  readonly nameEl: string;
  readonly nameEn: string;
  readonly category: BimMaterialCategory;
  readonly density?: number;
  readonly defaultThickness?: number;
  readonly fireRating?: BimMaterialFireRating;
  readonly atoeCategory: string;
  readonly atoeArticle?: string;
  readonly defaultUnitCost?: number;
  readonly defaultUnit: BimMaterialUnit;
  readonly brand?: string;
  readonly brandModel?: string;
  readonly notes?: string;
  /** ADR-413 §2D Phase 2 — appearance thumbnail download URL (omit = none). */
  readonly thumbnailUrl?: string;
  /** ADR-413 §2D Phase 3 — user-uploaded 3D PBR texture set (omit = none). */
  readonly pbrTextures?: PbrMaterialTextures;
  /** ADR-687 Φ1 — per-material PBR appearance (omit = category fallback). */
  readonly appearance?: BimMaterialAppearance;
}

/**
 * Partial patch για update — same exclusions ως SaveBimMaterialInput, αλλά
 * `thumbnailUrl` δέχεται και `null` (αφαίρεση ανεβασμένης εικόνας → επιστροφή
 * στο albedo fallback).
 */
export type UpdateBimMaterialPatch = Partial<
  Omit<SaveBimMaterialInput, 'scope' | 'thumbnailUrl' | 'pbrTextures' | 'appearance'>
> & {
  readonly thumbnailUrl?: string | null;
  /** ADR-413 §2D Phase 3 — `null` αφαιρεί ολόκληρο το texture set (επιστροφή flat). */
  readonly pbrTextures?: PbrMaterialTextures | null;
  /** ADR-687 Φ1 — `null` αφαιρεί την εμφάνιση (επιστροφή στην κατηγορία). */
  readonly appearance?: BimMaterialAppearance | null;
};

/** Library query filters για list/subscribe. */
export interface BimMaterialQuery {
  readonly category?: BimMaterialCategory;
  readonly scope?: BimMaterialScope;
  readonly search?: string;
}

/** Domain errors thrown από MaterialLibraryService. */
export const BIM_MATERIAL_ERRORS = {
  NAME_REQUIRED: 'BIM_MATERIAL_NAME_REQUIRED',
  PROJECT_SCOPE_REQUIRES_PROJECT_ID: 'BIM_MATERIAL_PROJECT_SCOPE_REQUIRES_PROJECT_ID',
  SYSTEM_SCOPE_CLIENT_FORBIDDEN: 'BIM_MATERIAL_SYSTEM_SCOPE_CLIENT_FORBIDDEN',
  BUILTIN_NOT_MUTABLE: 'BIM_MATERIAL_BUILTIN_NOT_MUTABLE',
  NOT_FOUND: 'BIM_MATERIAL_NOT_FOUND',
} as const;

export type BimMaterialErrorCode = (typeof BIM_MATERIAL_ERRORS)[keyof typeof BIM_MATERIAL_ERRORS];
