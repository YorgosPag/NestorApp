// Design tokens — Layout module
// zIndex, dialog sizes, grid patterns, breakpoints, interactive states,
// entity list tokens, designTokens aggregate

import { colors, spacing, typography, shadows, animation, transitions, semanticColors } from './foundations';
import { borders } from './borders';
import { componentSizes } from './component-sizes';
import { zIndexScale } from '../generated/tokens';

/**
 * 🏢 ENTERPRISE Z-INDEX HIERARCHY — το TS πρόσωπο της **μίας** κλίμακας.
 *
 * 🔴 ΜΕΧΡΙ ΤΙΣ 2026-08-08 ΑΥΤΟ ΗΤΑΝ ΧΕΙΡΟΓΡΑΦΟ ΑΝΤΙΓΡΑΦΟ, με το σχόλιο «Synced with
 * design-tokens.json» — μια **ανάθεση σε άνθρωπο**, που **καμία πύλη δεν επέβαλλε**. Οι
 * αριθμοί έτυχε να συμφωνούν· τίποτα δεν εγγυόταν ότι θα συνεχίσουν. Είναι το σχήμα
 * ADR-749 (δύο αλήθειες για το ίδιο ερώτημα) και το σχήμα του CHECK 3.34 (δύο λίστες
 * namespace που είχαν **αποκλίνει κατά 63** χωρίς κανείς να τις συγκρίνει).
 *
 * Πλέον **παράγεται** από το `design-tokens.json` (`npm run build:tokens`), δηλαδή η
 * ίδια πηγή που δίνει και τα `--z-index-*` του CSS. Ένας ρόλος που προστίθεται εκεί
 * εμφανίζεται εδώ **μόνος του**.
 *
 * ⚠️ ΜΗΝ ξαναγράψεις αριθμό εδώ. Πρόσθεσε τον ρόλο στο `design-tokens.json` και τρέξε
 * `npm run build:tokens`. Το CHECK 3.50 μπλοκάρει ωμούς αριθμούς.
 *
 * Τα `hide`/`auto` **δεν** είναι στρώσεις — είναι CSS λέξεις-κλειδιά (`z-index: auto`
 * σημαίνει «μη δημιουργείς stacking context»), οπότε δεν ανήκουν σε διατεταγμένη
 * κλίμακα και μένουν εδώ.
 */
export const zIndex = {
  hide: -1,
  auto: 'auto',
  ...zIndexScale,
} as const;

// ============================================================================
// 🏢 ENTERPRISE: DIALOG/MODAL SIZE TOKENS
// ============================================================================
// Centralized dialog sizing for consistent modal dimensions
// ADR-031: Zero hardcoded values - all dialog sizes from here
// ============================================================================
export const DIALOG_SIZES = {
  /** Small dialog (400px) - confirmations, simple forms */
  sm: 'sm:max-w-md',
  /** Medium dialog (600px) - standard forms, selections */
  md: 'sm:max-w-[600px]',
  /** Large dialog (800px) - complex forms */
  lg: 'sm:max-w-[800px]',
  /** Extra large dialog (900px) - contact forms, multi-tab dialogs */
  xl: 'sm:max-w-[900px]',
  /** Full width dialog (1200px) - dashboards, complex UIs */
  full: 'sm:max-w-[1200px]',
} as const;

export const DIALOG_HEIGHT = {
  /** Standard dialog height constraint */
  standard: 'max-h-[90vh]',
  /** Shorter dialog for simpler content */
  short: 'max-h-[70vh]',
  /** Auto height - content determines */
  auto: '',
} as const;

export const DIALOG_SCROLL = {
  /** Enable vertical scrolling */
  scrollable: 'overflow-y-auto',
  /** No scroll - fixed content */
  fixed: 'overflow-hidden',
} as const;

