/**
 * Block Library — data model (data-only, no runtime logic).
 *
 * Δύο επίπεδα, ίδιο νόημα με τη Revit content library:
 *  - {@link InSessionBlockDef} — ΠΡΟΣΩΡΙΝΟΣ ορισμός block, ζωντανός μόνο για το τρέχον
 *    session (Milestone 1). Προκύπτει από τα named blocks ενός DXF import
 *    (`captureBlockDefsFromScene`) και τροφοδοτεί το in-session registry + το placement tool.
 *  - {@link BlockLibraryItem} — ΜΟΝΙΜΗ εγγραφή βιβλιοθήκης (Milestone 2+), με ίχνος
 *    προέλευσης + άδειας ανά αντικείμενο (νομική ασφάλεια), αποθηκευμένη στο Firestore
 *    (`block_library` collection) + geometry blob στο Storage. Multi-scope όπως τα
 *    `bim_materials` (user / company / project / system).
 *
 * SSoT reuse:
 *  - Η γεωμετρία ενός block ζει ως {@link Entity}[] σε BLOCK-LOCAL space (base→origin),
 *    ΑΚΡΙΒΩΣ όπως το `BlockEntity.entities` (systems/block/block-instance.ts). Καμία νέα
 *    αναπαράσταση γεωμετρίας.
 *
 * @see ./place-block-from-library.ts — def → BlockEntity σε clicked point
 * @see ./block-library-registry.ts — in-session store των defs
 * @see ./capture-blocks-from-scene.ts — import scene → distinct defs
 */

import type { Entity } from '../../types/entities';

/** Άξονο-ευθυγραμμισμένο bounding box σε canonical mm (για ghost/footprint + palette preview). */
export interface BlockBoundsMm {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * In-session ορισμός block (Milestone 1). `localMembers` είναι σε BLOCK-LOCAL space
 * (base baked στο origin) — έτοιμα να τυλιχτούν σε `BlockEntity` με placement transform.
 */
export interface InSessionBlockDef {
  readonly name: string;
  readonly localMembers: readonly Entity[];
  /** null όσο δεν έχει υπολογιστεί ακόμα (footprint υπολογίζεται στο wiring του tool). */
  readonly boundsMm: BlockBoundsMm | null;
}

/**
 * Κατηγορίες για ομαδοποίηση/φίλτρο στο palette — **ΕΝΑΣ** κατάλογος (M3).
 * Ο τύπος ΠΑΡΑΓΕΤΑΙ από τη λίστα: το dropdown της φόρμας και το φίλτρο του palette
 * διαβάζουν ΑΥΤΗΝ, ώστε μια νέα κατηγορία να μπαίνει σε ΕΝΑ σημείο (i18n:
 * `blockLibrary.categories.*`).
 */
export const BLOCK_CATEGORIES = [
  'furniture',
  'sanitary',
  'kitchen',
  'vehicle',
  'door',
  'window',
  'plant',
  'other',
] as const;

export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];

/** Scope ορατότητας — mirror του `bim_materials` scope μοντέλου. */
export type BlockLibraryScope = 'user' | 'company' | 'project' | 'system';

/** Τύποι άδειας (το «ταμπελάκι» άδειας) — ίδιο SSoT μοτίβο με τις κατηγορίες. */
export const BLOCK_LICENSE_TYPES = [
  'unknown',
  'cc0',
  'cc-by',
  'proprietary',
  'partner-granted',
] as const;

/** Τύπος άδειας ανά αντικείμενο. */
export type BlockLicenseType = (typeof BLOCK_LICENSE_TYPES)[number];

/** Ίχνος προέλευσης — από πού ήρθε το block. */
export interface BlockProvenance {
  readonly sourceType: 'user-import' | 'partner' | 'builtin';
  readonly sourceFileName?: string;
  readonly importedAt: number;
  readonly importedBy: string;
  /** Επωνυμία κατασκευαστή (partner content). */
  readonly manufacturer?: string;
}

/** Άδεια χρήσης — η `redistributable` είναι το GATE για promote σε shared/system scope. */
export interface BlockLicense {
  readonly type: BlockLicenseType;
  readonly attribution?: string;
  readonly termsUrl?: string;
  /** Μόνο `true` επιτρέπει την προαγωγή σε `company`/`system` κοινόχρηστη βιβλιοθήκη. */
  readonly redistributable: boolean;
}

/**
 * Μόνιμη εγγραφή βιβλιοθήκης (Firestore `block_library`). Η ΓΕΩΜΕΤΡΙΑ δεν είναι inline:
 * ζει ως blob στο Storage (`geometryUrl`) — Firestore doc κρατά μόνο metadata (ADR-040 +
 * όριο 1MB/doc). `id` = enterprise id `blklib_*`.
 */
export interface BlockLibraryItem {
  readonly id: string;
  readonly scope: BlockLibraryScope;
  readonly companyId: string | null;
  readonly projectId: string | null;
  readonly createdBy: string;
  /** system/partner → immutable (reuse του `BUILTIN_NOT_MUTABLE` guard). */
  readonly builtin: boolean;

