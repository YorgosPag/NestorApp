/**
 * Hook for the Greek Administrative Hierarchy (Διοικητική Διαίρεση Ελλάδας).
 *
 * Lazily loads 20,713 entities (3.2 MB raw, ~490 KB gzip) and provides:
 * - Fast lookup by ID
 * - Search by name (accent-insensitive, punctuation-stripped)
 * - Bottom-up path resolution: given any entity, returns the full hierarchy upward
 * - Filtered search by level (e.g. only municipalities, only settlements)
 *
 * Data source: ΕΛΣΤΑΤ / Καλλικράτης
 * @see public/data/administrative-hierarchy.json — **η μία αυθεντία** (ADR-846 Φ4)
 */

import { useCallback } from 'react';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { createLazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import { emptyAdminPath, resolveAdminPath } from '@/lib/places/admin-path';
import { useLazySnapshot } from '@/hooks/useLazySnapshot';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useAdministrativeHierarchy');

// ============================================================================
// TYPES
// ============================================================================

/** Short-key entity as stored in the JSON file */
interface RawEntity {
  id: string;
  /** name */
  n: string;
  /** shortName */
  sn: string;
  /** normalizedName (no accents, lowercase) */
  nn: string;
  /** code (Kallikratis) */
  c: string;
  /** parentId */
  p: string | null;
  /** level (1-8) */
  l: number;
  /** κωδικός ΥΠΕΣ — **μόνο σε δήμους** (ADR-846 Φ4) */
  y?: string;
  /** postalCode (settlements only) */
  pc?: string;
  /** article (settlements only) */
  a?: string;
}

interface RawData {
  meta: {
    source: string;
    date: string;
    counts: Record<string, number>;
    levels: Record<string, string>;
  };
  data: RawEntity[];
}

/** Public entity with readable field names */
export interface AdminEntity {
  id: string;
  name: string;
  shortName: string;
  normalizedName: string;
  /**
   * Ο κωδικός **Καλλικράτη** — θεσιακός (`<Π.Ε.><σειρά>`) και **κλειδί γεωμετρίας**:
   * με αυτόν ο `build-admin-footprints` ζητά πολύγωνο από το WFS.
   */
  code: string;
  /**
   * Ο κωδικός **ΥΠΕΣ** *(`9001`–`9332`)* — **μόνο σε δήμους**, ADR-846 Φ4.
   *
   * 🔑 **Δεύτερη ταυτότητα με ΔΙΑΦΟΡΕΤΙΚΗ δουλειά, όχι εφεδρεία.** Ο Καλλικράτης είναι
   * **θεσιακός**, άρα κάθε μεταρρύθμιση τον ακυρώνει: ο Κλεισθένης γέννησε επτά δήμους
   * που **δεν έχουν** τέτοιο κωδικό, και το προηγούμενο script τους **επινόησε** —
   * πατώντας πάνω σε τρεις υπαρκτούς. Ο κωδικός ΥΠΕΣ δεν είναι θεσιακός: ο Κλεισθένης
   * πρόσθεσε `9326`–`9332` **χωρίς να πειράξει κανέναν** υπάρχοντα.
   *
   * ⚠️ **Απουσιάζει από το Άγιο Όρος** — αυτοδιοίκητο, δεν είναι δήμος.
   */
  ypesCode?: string;
  parentId: string | null;
  level: number;
  postalCode?: string;
  article?: string;
}

/** Level numbers and their keys */
export const ADMIN_LEVELS = {
  MAJOR_GEO: 1,
  DECENTRALIZED_ADMIN: 2,
  REGION: 3,
  REGIONAL_UNIT: 4,
  MUNICIPALITY: 5,
  MUNICIPAL_UNIT: 6,
  COMMUNITY: 7,
  SETTLEMENT: 8,
} as const;

export type AdminLevel = (typeof ADMIN_LEVELS)[keyof typeof ADMIN_LEVELS];

/**
 * **Πώς ΛΕΓΕΤΑΙ κάθε βαθμίδα** — κλειδιά i18n, όχι λέξεις.
 *
 * 🔴 **Ήταν οκτώ ωμά ελληνικά αλφαριθμητικά**, σε παραβίαση του N.11, και ήταν **δημόσια
 * ορατά**: ο αγγλόφωνος επισκέπτης του `/pro` διάβαζε «Περιφερειακή Ενότητα» δίπλα σε
 * μεταφρασμένο κείμενο. Καμία πύλη δεν το έπιανε — ο σαρωτής του N.11 ψάχνει
 * `defaultValue:` και `toast()`, και αυτά ήταν **σκέτος πίνακας**.
 *
 * 🔑 **Πλήρως προσδιορισμένα (`addresses:…`) επίτηδες**: οι τρεις καταναλωτές ζουν σε
 * **τρεις διαφορετικούς** χώρους ονομάτων *(`contacts`, `addresses`, και ο τρίτος σε
 * κανέναν)*. Ένα σχετικό κλειδί θα έλυνε σε **άλλο** namespace ανά σημείο κλήσης —
 * δηλαδή θα δούλευε στη μία οθόνη και θα τύπωνε το ωμό κλειδί στην άλλη.
 */
export const ADMIN_LEVEL_LABEL_KEYS: Record<number, string> = {
  1: 'addresses:hierarchy.levels.majorGeo',
  2: 'addresses:hierarchy.levels.decentAdmin',
  3: 'addresses:hierarchy.levels.region',
  4: 'addresses:hierarchy.levels.regionalUnit',
  5: 'addresses:hierarchy.levels.municipality',
  6: 'addresses:hierarchy.levels.municipalUnit',
  7: 'addresses:hierarchy.levels.community',
  8: 'addresses:hierarchy.levels.settlement',
};

/** Full resolved path from an entity up to the top level */
export interface AdminPath {
  majorGeo: AdminEntity | null;
  decentAdmin: AdminEntity | null;
  region: AdminEntity | null;
  regionalUnit: AdminEntity | null;
  municipality: AdminEntity | null;
  municipalUnit: AdminEntity | null;
  community: AdminEntity | null;
  settlement: AdminEntity | null;
}

// ============================================================================
// LAZY LOADING + CACHE
// ============================================================================

/**
 * **Τα φορτωμένα δεδομένα ως ΕΝΑ αμετάβλητο πράγμα** — και όχι δύο ανεξάρτητες
 * μεταβλητές module.
 *
 * 🔴 **ΓΙΑΤΙ ΑΛΛΑΞΕ (ADR-846, ζωντανό περπάτημα 2026-09-08)**: όσο τα δεδομένα ζούσαν σε
 * μεταβλητές module και οι αναγνώστες ήταν `useCallback(…, [])`, **η ταυτότητα των
 * αναγνωστών ΕΛΕΓΕ ΨΕΜΑΤΑ**: δεν άλλαζε ποτέ, ενώ αυτό που διάβαζαν άλλαζε **μία φορά**
 * — τη στιγμή που τελείωνε η φόρτωση. Κάθε καταναλωτής που έγραφε
 * `useMemo(…, [levelOptions])` **πάγωνε στο κενό** για όλη τη ζωή της σελίδας.
 *
 * ⚠️ **Δεν ήταν θεωρητικό**: στη φόρμα της βιτρίνας *(`AreaCombobox`)* ο επιλογέας
 * περιοχής **δεν εμφάνιζε ΚΑΜΙΑ** από τις 20.721 οντότητες σε πρώτο φόρτωμα, και έλεγε
 * *«Καμία περιοχή δεν ταιριάζει»* — δηλαδή παρουσίαζε το **«δεν ξέρω»** ως **«δεν
 * υπάρχει»**. Δύο από τους τρεις καταναλωτές είχαν θυμηθεί να βάλουν `isLoading` στη
 * λίστα εξαρτήσεων· ο τρίτος όχι. Ένας κανόνας που **πρέπει να τον θυμάται κάθε σημείο
 * κλήσης** δεν είναι κανόνας — είναι παγίδα με χρονοκαθυστέρηση.
 *
 * 🔑 **Η θεραπεία είναι δομική**: το στιγμιότυπο ταξιδεύει από `useState`, άρα η ταυτότητα
 * κάθε αναγνώστη αλλάζει **ακριβώς όταν** αλλάζουν τα δεδομένα του. Οι καταναλωτές δεν
 * χρειάζεται πια να ξέρουν τίποτα — και το `react-hooks/exhaustive-deps` μπορεί επιτέλους
 * να επαληθεύσει τις λίστες, επειδή δεν είναι ψεύτικες.
 */
export interface HierarchySnapshot {
  readonly entities: ReadonlyMap<string, AdminEntity>;
  readonly byLevel: ReadonlyMap<number, readonly AdminEntity[]>;
}

/**
 * **Η κατάσταση «ρώτησα και δεν έμαθα»** — διακριτή από το `null` *(«δεν ρώτησα ακόμη»)*.
 *
 * Γράφεται **μόνο** στην κατάσταση του component, **ποτέ** στο `cachedSnapshot`: έτσι μια
 * επόμενη προσάρτηση ξαναδοκιμάζει, αντί να κληρονομήσει την αποτυχία για πάντα.
 */
const EMPTY_SNAPSHOT: HierarchySnapshot = {
  entities: new Map<string, AdminEntity>(),
  byLevel: new Map<number, readonly AdminEntity[]>(),
};


function mapRawToEntity(raw: RawEntity): AdminEntity {
  const entity: AdminEntity = {
    id: raw.id,
    name: raw.n,
    shortName: raw.sn,
    normalizedName: raw.nn,
    code: raw.c,
    parentId: raw.p,
    level: raw.l,
  };
  if (raw.y) entity.ypesCode = raw.y;
  if (raw.pc) entity.postalCode = raw.pc;
  if (raw.a) entity.article = raw.a;
  return entity;
}

/**
 * **Ο τεμπέλης αναγνώστης της ιεραρχίας** — ο μηχανισμός ζει πλέον στο
 * `lib/data/lazy-json-snapshot.ts` *(ADR-846 Φ2.5)*.
 *
 * 🔴 **Ήταν γραμμένος ΕΔΩ, ιδιωτικός** — module cache + single-flight + `try/catch` που
 * αφήνει το cache άδειο + καθάρισμα της υπόσχεσης. Τέσσερις αποφάσεις, **όλες**
 * πληρωμένες με περιστατικό. Όταν τα **αποτυπώματα** (`lib/geo/admin-footprints.ts`)
 * χρειάστηκαν ακριβώς το ίδιο σχήμα, η επιλογή ήταν «δεύτερο αντίγραφο» ή «μία μηχανή».
 * Το αντίγραφο θα ήταν το sibling clone του **N.18**, με τις τέσσερις αποφάσεις να
 * αποκλίνουν σιωπηλά. Δες την κεφαλίδα του `lazy-json-snapshot.ts`.
 *
 * ⚠️ **Ο έλεγχος `Array.isArray` ΜΕΝΕΙ ΚΡΙΣΙΜΟΣ**: χωρίς αυτόν, μια σελίδα σφάλματος
 * του διακομιστή ή το HTML fallback του SPA δίνει `TypeError: … is not iterable` **μέσα
 * σε render**, και το δημόσιο `/pro` **εξαφανίζεται**. Πετώντας εδώ, η αποτυχία
 * γίνεται κανονική «δεν ξέρω».
 *
 * 🔑 **Εξάγεται για τον ίδιο λόγο που εξάγεται το `ADMIN_FOOTPRINTS_SOURCE`**: ο
 * `lineageIdsOf` είναι **σύγχρονος** και διαβάζει module cache, άρα ο μόνος τρόπος να
 * τον ελέγξει κανείς **όπως τρέχει** είναι να γεμίσει πρώτα το cache. Χωρίς αυτή την
 * εξαγωγή, κάθε άγκυρα είναι υποχρεωμένη να **ξαναγράψει** τον περίπατο γενεαλογίας —
 * δηλαδή να επαληθεύσει τη φαντασία της αντί για τον κώδικα (N.18). ⚠️ Καταναλωτής σε
 * χρόνο εκτέλεσης παραμένει **ένας**: το {@link useAdministrativeHierarchy}.
 */
export const HIERARCHY_SOURCE = createLazyJsonSnapshot<HierarchySnapshot>({
  url: '/data/administrative-hierarchy.json',
  build: (payload) => {
    const rawData = payload as Partial<RawData>;
    if (!Array.isArray(rawData.data)) {
      throw new TypeError('Η διοικητική ιεραρχία δεν έχει το αναμενόμενο σχήμα');
    }

    const entityMap = new Map<string, AdminEntity>();
    const levelMap = new Map<number, AdminEntity[]>();

    for (const raw of rawData.data) {
      const entity = mapRawToEntity(raw);
      entityMap.set(entity.id, entity);

      const levelList = levelMap.get(entity.level);
      if (levelList) {
        levelList.push(entity);
      } else {
        levelMap.set(entity.level, [entity]);
      }
    }

    return { entities: entityMap, byLevel: levelMap };
  },
  onFailure: (error) => {
    logger.warn('Δεν φορτώθηκε η διοικητική ιεραρχία — οι περιοχές μένουν άγνωστες', {
      error: error instanceof Error ? error.message : String(error),
    });
  },
});

// ============================================================================
// SEARCH HELPERS
// ============================================================================

/** Normalize text for accent+punctuation-insensitive Greek search */
function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.\-_/\\()]/g, '')
    .toLowerCase();
}

