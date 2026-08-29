/**
 * UserSettings — Zod schema + types (SSoT for the Firestore document shape).
 *
 * The repository validates every read/write against this schema so that a
 * malformed local cache or an out-of-band Firestore mutation can never
 * silently corrupt downstream consumers (cursor / rulers-grid / dxfSettings /
 * snap). Slice schemas use `deepPartial()` flavor so each Phase wires its
 * subsystem incrementally without forcing other phases to ship same-time.
 *
 * @module services/user-settings/user-settings-schema
 * @enterprise ADR-341 (UserSettings SSoT — Firestore-backed industry pattern)
 */

import { z } from 'zod';

// ─── Cursor / crosshair / selection ──────────────────────────────────────────

const lineStyleEnum = z.enum(['solid', 'dashed', 'dotted', 'dash-dot']);

const crosshairSchema = z.object({
  enabled: z.boolean(),
  size_percent: z.number().min(0).max(100),
  color: z.string(),
  line_width: z.number().min(0).max(20),
  line_style: lineStyleEnum,
  opacity: z.number().min(0).max(1),
  use_cursor_gap: z.boolean(),
  center_gap_px: z.number().min(0).max(100),
  lock_to_dpr: z.boolean(),
  ui_scale: z.number().min(0.1).max(10),
});

const cursorPickboxSchema = z.object({
  enabled: z.boolean(),
  shape: z.enum(['circle', 'square']),
  size: z.number().min(1).max(200),
  color: z.string(),
  line_style: lineStyleEnum,
  line_width: z.number().min(0).max(20),
  opacity: z.number().min(0).max(1),
});

const selectionBoxFaceSchema = z.object({
  fillColor: z.string(),
  fillOpacity: z.number().min(0).max(1),
  borderColor: z.string(),
  borderOpacity: z.number().min(0).max(1),
  borderStyle: lineStyleEnum,
  borderWidth: z.number().min(0).max(20),
});

const cursorSettingsSchema = z.object({
  crosshair: crosshairSchema,
  cursor: cursorPickboxSchema,
  selection: z.object({
    window: selectionBoxFaceSchema,
    crossing: selectionBoxFaceSchema,
  }),
  behavior: z.object({
    snap_indicator: z.boolean(),
    coordinate_display: z.boolean(),
    dynamic_input: z.boolean(),
    cursor_tooltip: z.boolean(),
  }),
  performance: z.object({
    use_raf: z.boolean(),
    throttle_ms: z.number().min(0).max(1000),
    precision_mode: z.boolean(),
  }),
});

// ─── Rulers / grid ───────────────────────────────────────────────────────────
// Permissive (passthrough) — owned by RulersGridSystem domain types, validated
// at the boundary of that subsystem (Phase 4).

const rulersGridSettingsSchema = z
  .object({
    rulers: z.unknown().optional(),
    grid: z.unknown().optional(),
    origin: z.unknown().optional(),
    isVisible: z.boolean().optional(),
  })
  .passthrough();

// ─── DXF settings (line / text / grip) ──────────────────────────────────────
// Permissive — schema owned by EnterpriseDxfSettingsProvider (Phase 3).

const dxfSettingsSliceSchema = z
  .object({
    line: z.unknown().optional(),
    text: z.unknown().optional(),
    grip: z.unknown().optional(),
  })
  .passthrough();

// ─── Snap (active types only — master flag stays ephemeral) ─────────────────

const snapSettingsSchema = z.object({
  activeTypes: z.array(z.string()),
  // knownTypes = the snap ids this build knew about when the blob was written. Lets the
  // load merge distinguish "explicitly off" from "shipped after this blob" so a new
  // default-on snap can't silently vanish for existing users (ADR-378, ADR-362 dim snaps).
  knownTypes: z.array(z.string()).optional(),
  tolerance: z.number().min(0).max(100).optional(),
});

// ─── CAD Toggles (toolbar toggles — persisted per user) ─────────────────────

const cadTogglesSchema = z.object({
  osnap: z.boolean(),
  grid: z.boolean(),
  snap: z.boolean(),
  ortho: z.boolean(),
  polar: z.boolean(),
  dynInput: z.boolean(),
  // Line-tool preview indicators (ADR-357 / ADR-508). `.default(true)` → blobs
  // persisted before these fields existed hydrate as ON (= current behaviour),
  // no silent vanish for existing users.
  dimHud: z.boolean().default(true),        // κατ. 2 — HUD μήκους/γωνίας
  dirArc: z.boolean().default(true),        // κατ. 3 — τόξο ΦΟΡΑΣ
  listeningDim: z.boolean().default(true),  // κατ. 1β — κυανές listening dims
  // Snap-mode (F9) increment step in scene units — quantizes the 2D grip-drag
  // delta (move + resize) so dimension/position changes follow a fixed step.
  // Optional for back-compat with docs persisted before this field existed.
  snapStep: z.number().min(0).optional(),
});

// ─── Auto-fill custom lists (ADR-828 Φ4β) ───────────────────────────────