/**
 * 🏢 Ο ΕΝΑΣ ΑΡΙΘΜΟΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ΚΑΡΤΩΝ — ADR-777 §8.21 / SPEC-777D §26.9.
 *
 * ── ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΣΚΑΛΑ BREAKPOINT ──
 *
 * Μια σκάλα με προθέματα οθόνης ρωτά «πόσο φαρδύ είναι **το παράθυρο**». Αλλά τρεις από τους
 * τέσσερις καταλόγους ακινήτων ζουν μέσα σε **δοχείο** που δεν είναι το παράθυρο: το
 * `property-viewer/PropertyGrid` σε split pane (λίστα+λεπτομέρειες), τα Parking/Storage μέσα σε
 * `ScrollArea flex-1`. Το παράθυρο μπορεί να είναι 2560 px ενώ το δοχείο τους είναι 600 px —
 * δηλαδή απαντούσαν **σωστά σε ερώτηση που δεν ήταν η δική τους**.
 *
 * Ο εγγενής κατάλογος **δεν ρωτά κανέναν**: το `repeat(auto-fill, …)` αφήνει τη μηχανή διάταξης
 * να χωρέσει όσες στήλες χωράνε στο **πραγματικό** πλάτος του γονέα. Μηδέν breakpoints, μηδέν
 * JavaScript, σωστό και στο split pane και στα 2560 px. Είναι **βήμα πέρα** από τη σκάλα που
 * προδιαγράφει το Material 3, και δεν χρειάζεται καν container query: ένα container query θα
 * χρειαζόταν αν άλλαζαν τα **εσωτερικά** της κάρτας — εδώ αλλάζει μόνο το **πλήθος** στηλών.
 *
 * ── 🔴 ΓΙΑΤΙ `auto-fill` ΚΑΙ ΟΧΙ `auto-fit` ──
 *
 * Το `auto-fit` **συμπτύσσει** τις κενές στήλες: με **ένα** ακίνητο σε οθόνη 2560 px, εκείνη η
 * μία κάρτα **τεντώνεται σε 2560 px**. Ο `auto-fill` κρατά τις κενές στήλες, άρα η μοναδική
 * κάρτα μένει στο φυσικό της πλάτος, στοιχισμένη αριστερά. Για **κατάλογο** η σωστή απάντηση
 * είναι πάντα ο `auto-fill`. Φρουρείται με άγκυρα — είναι ακριβώς το είδος λεπτομέρειας που
 * «απλοποιείται» αργότερα.
 *
 * ── 🔴 ΓΙΑΤΙ ΤΟ `min(100%, …)` ΔΕΝ ΕΙΝΑΙ ΠΟΛΥΤΕΛΕΙΑ ──
 *
 * Χωρίς αυτό, όταν το δοχείο είναι **στενότερο** από το ελάχιστο, η στήλη μένει στο ελάχιστο και
 * το πλέγμα **ξεχειλίζει οριζόντια** — ακριβώς η βλάβη κινητού που υποτίθεται ότι λύνουμε. Το
 * `min(100%, …)` κάνει τη στήλη να καταρρεύσει στο πλάτος του δοχείου. Φρουρείται με άγκυρα.
 *
 * ── ΑΠΟ ΠΟΥ ΒΓΑΙΝΕΙ ΤΟ 20rem (320 px) — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΔΙΑΛΕΓΜΕΝΟ ──
 *
 * Δάπεδο από τις **ίδιες τις δηλώσεις** της `PropertyCard`: εσωτερικό περιθώριο 40 px + υποσέλιδο
 * (κύριο κουμπί με εικονίδιο 16 + κενό 8 + ελληνική ετικέτα ~118 + περιθώρια 32 = 174· δεύτερο
 * κουμπί 48· κενό 8) = **270 px**. Τα 320 px αφήνουν περιθώριο για μακρύτερες ελληνικές ετικέτες
 * και δίνουν στην εικόνα ύψους 192 px αναλογία 5:3 — η σωστή για φωτογραφία ακινήτου.
 *
 * ── 🔴 ΔΥΟ ΟΙΚΟΓΕΝΕΙΕΣ ΚΑΡΤΩΝ, ΔΥΟ ΑΡΙΘΜΟΙ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΠΡΟΤΙΜΗΣΗ ──
 *
 * Η πρώτη γραφή αυτού του μπλοκ είχε **έναν** αριθμό για όλους τους καταλόγους. Η μέτρηση το
 * ανέτρεψε: οι τρεις από τους τέσσερις καταλόγους αποδίδουν το κέλυφος `GridCard` — **συμπαγές
 * πλακίδιο χωρίς εικόνα** (εικονίδιο · τίτλος · υπότιτλος · σήματα που αναδιπλώνονται). Ο
 * τέταρτος αποδίδει την `PropertyCard`, με **εικόνα ύψους 192 px** και υποσέλιδο δύο κουμπιών.
 * Ένας κοινός αριθμός θα αραίωνε τα πλακίδια κατά μία ολόκληρη στήλη ή θα στρίμωχνε την εικόνα.
 *
 * **Ένας μηχανισμός, δύο δηλωμένα ελάχιστα** — αυτό είναι κεντρικοποίηση· ένας αριθμός για
 * διαφορετικά πράγματα θα ήταν ισοπέδωση.
 *
 * ⚠️ **Κάθε αριθμός εμφανίζεται ΑΚΡΙΒΩΣ ΜΙΑ ΦΟΡΑ σε όλο το repo** — εδώ. Κάθε άλλη μορφή του
 * καταλόγου **συντίθεται** από αυτές τις σταθερές, ποτέ δεν τις ξαναγράφει. Άγκυρα το φυλάει.
 *
 * ⚠️ **ΜΗΝ τα κάνεις συνάρτηση** που δέχεται το ελάχιστο ως όρισμα: ο σαρωτής του Tailwind
 * διαβάζει **κείμενο πηγής**, δεν εκτελεί κώδικα. Μια παραγόμενη συμβολοσειρά **δεν γίνεται
 * ποτέ CSS** — θα ήταν κλάση που περνά σε κάθε test και είναι νεκρή στην οθόνη.
 */