// ============================================================================
// ΓΕΝΕΑΛΟΓΙΑ — εκτός hook, επίτηδες (ADR-846)
// ============================================================================

/**
 * **Η γραμμή μιας οντότητας προς τη ρίζα, ΜΕ ΤΟΝ ΕΑΥΤΟ ΤΗΣ ΠΡΩΤΟ** — π.χ.
 * `['community:…', 'municipalUnit:…', 'municipality:…', …, 'major_geographic_unit:2']`.
 *
 * 🔑 **Γιατί ζει ΕΞΩ από το hook** *(ADR-846)*: ο καταναλωτής της είναι το
 * `lib/agency/coverage-match.ts` — **καθαρό φύλλο** που καλείται μέσα από `useMemo` και
 * **δεν επιτρέπεται** να εισάγει React. Ένα δεύτερο πέρασμα πάνω στα ίδια δεδομένα μέσα
 * στο `lib/` θα ήταν κλώνος του `resolvePath` *(N.18)*· ένα `resolvePath` μέσα σε
 * `useCallback` δεν μπορεί να ταξιδέψει εκεί. Άρα: **ίδιο module cache, μία γραφή,
 * χωρίς hook**.
 *
 * ⚠️ **Κενός πίνακας = «δεν ξέρω»** — είτε η ιεραρχία δεν έχει φορτώσει *(τεμπέλικη
 * φόρτωση 4,1 MB)*, είτε το id δεν υπάρχει. Ο καλών **οφείλει** να το ξεχωρίσει από
 * «καμία σχέση»: δες τη σύμβαση του `LineageResolver`.
 *
 * ⚠️ **Δεν διπλασιάζει το `resolvePath`** — εκείνο απαντά *«ποια οντότητα σε κάθε
 * βαθμίδα;»* *(δοχείο 8 θέσεων, για **διεύθυνση**)*· αυτό απαντά *«ποιοι με περιέχουν;»*
 * *(αλυσίδα, για **σχέση**)*. Ίδια διαδρομή, **διαφορετική ερώτηση** — και η δεύτερη
 * δεν εκφράζεται από την πρώτη χωρίς να ξέρει ο καλών ποια κλειδιά είναι `null`.
 */
