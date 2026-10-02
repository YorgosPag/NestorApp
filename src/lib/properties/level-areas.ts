/**
 * @fileoverview **Το μικτό εμβαδόν ανά επίπεδο** ενός πολυεπίπεδου ακινήτου (ADR-236 · ADR-898 Φ3β-3β) — η ΜΙΑ
 * ανάγνωση του `levelData[floorId].areas.gross`, από ωμό έγγραφο (`unknown`).
 * @related `lib/properties/floor-helpers.ts` (`propertyAreaOnFloor` — κατανομή κόστους, ADR-329) ·
 *   `services/listings/public-listing-objective-value.ts` (βάση υπολογισμού της αντικειμενικής) ·
 *   `services/multi-level.service.ts` (`buildEmptyLevelData` σπέρνει `gross: 0`)
 * @module lib/properties/level-areas
 *
 * 🔑 **`0` = «δεν συμπληρώθηκε», ποτέ «0 τ.μ.»**: κάθε νέο επίπεδο γεννιέται με `gross: 0` (`buildEmptyLevelData`).
 *
 * 🔑 **Όλα ή τίποτα** ({@link readLevelAreas}): η αντικειμενική (ΠΟΛ.1149/1994 άρθ. 3 §6.β) υπολογίζει **χωριστά κάθε
 * όροφο**, με συντελεστή επιφάνειας στο **άθροισμα**. Μια μερική ή ασυνεπής λίστα θα έδινε ποσό με μαντεμένη κατανομή ⇒
 * `null`, και ο καλών λέει «τι λείπει».
 *
 * ⛔ **ΜΗΝ** εφαρμόσεις τον κανόνα του Ε9 (μία γραμμή, ψηλότερος όροφος): είναι το έντυπο του ΕΝΦΙΑ, όχι της
 * αντικειμενικής μεταβίβασης (ADR-898 §15).
 */

/** Ένα επίπεδο της βάσης υπολογισμού: ο όροφος (αριθμός, όπως `PropertyLevel.floorNumber`) και το μικτό του εμβαδόν. */
export interface LevelArea {
  readonly floor: number;
  readonly grossSqm: number;
}

/** Ανοχή στρογγυλοποίησης ανάμεσα στο άθροισμα των επιπέδων και στο συνολικό μικτό (τ.μ.). */
const SUM_TOLERANCE_SQM = 0.01;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveArea(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Το μικτό εμβαδόν **ενός** επιπέδου — `null` όταν λείπει, είναι άκυρο ή είναι ο σπόρος `0`. */
export function levelGrossArea(levelData: unknown, floorId: string): number | null {
  if (!isRecord(levelData)) return null;
  const level = levelData[floorId];
  if (!isRecord(level) || !isRecord(level.areas)) return null;
  return positiveArea(level.areas.gross);
}

interface LevelRef {
  readonly floorId: string;
  readonly floor: number;
}

function levelRefOf(raw: unknown): LevelRef | null {
  if (!isRecord(raw)) return null;
  const { floorId, floorNumber } = raw;
  if (typeof floorId !== 'string' || floorId === '') return null;
  if (typeof floorNumber !== 'number' || !Number.isInteger(floorNumber)) return null;
  return { floorId, floor: floorNumber };
}

/** Οι εγγραφές επιπέδων, αν είναι ≥ 2 έγκυρες, με μοναδικό `floorId` **και** μοναδικό όροφο. */
function levelRefsOf(levels: unknown): readonly LevelRef[] | null {
  if (!Array.isArray(levels) || levels.length < 2) return null;
  const refs: LevelRef[] = [];
  for (const raw of levels) {
    const ref = levelRefOf(raw);
    if (ref === null) return null;
    refs.push(ref);
  }
  const distinct = (values: readonly (string | number)[]) => new Set(values).size === values.length;
  if (!distinct(refs.map((ref) => ref.floorId)) || !distinct(refs.map((ref) => ref.floor))) return null;
  return refs;
}

export interface LevelAreasSource {
  /** `Property.levels` — ωμό. */
  readonly levels: unknown;
  /** `Property.levelData` — ωμό, κλειδί `floorId`. */
  readonly levelData: unknown;
  /** Ο αριθμός επιπέδων που **δήλωσε** άνθρωπος (`layout.levels`), αν υπάρχει. */
  readonly declaredCount: number | null;
  /** Το συνολικό μικτό της μονάδας (`areas.gross`), αν υπάρχει. */
  readonly totalGross: number | null;
}

/**
 * **Η βάση ανά επίπεδο** — ταξινομημένη κατά όροφο, ή `null` όταν οτιδήποτε λείπει ή διαφωνεί: λιγότερα από δύο
 * επίπεδα · άκυρος/διπλός όροφος · εμβαδόν που λείπει · δηλωμένο πλήθος ≠ εγγραφές · άθροισμα ≠ συνολικό μικτό.
 */
export function readLevelAreas(source: LevelAreasSource): readonly LevelArea[] | null {
  const refs = levelRefsOf(source.levels);
  if (refs === null) return null;
  if (source.declaredCount !== null && source.declaredCount !== refs.length) return null;
  const areas: LevelArea[] = [];
  for (const ref of refs) {
    const grossSqm = levelGrossArea(source.levelData, ref.floorId);
    if (grossSqm === null) return null;
    areas.push({ floor: ref.floor, grossSqm });
  }
  const sum = areas.reduce((total, level) => total + level.grossSqm, 0);
  if (source.totalGross !== null && Math.abs(sum - source.totalGross) > SUM_TOLERANCE_SQM) return null;
  return areas.sort((a, b) => a.floor - b.floor);
}

/**
 * **Ο αυστηρός αναγνώστης της αποθηκευμένης μορφής** (δημόσια αγγελία): ≥ 2 επίπεδα, ακέραιοι μοναδικοί όροφοι,
 * θετικά εμβαδά — αλλιώς `null`. Ποτέ «διόρθωση».
 */
export function readStoredLevelAreas(raw: unknown): readonly LevelArea[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const areas: LevelArea[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) return null;
    const grossSqm = positiveArea(entry.grossSqm);
    const { floor } = entry;
    if (grossSqm === null || typeof floor !== 'number' || !Number.isInteger(floor)) return null;
    areas.push({ floor, grossSqm });
  }
  if (new Set(areas.map((level) => level.floor)).size !== areas.length) return null;
  return areas.sort((a, b) => a.floor - b.floor);
}