/**
 * **Κάρτα με εικόνα** (`PropertyCard`) — δάπεδο **270 px** από τις ίδιες της τις δηλώσεις:
 * εσωτερικό περιθώριο 40 + υποσέλιδο (κύριο κουμπί: εικονίδιο 16 + κενό 8 + ελληνική ετικέτα
 * ~118 + περιθώρια 32 = 174· δεύτερο κουμπί 48· κενό 8) = 230. Τα **20rem** αφήνουν περιθώριο
 * για μακρύτερες ελληνικές ετικέτες και δίνουν στην εικόνα των 192 px αναλογία **5:3** — τη
 * σωστή για φωτογραφία ακινήτου.
 */
const CATALOG_COLUMNS_MEDIA = 'grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]';

/**
 * **Συμπαγές πλακίδιο** (`GridCard`) — τα **15rem** δεν είναι διαλεγμένα, είναι **αυτό που
 * παράγει ήδη η σημερινή σκάλα στο πυκνότερο σκαλί της**: το πέμπτο σκαλί ενεργοποιείται στα
 * 1536 px, όπου το pane της διαχείρισης χώρων είναι ~1248 px· αφαιρώντας τα τέσσερα κενά των
 * 16 px μένουν (1248−64)/5 = **237 px** ανά πλακίδιο. Δηλαδή η πυκνότητα που **επέλεξαν** οι
 * σχεδιαστές διατηρείται ακριβώς εκεί που την επέλεξαν, και διορθώνεται παντού αλλού.
 */
const CATALOG_COLUMNS_TILE = 'grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]';