export function lineageIdsOf(entityId: string): readonly string[] {
  const entities = HIERARCHY_SOURCE.peek()?.entities;
  if (!entities) return [];

  const lineage: string[] = [];
  let current: AdminEntity | undefined = entities.get(entityId);
  // 🔒 Φρουρός κύκλου: δεδομένα ΕΛΣΤΑΤ, αλλά ένας κύκλος parentId θα κρέμαγε την οθόνη
  //    αθόρυβα. Το βάθος είναι 8 — το 16 είναι διπλάσιο κάθε νόμιμης αλυσίδας.
  let guard = 16;
  while (current && guard-- > 0) {
    lineage.push(current.id);
    current = current.parentId ? entities.get(current.parentId) : undefined;
  }
  return lineage;
}

// ============================================================================
// ΑΝΑΓΝΩΣΤΕΣ — καθαροί, πάνω σε στιγμιότυπο (ADR-846)
// ============================================================================
//
// 🔑 **Ζουν ΕΞΩ από το hook επίτηδες.** Δύο κέρδη, και τα δύο μετρήσιμα:
//    1. Το σώμα του hook μένει **κάτω από 40 γραμμές** (N.7.1) αντί για ~110.
//    2. Η απάντηση κάθε αναγνώστη εξαρτάται **μόνο** από τα ορίσματά του — άρα
//       ελέγχεται χωρίς React, και η ταυτότητά του μέσα στο hook προκύπτει από
//       **ένα** πράγμα: το στιγμιότυπο.

