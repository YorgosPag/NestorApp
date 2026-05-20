/**
 * ADR-363 Phase 6.5 — System material seed data (pure SSoT).
 *
 * 25 generic essentials (no brand bias, `defaultUnitCost: null`) που γεμίζουν
 * το `bim_materials` collection ως `scope: 'system'` entries. Καμία
 * brand-specific entry — οι εταιρίες/projects προσθέτουν δικά τους.
 *
 * Categories distribution (per ADR-363 §Q8):
 *   plaster (3), masonry (3), concrete (4 inc. rebar), insulation (3),
 *   flooring (3), window-frame (2), door-frame (1), paint (2), roofing (2),
 *   waterproofing (1), other (1) = 25.
 *
 * IDs assigned στο seed time από `generateBimMaterialId()` (N.6 compliance).
 * Idempotency: seed script lookup by `nameEn` — υπάρχοντα system docs
 * updated, missing inserted.
 *
 * Pure data file — exempt from N.7.1 500-line limit (no logic).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Q8
 */

import type {
  BimMaterialCategory,
  BimMaterialFireRating,
  BimMaterialUnit,
} from '../types/bim-material-types';

/**
 * Pre-Firestore shape — id/builtin/timestamps/createdBy assigned at seed time.
 * Mirror του `BimMaterial` schema minus server-managed fields.
 */
export interface SystemMaterialSeed {
  readonly nameEl: string;
  readonly nameEn: string;
  readonly category: BimMaterialCategory;
  readonly density: number | null;
  readonly defaultThickness: number | null;
  readonly fireRating: BimMaterialFireRating;
  /** Latin ΑΤΟΕ code (OIK-x.xx). */
  readonly atoeCategory: string;
  readonly atoeArticle: string | null;
  readonly defaultUnit: BimMaterialUnit;
  readonly notes: string | null;
}