// Grid patterns για layout consistency
export const gridPatterns = {
  // Stats grids
  stats: {
    mobile: 'grid-cols-1',
    tablet: 'sm:grid-cols-2',
    desktop: 'lg:grid-cols-4',
    gap: 'gap-4',
    full: 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  },

  // Action buttons
  actions: {
    mobile: 'grid-cols-1',
    tablet: 'sm:grid-cols-3',
    gap: 'gap-4',
    full: 'grid gap-4 grid-cols-1 sm:grid-cols-3'
  },

  /**
   * Κατάλογος καρτών — **η μία** απάντηση στο «πόσες στήλες;».
   *
   * 🔴 ΜΕΧΡΙ ΤΙΣ 2026-08-11 ΑΥΤΗ Η ΕΓΓΡΑΦΗ ΗΤΑΝ **ΑΔΡΑΝΗΣ ΑΥΘΕΝΤΙΑ**: δήλωνε τη δική της σκάλα
   * breakpoint και είχε **μηδέν** καταναλωτές (μόνο το `designSystem.layout.grid`, που κι αυτό
   * είχε μηδέν). Στο μεταξύ **τέσσερις** κατάλογοι ακινήτων δήλωναν ο καθένας **δική του**
   * σκάλα, και μια πέμπτη επιφάνεια δεν δήλωνε καμία. Πέντε διαφορετικές απαντήσεις στο ίδιο
   * ερώτημα, με τη δηλωμένη αυθεντία να μην τη ρωτά κανείς — το σχήμα του ADR-749 και των
   * «606 αδρανών φρουρών» του §5 του. Ένας φρουρός που δεν τον καλεί κανείς είναι σχόλιο.
   *
   * Δεν προστέθηκε νέο κλειδί δίπλα της: **διορθώθηκε επί τόπου**, ώστε να μην υπάρξει έκτο
   * λεξιλόγιο. Ό,τι τη ρωτήσει από δω και πέρα παίρνει τη σωστή απάντηση χωρίς να το ζητήσει.
   */
  cards: {
    /** Η «λίστα» — μία στήλη. Ο ίδιος μηχανισμός πλέγματος, ένα σκαλί. */
    single: 'grid-cols-1',
    /** Κατάλογος από **κάρτες με εικόνα**. Σκεπτικό πάνω από το `CATALOG_COLUMNS_MEDIA`. */
    media: CATALOG_COLUMNS_MEDIA,
    /** Κατάλογος από **συμπαγή πλακίδια**. Σκεπτικό πάνω από το `CATALOG_COLUMNS_TILE`. */
    tile: CATALOG_COLUMNS_TILE,
    gap: 'gap-4',
    /** ⚠️ ΣΥΝΤΙΘΕΤΑΙ — ποτέ ξαναγραμμένο, αλλιώς ο ένας αριθμός γίνεται δύο. */
    full: `grid gap-4 ${CATALOG_COLUMNS_MEDIA}`,
  },

  // Form layouts
  form: {
    single: 'grid-cols-1',
    double: 'md:grid-cols-2',
    triple: 'lg:grid-cols-3',
    gap: 'gap-4',
    fullDouble: 'grid gap-4 grid-cols-1 md:grid-cols-2',
    fullTriple: 'grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }
} as const;

// Responsive breakpoints (matching Tailwind defaults)
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Interactive states για consistent hover/focus patterns
export const interactiveStates = {
  // Card interactions
  card: {
    base: 'transition-all duration-200',
    hover: 'hover:shadow-md hover:scale-[1.02]',
    focus: 'focus:ring-2 focus:ring-ring focus:ring-offset-2',
    active: 'active:scale-[0.98]',
    full: 'transition-all duration-200 hover:shadow-md hover:scale-[1.02] focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-[0.98]'
  },

  // Button interactions
  button: {
    base: 'transition-colors duration-200',
    hover: 'hover:opacity-90',
    focus: 'focus:ring-2 focus:ring-ring focus:ring-offset-2',
    active: 'active:scale-95',
    full: 'transition-colors duration-200 hover:opacity-90 focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95'
  },

  // Link interactions
  link: {
    base: 'transition-colors duration-200',
    hover: 'hover:text-primary hover:underline',
    focus: 'focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded-sm',
    full: 'transition-colors duration-200 hover:text-primary hover:underline focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded-sm'
  }
} as const;

// ============================================================================
// 🏢 ENTITY LIST TOKENS
// ============================================================================

/**
 * 🏢 ENTITY_LIST_PRIMITIVES
 *
 * Single Source of Truth for all entity list dimensions.
 * ALL derived values (classes, CSS) MUST reference these primitives.
 *
 * @enterprise Fortune 500 compliant - Autodesk/Bentley standard
 * @immutable These values should NEVER be duplicated or hardcoded elsewhere
 */
const ENTITY_LIST_PRIMITIVES = {
  /** Minimum width of entity list column in pixels */
  MIN_WIDTH: 300,
  /** Maximum width of entity list column in pixels */
  MAX_WIDTH: 420,
  /** Space reserved for scrollbar appearance on hover in pixels */
  SCROLLBAR_SPACE: 8,
} as const;

/**
 * 🏢 ENTITY_LIST_TOKENS
 *
 * Centralized tokens for entity list columns (Buildings, Contacts, Units, etc.)
 *
 * ⚠️ CRITICAL: Tailwind classes MUST be STATIC strings (not template literals)!
 * Template literals like `min-w-[${VALUE}px]` are NOT detected by Tailwind JIT
 * and no CSS will be generated - causing full-width layouts.
 *
 * ✅ SOLUTION: Use CSS variables with static class names:
 *    min-w-[var(--entity-list-min)] instead of min-w-[${VALUE}px]
 *
 * CSS Variables defined in: src/app/globals.css
 *   --entity-list-min: 300px
 *   --entity-list-max: 420px
 *   --entity-list-scrollbar-space: 8px
 *
 * @enterprise Fortune 500 compliant - Autodesk/Bentley/Google standard
 * @see ENTITY_LIST_PRIMITIVES for numeric values (kept for reference)
 * @see src/app/globals.css for CSS variable definitions
 * @see src/core/containers/EntityListColumn.tsx - Component that uses these tokens
 * @author Enterprise Architecture Team
 * @since 2026-01-09
 */
export const ENTITY_LIST_TOKENS = {
  /** 🏢 RAW NUMERIC VALUES - Direct access to primitives (for reference only) */
  values: ENTITY_LIST_PRIMITIVES,

  /**
   * Width constraints for list columns
   * ✅ STATIC class names using CSS variables - Tailwind JIT compatible
   */
  width: {
    min: 'min-w-[var(--entity-list-min)]',
    max: 'max-w-[var(--entity-list-max)]',
    /** Combined width classes */
    combined: 'min-w-[var(--entity-list-min)] max-w-[var(--entity-list-max)]',
  },

  /**
   * 🏢 CARD DIMENSIONS - For items inside list
   * ✅ STATIC class names using CSS variables - Tailwind JIT compatible
   */
  card: {
    /** Width accounting for scrollbar space on hover */
    width: 'w-[calc(100%-var(--entity-list-scrollbar-space))]',
    /** Full width without scrollbar compensation */
    fullWidth: 'w-full',
  },

  /** Layout configuration - Standard flexbox patterns */
  layout: {
    display: 'flex',
    direction: 'flex-col',
    shrink: 'shrink-0',
    /** Combined layout classes */
    combined: 'flex flex-col shrink-0',
  },

  /** Visual styling - Semantic token references */
  visual: {
    background: 'bg-card',
    shadow: 'shadow-sm',
    overflow: 'overflow-hidden',
    maxHeight: 'max-h-full',
    heightFit: 'h-fit',
  },
} as const;

/** Type for ENTITY_LIST_TOKENS for external usage */
export type EntityListTokens = typeof ENTITY_LIST_TOKENS;

// Export all tokens as a single object για convenience
export const designTokens = {
  spacing,
  typography,
  borderRadius: borders.radius,
  shadows,
  animation,
  transitions,
  colors,
  semanticColors,
  zIndex,
  gridPatterns,
  componentSizes,
  breakpoints,
  interactiveStates,
} as const;