/**
 * Ετικέτα αποσαφήνισης, ανεβαίνοντας τη γονική αλυσίδα.
 * π.χ. Οικισμός «Αγία Παρασκευή» → «Δ. Λέσβου, Π.Ε. Λέσβου»
 * Ξεχωρίζει τους **1.369** ομώνυμους οικισμούς.
 */
function secondaryLabelOf(snapshot: HierarchySnapshot, entity: AdminEntity): string {
  const parts: string[] = [];
  let current: AdminEntity | undefined = entity.parentId
    ? snapshot.entities.get(entity.parentId)
    : undefined;

  while (current) {
    if (current.level === ADMIN_LEVELS.MUNICIPALITY) {
      parts.push(`Δ. ${current.shortName || current.name}`);
    } else if (current.level === ADMIN_LEVELS.REGIONAL_UNIT) {
      parts.push(`Π.Ε. ${current.shortName || current.name}`);
      break;
    }
    current = current.parentId ? snapshot.entities.get(current.parentId) : undefined;
  }

  if (entity.postalCode) parts.push(`ΤΚ ${entity.postalCode}`);

  return parts.join(', ');
}

/** Ομώνυμα υπάρχουν από τον Δήμο και κάτω — μόνο εκεί κοστίζει η αποσαφήνιση. */
function needsDisambiguation(level: number): boolean {
  return level >= ADMIN_LEVELS.MUNICIPALITY;
}