/**
 * 🔴 ADR-828 §5 — **ΤΑ ΟΡΙΑ ΕΙΝΑΙ ΔΗΛΩΜΕΝΑ, ΓΙΑ ΝΑ ΜΗΝ ΚΟΒΕΙ ΚΑΝΕΙΣ ΣΙΩΠΗΛΑ.**
 *
 * Το Excel αποθηκεύει *«probably the first 255 entries»* μιας προσαρμοσμένης λίστας και
 * **δεν το λέει σε κανέναν**: η εκατοστή πέμπτη εγγραφή απλώς λείπει την επόμενη φορά.
 * Εδώ το «πολύ μεγάλο» γίνεται **σφάλμα επικύρωσης** — ή χωρά, ή ο άνθρωπος το μαθαίνει.
 *
 * 🔑 **Εξάγονται** επίτηδες: το ίδιο νούμερο που απορρίπτει η επικύρωση πρέπει να είναι
 * αυτό που δείχνει η διεπαφή πριν το πατήσει ο άνθρωπος. Δύο χειρόγραφα νούμερα θα
 * απέκλιναν, και η απόκλιση θα φαινόταν ως «το κουμπί δεν κάνει τίποτα».
 *
 * ⚠️ Το ανώτατο γινόμενο (20 × 200 × 120 ≈ 480 KB) μένει κάτω από το **1 MiB ανά έγγραφο**
 * του Firestore με περιθώριο για τα υπόλοιπα slices. Αν κάποτε ανέβουν, ανεβαίνουν
 * με **νέο υπολογισμό**, όχι με αίσθηση.
 */
export const AUTO_FILL_LIST_LIMITS = {
  /** Πόσες λίστες μπορεί να έχει ένας άνθρωπος. */
  maxLists: 20,
  /** Πόσες εγγραφές μία λίστα. */
  maxEntries: 200,
  /**
   * 🔑 **Δύο** και όχι μία: μια λίστα με ένα όνομα δεν έχει «επόμενο» — είναι
   * αντιγραφή μεταμφιεσμένη σε σειρά, και η αναδίπλωσή της θα έγραφε την ίδια λέξη ξανά και ξανά.
   */
  minEntries: 2,
  /** Μήκος μιας εγγραφής σε χαρακτήρες. */
  maxEntryLength: 120,
  /** Μήκος του ονόματος της λίστας. */
  maxNameLength: 60,
} as const;

/**
 * Μία προσαρμοσμένη λίστα.
 *
 * 🔑 **Η ταυτότητα είναι το όνομα** — κανένα συνθετικό `id`. Γίνεται γιατί μετά τον
 * Δρόμο Α (ADR-828 §Φ4β) **καμία σειρά δεν κρατά δείκτη σε λίστα**: κρατά τα ίδια τα
 * ονόματα. Άρα μετονομασία ή διαγραφή λίστας **δεν μπορεί** να ορφανέψει τίποτα — η
 * αναφορά που θα έσπαγε δεν υπάρχει εξ ορισμού. Το `id` θα ήταν δεύτερη ταυτότητα χωρίς
 * κανέναν να τη ρωτά.
 */
const autoFillListSchema = z.object({
  name: z.string().trim().min(1).max(AUTO_FILL_LIST_LIMITS.maxNameLength),
  entries: z
    .array(z.string().trim().min(1).max(AUTO_FILL_LIST_LIMITS.maxEntryLength))
    .min(AUTO_FILL_LIST_LIMITS.minEntries)
    .max(AUTO_FILL_LIST_LIMITS.maxEntries),
});

const autoFillListsSchema = z.object({
  lists: z.array(autoFillListSchema).max(AUTO_FILL_LIST_LIMITS.maxLists),
});

// ─── Top-level document ─────────────────────────────────────────────────────

export const USER_SETTINGS_SCHEMA_VERSION = 1 as const;

export const userSettingsSchema = z.object({
  userId: z.string().min(1),
  companyId: z.string().min(1),
  schemaVersion: z.literal(USER_SETTINGS_SCHEMA_VERSION),
  dxfViewer: z
    .object({
      cursor: cursorSettingsSchema.optional(),
      rulersGrid: rulersGridSettingsSchema.optional(),
      dxfSettings: dxfSettingsSliceSchema.optional(),
      snap: snapSettingsSchema.optional(),
      cadToggles: cadTogglesSchema.optional(),
      autoFillLists: autoFillListsSchema.optional(),
    })
    .optional(),
  updatedAt: z.unknown().optional(),
  updatedBy: z.string().optional(),
});

export type UserSettingsDoc = z.infer<typeof userSettingsSchema>;
export type CursorSettingsSlice = z.infer<typeof cursorSettingsSchema>;
export type RulersGridSettingsSlice = z.infer<typeof rulersGridSettingsSchema>;
export type DxfSettingsSlice = z.infer<typeof dxfSettingsSliceSchema>;
export type SnapSettingsSlice = z.infer<typeof snapSettingsSchema>;
export type CadTogglesSettingsSlice = z.infer<typeof cadTogglesSchema>;
export type AutoFillListsSlice = z.infer<typeof autoFillListsSchema>;
/** Μία προσαρμοσμένη λίστα — όνομα + οι εγγραφές της, με τη σειρά που τις έγραψε ο άνθρωπος. */
export type AutoFillList = AutoFillListsSlice['lists'][number];

/** All known slice paths under `dxfViewer`. Used by repository.update<T>(path, ...). */
export type DxfViewerSlicePath =
  | 'dxfViewer.cursor'
  | 'dxfViewer.rulersGrid'
  | 'dxfViewer.dxfSettings'
  | 'dxfViewer.snap'
  | 'dxfViewer.cadToggles'
  | 'dxfViewer.autoFillLists';