  readonly name: string;
  readonly labelKey?: string;
  readonly category: BlockCategory;

  readonly boundsMm: BlockBoundsMm;
  /** Storage blob με τα serialized BLOCK-LOCAL members. */
  readonly geometryUrl: string;
  readonly thumbnailUrl?: string;

  readonly provenance: BlockProvenance;
  readonly license: BlockLicense;
}

/** Ασφαλές default άδειας για ό,τι εισάγει ο χρήστης: ιδιωτικό, ΟΧΙ αναδιανομή. */
export const DEFAULT_USER_IMPORT_LICENSE: BlockLicense = {
  type: 'unknown',
  redistributable: false,
};

/**
 * Είσοδος για «Αποθήκευση στη βιβλιοθήκη» (M2). Ο χρήστης δίνει κατηγορία + άδεια·
 * το `scope` default `'user'` (ιδιωτική βιβλιοθήκη). Η γεωμετρία ΔΕΝ περνά από εδώ ως
 * URL — ο service ανεβάζει το blob και συμπληρώνει μόνος του το `geometryUrl`.
 */
export interface SaveBlockLibraryItemInput {
  /** `'system'` απαγορεύεται από client (seed-only) — mirror του material library. */
  readonly scope: Exclude<BlockLibraryScope, 'system'>;
  readonly name: string;
  readonly category: BlockCategory;
  readonly boundsMm: BlockBoundsMm;
  /** BLOCK-LOCAL members — ανεβαίνουν ως blob στο Storage. */
  readonly localMembers: readonly Entity[];
  readonly provenance: BlockProvenance;
  readonly license: BlockLicense;
}

/**
 * Είσοδος για «Δημοσίευση» (M3): προάγει ένα ΗΔΗ αποθηκευμένο block από την ιδιωτική
 * βιβλιοθήκη σε κοινόχρηστο scope (εταιρείας/έργου) — το ArchiCAD «publish to office
 * library» / Figma «publish to team library». Ο χρήστης μπορεί ταυτόχρονα να ΔΙΟΡΘΩΣΕΙ
 * την άδεια (γι' αυτό το `license` είναι προαιρετικό εδώ): χωρίς `redistributable`, το
 * ΙΔΙΟ gate που φυλά το `saveBlock` απορρίπτει την προαγωγή.
 */
export interface PromoteBlockLibraryItemInput {
  readonly blockId: string;
  /** `'system'` ΠΟΤΕ από client — μόνο seed (Admin SDK). */
  readonly scope: Extract<BlockLibraryScope, 'company' | 'project'>;
  /** Διορθωμένη άδεια· αν λείπει, ισχύει η αποθηκευμένη. */
  readonly license?: BlockLicense;
}

/** Typed error codes της βιβλιοθήκης block (mirror `BIM_MATERIAL_ERRORS`). */
export const BLOCK_LIBRARY_ERRORS = {
  NAME_REQUIRED: 'BLOCK_LIBRARY_NAME_REQUIRED',
  GEOMETRY_REQUIRED: 'BLOCK_LIBRARY_GEOMETRY_REQUIRED',
  PROJECT_SCOPE_REQUIRES_PROJECT_ID: 'BLOCK_LIBRARY_PROJECT_SCOPE_REQUIRES_PROJECT_ID',
  SYSTEM_SCOPE_CLIENT_FORBIDDEN: 'BLOCK_LIBRARY_SYSTEM_SCOPE_CLIENT_FORBIDDEN',
  /** Νομικό GATE: κοινόχρηστο scope απαιτεί `license.redistributable === true`. */
  SHARED_SCOPE_REQUIRES_REDISTRIBUTABLE: 'BLOCK_LIBRARY_SHARED_SCOPE_REQUIRES_REDISTRIBUTABLE',
  BUILTIN_NOT_MUTABLE: 'BLOCK_LIBRARY_BUILTIN_NOT_MUTABLE',
  NOT_FOUND: 'BLOCK_LIBRARY_NOT_FOUND',
  GEOMETRY_FETCH_FAILED: 'BLOCK_LIBRARY_GEOMETRY_FETCH_FAILED',
} as const;

export type BlockLibraryErrorCode =
  (typeof BLOCK_LIBRARY_ERRORS)[keyof typeof BLOCK_LIBRARY_ERRORS];

/**
 * User-tunable placement overrides του Block Library tool (Milestone 1). Mirror του
 * `FurnitureParamOverrides` (ADR-410): το ribbon contextual tab γράφει `scale`/`rotation`.
 * Το ΠΟΙΟ block τοποθετείται ΔΕΝ ζει εδώ — ζει στο `block-library-selection-store` (SSoT,
 * palette → tool), και διαβάζεται σε event-time. Data-only.
 */
export interface BlockLibraryParamOverrides {
  /** Ομοιόμορφη κλίμακα τοποθέτησης· default `1`. */
  readonly scale?: number;
  /** Γωνία τοποθέτησης σε μοίρες· default `0`. */
  readonly rotation?: number;
}