function toOption(
  snapshot: HierarchySnapshot,
  entity: AdminEntity,
  level: number,
): ComboboxOption {
  return {
    value: entity.id,
    label: entity.name,
    secondaryLabel: needsDisambiguation(level) ? secondaryLabelOf(snapshot, entity) : undefined,
  };
}

function entitiesAtLevel(snapshot: HierarchySnapshot, level: AdminLevel): AdminEntity[] {
  return [...(snapshot.byLevel.get(level) ?? [])];
}

function childrenOf(snapshot: HierarchySnapshot, parentId: string): AdminEntity[] {
  const children: AdminEntity[] = [];
  snapshot.entities.forEach((entity) => {
    if (entity.parentId === parentId) children.push(entity);
  });
  return children;
}

function searchAtLevel(
  snapshot: HierarchySnapshot,
  query: string,
  level: AdminLevel,
  maxResults: number,
): ComboboxOption[] {
  if (!query.trim()) return [];

  const normalizedQuery = normalizeSearch(query);
  const results: ComboboxOption[] = [];

  for (const entity of snapshot.byLevel.get(level) ?? []) {
    if (results.length >= maxResults) break;
    if (normalizeSearch(entity.name).includes(normalizedQuery)) {
      results.push(toOption(snapshot, entity, level));
    }
  }

  return results;
}