export const SYSTEM_MATERIALS_SEED: readonly SystemMaterialSeed[] = [
  // ─── plaster (3) ───────────────────────────────────────────────────────────
  {
    nameEl: 'Εσωτερικός σοβάς',
    nameEn: 'Interior plaster',
    category: 'plaster',
    density: 1800,
    defaultThickness: 20,
    fireRating: 'none',
    atoeCategory: 'OIK-3.10',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },
  {
    nameEl: 'Εξωτερικός σοβάς',
    nameEn: 'Exterior plaster',
    category: 'plaster',
    density: 1900,
    defaultThickness: 25,
    fireRating: 'none',
    atoeCategory: 'OIK-3.11',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },
  {
    nameEl: 'Θερμομονωτικός σοβάς',
    nameEn: 'Thermal plaster',
    category: 'plaster',
    density: 600,
    defaultThickness: 30,
    fireRating: 'none',
    atoeCategory: 'OIK-3.12',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },

  // ─── masonry (3) ───────────────────────────────────────────────────────────
  {
    nameEl: 'Οπτόπλινθος',
    nameEn: 'Brick masonry',
    category: 'masonry',
    density: 1800,
    defaultThickness: 100,
    fireRating: 'EI60',
    atoeCategory: 'OIK-3.06',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },
  {
    nameEl: 'Λιθοδομή',
    nameEn: 'Stone masonry',
    category: 'masonry',
    density: 2400,
    defaultThickness: 250,
    fireRating: 'EI90',
    atoeCategory: 'OIK-3.05',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },
  {
    nameEl: 'Τσιμεντόλιθος',
    nameEn: 'Concrete block',
    category: 'masonry',
    density: 1400,
    defaultThickness: 200,
    fireRating: 'EI60',
    atoeCategory: 'OIK-3.06',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },

  // ─── concrete + rebar (4) ──────────────────────────────────────────────────
  {
    nameEl: 'Σκυρόδεμα C20/25',
    nameEn: 'Concrete C20/25',
    category: 'concrete',
    density: 2400,
    defaultThickness: 200,
    fireRating: 'EI120',
    atoeCategory: 'OIK-2.01',
    atoeArticle: null,
    defaultUnit: 'm3',
    notes: null,
  },
  {
    nameEl: 'Σκυρόδεμα C25/30',
    nameEn: 'Concrete C25/30',
    category: 'concrete',
    density: 2400,
    defaultThickness: 200,
    fireRating: 'EI120',
    atoeCategory: 'OIK-2.01',
    atoeArticle: null,
    defaultUnit: 'm3',
    notes: null,
  },
  {
    nameEl: 'Σκυρόδεμα C30/37',
    nameEn: 'Concrete C30/37',
    category: 'concrete',
    density: 2400,
    defaultThickness: 200,
    fireRating: 'EI120',
    atoeCategory: 'OIK-2.01',
    atoeArticle: null,
    defaultUnit: 'm3',
    notes: null,
  },
  {
    nameEl: 'Σιδηροπλισμός B500C',
    nameEn: 'Rebar B500C',
    category: 'concrete',
    density: 7850,
    defaultThickness: null,
    fireRating: 'none',
    atoeCategory: 'OIK-2.05',
    atoeArticle: null,
    defaultUnit: 'kg',
    notes: null,
  },

  // ─── insulation (3) ────────────────────────────────────────────────────────
  {
    nameEl: 'Διογκωμένη πολυστερίνη (EPS)',
    nameEn: 'EPS expanded polystyrene',
    category: 'insulation',
    density: 20,
    defaultThickness: 50,
    fireRating: 'none',
    atoeCategory: 'OIK-7.01',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },
  {
    nameEl: 'Εξηλασμένη πολυστερίνη (XPS)',
    nameEn: 'XPS extruded polystyrene',
    category: 'insulation',
    density: 35,
    defaultThickness: 50,
    fireRating: 'none',
    atoeCategory: 'OIK-7.01',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },
  {
    nameEl: 'Ορυκτοβάμβακας',
    nameEn: 'Mineral wool',
    category: 'insulation',
    density: 80,
    defaultThickness: 80,
    fireRating: 'EI60',
    atoeCategory: 'OIK-7.02',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },

  // ─── flooring (3) ──────────────────────────────────────────────────────────
  {
    nameEl: 'Κεραμικό πλακάκι',
    nameEn: 'Ceramic tile',
    category: 'flooring',
    density: 2200,
    defaultThickness: 10,
    fireRating: 'none',
    atoeCategory: 'OIK-4.01',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },
  {
    nameEl: 'Μάρμαρο',
    nameEn: 'Marble',
    category: 'flooring',
    density: 2700,
    defaultThickness: 20,
    fireRating: 'none',
    atoeCategory: 'OIK-4.02',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },
  {
    nameEl: 'Ξύλινο δάπεδο',
    nameEn: 'Wood floor',
    category: 'flooring',
    density: 700,
    defaultThickness: 14,
    fireRating: 'none',
    atoeCategory: 'OIK-4.03',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },

  // ─── window-frame (2) ──────────────────────────────────────────────────────
  {
    nameEl: 'Πλαίσιο αλουμινίου',
    nameEn: 'Aluminum frame',
    category: 'window-frame',
    density: 2700,
    defaultThickness: null,
    fireRating: 'none',
    atoeCategory: 'OIK-5.02',
    atoeArticle: null,
    defaultUnit: 'pcs',
    notes: null,
  },
  {
    nameEl: 'Πλαίσιο PVC',
    nameEn: 'PVC frame',
    category: 'window-frame',
    density: 1400,
    defaultThickness: null,
    fireRating: 'none',
    atoeCategory: 'OIK-5.02',
    atoeArticle: null,
    defaultUnit: 'pcs',
    notes: null,
  },

  // ─── door-frame (1) ────────────────────────────────────────────────────────
  {
    nameEl: 'Πλαίσιο πόρτας ξύλινο',
    nameEn: 'Wood door frame',
    category: 'door-frame',
    density: 600,
    defaultThickness: null,
    fireRating: 'none',
    atoeCategory: 'OIK-5.01',
    atoeArticle: null,
    defaultUnit: 'pcs',
    notes: null,
  },

  // ─── paint (2) ─────────────────────────────────────────────────────────────
  {
    nameEl: 'Πλαστικό χρώμα εσωτερικό',
    nameEn: 'Interior plastic paint',
    category: 'paint',
    density: null,
    defaultThickness: null,
    fireRating: 'none',
    atoeCategory: 'OIK-7.10',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },
  {
    nameEl: 'Ακρυλικό χρώμα εξωτερικό',
    nameEn: 'Exterior acrylic paint',
    category: 'paint',
    density: null,
    defaultThickness: null,
    fireRating: 'none',
    atoeCategory: 'OIK-7.11',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },

  // ─── roofing (2) ───────────────────────────────────────────────────────────
  {
    nameEl: 'Κεραμίδι στέγης',
    nameEn: 'Roof tile',
    category: 'roofing',
    density: 2000,
    defaultThickness: 30,
    fireRating: 'none',
    atoeCategory: 'OIK-2.06',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },
  {
    nameEl: 'Επικάλυψη μεμβράνης στέγης',
    nameEn: 'Membrane roofing',
    category: 'roofing',
    density: 1200,
    defaultThickness: 5,
    fireRating: 'none',
    atoeCategory: 'OIK-7.05',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },

  // ─── waterproofing (1) ─────────────────────────────────────────────────────
  {
    nameEl: 'Στεγανωτική μεμβράνη',
    nameEn: 'Waterproofing membrane',
    category: 'waterproofing',
    density: 1500,
    defaultThickness: 5,
    fireRating: 'none',
    atoeCategory: 'OIK-7.06',
    atoeArticle: null,
    defaultUnit: 'm2',
    notes: null,
  },

  // ─── other (1) ─────────────────────────────────────────────────────────────
  {
    nameEl: 'Ξυλεία γενικής χρήσης',
    nameEn: 'General-purpose timber',
    category: 'other',
    density: 600,
    defaultThickness: null,
    fireRating: 'none',
    atoeCategory: 'OIK-3.07',
    atoeArticle: null,
    defaultUnit: 'm3',
    notes: null,
  },
] as const;

/** Build-time invariant — keeps the file honest against the §Q8 spec. */
if (SYSTEM_MATERIALS_SEED.length !== 25) {
  throw new Error(
    `SYSTEM_MATERIALS_SEED must have exactly 25 entries (ADR-363 §Q8). ` +
      `Found ${SYSTEM_MATERIALS_SEED.length}.`,
  );
}