function optionsAtLevel(snapshot: HierarchySnapshot, level: AdminLevel): ComboboxOption[] {
  return (snapshot.byLevel.get(level) ?? []).map((entity) => toOption(snapshot, entity, level));
}

// ============================================================================
// HOOK
// ============================================================================

interface UseAdministrativeHierarchyReturn {
  /** Whether the hierarchy data is still loading */
  isLoading: boolean;
  /** Find entity by ID */
  findById: (id: string) => AdminEntity | undefined;
  /** Resolve full path upward from any entity */
  resolvePath: (entityId: string) => AdminPath;
  /** Get all entities at a specific level */
  getByLevel: (level: AdminLevel) => AdminEntity[];
  /** Search entities by name at a specific level, returns ComboboxOption[] */
  searchOptions: (query: string, level: AdminLevel, maxResults?: number) => ComboboxOption[];
  /** Get children of a specific entity */
  getChildren: (parentId: string) => AdminEntity[];
  /** All entities at a level as ComboboxOption[] */
  levelOptions: (level: AdminLevel) => ComboboxOption[];
}

/**
 * 🔑 **Η ταυτότητα ΚΑΘΕ αναγνώστη κρέμεται από το `snapshot`, και ΜΟΝΟ από αυτό.**
 * Ένας καταναλωτής που γράφει `useMemo(…, [levelOptions])` είναι **σωστός εξ ορισμού**:
 * όταν φτάσουν τα δεδομένα, η ταυτότητα αλλάζει και ο υπολογισμός ξαναγίνεται.
 * ⛔ **ΜΗΝ** ξαναγυρίσεις τις εξαρτήσεις σε `[]` «για σταθερότητα» — αυτό ήταν ακριβώς
 * το σφάλμα που άφηνε τον επιλογέα περιοχής **άδειο** σε πρώτο φόρτωμα (ADR-846).
 */
export function useAdministrativeHierarchy(): UseAdministrativeHierarchyReturn {
  // ⚠️ Αποτυχία ⇒ `EMPTY_SNAPSHOT`: η οθόνη σταματά να λέει «φορτώνω» και οι αναγνώστες
  //    απαντούν «δεν ξέρω» με κενό — ενώ το cache μένει άδειο, ώστε η επόμενη
  //    προσάρτηση να **ξαναρωτήσει**. Ο μηχανισμός ζει στο `hooks/useLazySnapshot.ts`.
  const snapshot = useLazySnapshot(HIERARCHY_SOURCE, EMPTY_SNAPSHOT);

  const findById = useCallback(
    (id: string): AdminEntity | undefined => snapshot?.entities.get(id),
    [snapshot],
  );

  const resolvePath = useCallback(
    (entityId: string): AdminPath =>
      snapshot ? resolveAdminPath(snapshot, entityId) : emptyAdminPath(),
    [snapshot],
  );

  const getByLevel = useCallback(
    (level: AdminLevel): AdminEntity[] => (snapshot ? entitiesAtLevel(snapshot, level) : []),
    [snapshot],
  );

  const getChildren = useCallback(
    (parentId: string): AdminEntity[] => (snapshot ? childrenOf(snapshot, parentId) : []),
    [snapshot],
  );

  const searchOptions = useCallback(
    (query: string, level: AdminLevel, maxResults = 30): ComboboxOption[] =>
      snapshot ? searchAtLevel(snapshot, query, level, maxResults) : [],
    [snapshot],
  );

  const levelOptions = useCallback(
    (level: AdminLevel): ComboboxOption[] => (snapshot ? optionsAtLevel(snapshot, level) : []),
    [snapshot],
  );

  return {
    isLoading: snapshot === null,
    findById,
    resolvePath,
    getByLevel,
    searchOptions,
    getChildren,
    levelOptions,
  };
}
