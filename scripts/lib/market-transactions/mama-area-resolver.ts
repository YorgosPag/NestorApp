/**
 * @fileoverview **Ο ΚΡΙΤΗΣ ΠΕΡΙΟΧΗΣ** — (νομαρχία, όνομα προ-2011 δήμου) → ταυτότητα Καλλικράτη (ADR-889 §4).
 * @related ADR-889 · `mama-area-tables.ts` (οι δύο χειρόγραφοι πίνακες) · `@/lib/places/admin-name-index` (η μηχανή)
 *
 * ```
 * ετικέτα ίδια με τη νομαρχία, χωρίς ακριβές ταίριασμα Δ.Ε.  →  withheld   (ανωνυμοποίηση της πηγής)
 * ψευδώνυμο του πίνακα                                        →  alias
 * ακριβές όνομα Δ.Ε. (ή δήμου ΧΩΡΙΣ Δ.Ε.)                     →  exact
 * ακριβές όνομα κοινότητας  →  η Δ.Ε. (ή ο δήμος) που την περιέχει  →  community
 * απόσταση 1 / κλίση, μέσα στην Π.Ε., μοναδικό                 →  near / inflected
 * ό,τι άλλο                                                    →  unmatched   (ποτέ μαντεψιά)
 * ```
 *
 * 🔴 **Η ΑΝΩΝΥΜΟΠΟΙΗΣΗ ΜΟΙΑΖΕΙ ΜΕ ΠΟΛΗ.** Όταν σε έναν δήμο έγινε μία μόνο μεταβίβαση, η πηγή γράφει τη
 * **νομαρχία** στη θέση του δήμου («ΚΟΡΙΝΘΙΑΣ | ΚΟΡΙΝΘΙΑΣ»). Όμως το «ΘΕΣΣΑΛΟΝΙΚΗΣ | ΘΕΣΣΑΛΟΝΙΚΗΣ» είναι η
 * **πραγματική** πόλη (8.325 γραμμές). Μετρημένο 2026-09-26: με ανεκτική αντιστοίχιση, το «ΚΑΡΔΙΤΣΗΣ» έδενε
 * στη Δ.Ε. Καρδίτσας, ενώ η πόλη εμφανίζεται **χωριστά** ως «ΚΑΡΔΙΤΣΑΣ» (612 γραμμές). Άρα ετικέτα ίση με τη
 * νομαρχία δένεται **μόνο** με ακριβές όνομα Δ.Ε./δήμου, ποτέ με κοινότητα ή ανοχή.
 *
 * 🔑 **Η ΜΟΝΑΔΑ ΕΙΝΑΙ Η Δ.Ε. — ή ο ΔΗΜΟΣ όταν δεν έχει Δ.Ε.** Δήμοι που ο Καλλικράτης δεν συνένωσε (Αθηναίων,
 * Καλαμαριάς, μονόνησοι δήμοι) δεν έχουν βαθμίδα 6 στην ΕΛΣΤΑΤ. Εκεί ο προ-2011 δήμος **είναι** ο δήμος, και
 * η ταυτότητα είναι του δήμου. Το `adminArea` της αγγελίας (ADR-890 Φ0) κρατά και τα δύο, οπότε η σύνδεση
 * γίνεται με `municipalUnitId ?? municipalityId`.
 */

import {
  buildAdminNameIndex,
  exactNameMatches,
  inflectedNameMatchesWithin,
  nearNameMatchesWithin,
  type AdminNameIndex,
  type AdminPlace,
} from '../../../src/lib/places/admin-name-index';
import { ADMIN_LEVEL } from '../../../src/lib/geo/admin-area-index-file';
import { foldPlaceIdentity } from '../../../src/utils/address/place-name';
import { MAMA_AREA_ALIASES, MAMA_PREFECTURE_REGIONAL_UNITS } from './mama-area-tables';
import { MamaFormatError } from './mama-source';

/** Ό,τι χρειάζεται ο κριτής από την ιεραρχία — δομικά συμβατό με το `HierarchyRow` των γεννητόρων. */
export interface HierarchyEntity {
  readonly id: string;
  readonly n: string;
  readonly sn?: string;
  /** Εναλλακτικά σύντομα ονόματα (ADR-893 §7) — το ΜΑΜΑ μπορεί να γράφει την παλιά γραφή της ΕΛΣΤΑΤ. */
  readonly an?: readonly string[];
  readonly l: number;
  readonly p: string | null;
}

export type ResolvedVia = 'exact' | 'community' | 'near' | 'inflected' | 'alias';

export type AreaResolution =
  | { readonly kind: 'resolved'; readonly areaId: string; readonly via: ResolvedVia }
  | { readonly kind: 'withheld' }
  | { readonly kind: 'unmatched'; readonly candidates: readonly string[] };

export interface MamaArea {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  /** Ο γονέας στην ιεραρχία (Δ.Ε. → Δήμος) — για την άθροιση ανά Δήμο (ADR-889 Φ2). */
  readonly parentId: string | null;
}

export interface MamaAreaResolver {
  resolve(prefecture: string, label: string): AreaResolution;
  area(areaId: string): MamaArea;
}

/** Η νομαρχία χωρίς το «(ΝΟΜΑΡΧΙΑ)», διπλωμένη — για τη σύγκριση «ετικέτα ίση με νομαρχία». */
function prefectureKey(label: string): string {
  return foldPlaceIdentity(label.replace(/\(ΝΟΜΑΡΧΙΑ\)/g, ''));
}

/** «ΙΛΙΟΥ (ΝΕΩΝ ΛΙΟΣΙΩΝ)» → [ολόκληρο, «ΙΛΙΟΥ», «ΝΕΩΝ ΛΙΟΣΙΩΝ»]· η παρένθεση είναι έδρα ή παλιό όνομα. */
function labelVariants(label: string): readonly string[] {
  const match = /^(.*?)\s*\((.*)\)\s*$/.exec(label);
  if (match === null) return [label];
  return [label, match[1], match[2].replace(/^Π\.\s*/, '')];
}

interface Hierarchy {
  readonly byId: ReadonlyMap<string, HierarchyEntity>;
  readonly index: AdminNameIndex;
}

/**
 * Το ευρετήριο ονομάτων: Δ.Ε. **και** δήμοι χωρίς Δ.Ε. στη «βαθμίδα 6» (είναι η ίδια ερώτηση), κοινότητες
 * στη 7. Το όνομα είναι το σύντομο (`sn`), που η ΕΛΣΤΑΤ γράφει ήδη σε **γενική**, όπως και το ΜΑΜΑ.
 */
function indexHierarchy(rows: readonly HierarchyEntity[]): Hierarchy {
  const withUnits = new Set(rows.filter((row) => row.l === ADMIN_LEVEL.municipalUnit).map((row) => row.p));
  const places: AdminPlace[] = rows
    .filter((row) => row.l === ADMIN_LEVEL.municipalUnit || row.l === ADMIN_LEVEL.community || (row.l === ADMIN_LEVEL.municipality && !withUnits.has(row.id)))
    .map((row) => ({
      id: row.id,
      name: row.sn ?? row.n,
      level: row.l === ADMIN_LEVEL.community ? ADMIN_LEVEL.community : ADMIN_LEVEL.municipalUnit,
      parentId: row.p,
      ...(row.an ? { alternateNames: row.an } : {}),
    }));
  return { byId: new Map(rows.map((row) => [row.id, row])), index: buildAdminNameIndex(places) };
}

function ancestorAt(hierarchy: Hierarchy, id: string, level: number): HierarchyEntity | null {
  let row = hierarchy.byId.get(id);
  while (row !== undefined && row.l > level) row = row.p === null ? undefined : hierarchy.byId.get(row.p);
  return row?.l === level ? row : null;
}

/** Η μονάδα μιας οντότητας του ευρετηρίου: η ίδια, ή για κοινότητα η Δ.Ε. (αλλιώς ο δήμος) που την περιέχει. */
function areaOf(hierarchy: Hierarchy, place: AdminPlace): string {
  if (place.level !== ADMIN_LEVEL.community) return place.id;
  const unit = ancestorAt(hierarchy, place.id, ADMIN_LEVEL.municipalUnit) ?? ancestorAt(hierarchy, place.id, ADMIN_LEVEL.municipality);
  if (unit === null) throw new MamaFormatError(`ιεραρχία: η κοινότητα ${place.id} δεν έχει Δ.Ε. ή δήμο`);
  return unit.id;
}

type Attempt = AreaResolution | null;

function fromIds(ids: readonly string[], via: ResolvedVia): Attempt {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return null;
  return unique.length === 1 ? { kind: 'resolved', areaId: unique[0], via } : { kind: 'unmatched', candidates: unique };
}

function exactAttempt(hierarchy: Hierarchy, label: string, within: (p: AdminPlace) => boolean, communities: boolean): Attempt {
  const units = exactNameMatches(hierarchy.index, ADMIN_LEVEL.municipalUnit, label).filter(within);
  const unit = fromIds(units.map((p) => p.id), 'exact');
  if (unit !== null || !communities) return unit;
  const found = exactNameMatches(hierarchy.index, ADMIN_LEVEL.community, label).filter(within);
  return fromIds(found.map((p) => areaOf(hierarchy, p)), 'community');
}

function tolerantAttempt(hierarchy: Hierarchy, label: string, within: (p: AdminPlace) => boolean): Attempt {
  const near = nearNameMatchesWithin(hierarchy.index, ADMIN_LEVEL.municipalUnit, label, within).flat();
  const nearResult = fromIds(near.map((p) => p.id), 'near');
  if (nearResult !== null) return nearResult;
  const inflected = inflectedNameMatchesWithin(hierarchy.index, ADMIN_LEVEL.municipalUnit, label, within).flat();
  return fromIds(inflected.map((p) => p.id), 'inflected');
}

function scopeOf(hierarchy: Hierarchy, prefecture: string): (place: AdminPlace) => boolean {
  const codes = MAMA_PREFECTURE_REGIONAL_UNITS[prefecture];
  if (codes === undefined) throw new MamaFormatError(`άγνωστη νομαρχία ${JSON.stringify(prefecture)} — λείπει από τον πίνακα`);
  const scope = new Set(codes.map((code) => `regional_unit:${code}`));
  return (place) => {
    const unit = ancestorAt(hierarchy, place.id, ADMIN_LEVEL.regionalUnit);
    return unit !== null && scope.has(unit.id);
  };
}

/** Η σκάλα του σχολίου της κεφαλίδας, για **ένα** ζεύγος. */
function resolvePair(hierarchy: Hierarchy, prefecture: string, label: string): AreaResolution {
  const within = scopeOf(hierarchy, prefecture);
  const alias = MAMA_AREA_ALIASES.find((a) => a.prefecture === prefecture && a.label === label);
  if (alias !== undefined) return { kind: 'resolved', areaId: alias.areaId, via: 'alias' };

  const isPrefectureLabel = prefectureKey(label) === prefectureKey(prefecture);
  for (const variant of labelVariants(label)) {
    const attempt = exactAttempt(hierarchy, variant, within, !isPrefectureLabel)
      ?? (isPrefectureLabel ? null : tolerantAttempt(hierarchy, variant, within));
    if (attempt !== null) return attempt;
  }
  return isPrefectureLabel ? { kind: 'withheld' } : { kind: 'unmatched', candidates: [] };
}

function assertAliases(hierarchy: Hierarchy): void {
  for (const alias of MAMA_AREA_ALIASES) {
    const row = hierarchy.byId.get(alias.areaId);
    if (row === undefined || (row.l !== ADMIN_LEVEL.municipalUnit && row.l !== ADMIN_LEVEL.municipality)) {
      throw new MamaFormatError(`ψευδώνυμο ${alias.label}: η ${alias.areaId} δεν είναι Δ.Ε. ή δήμος της ιεραρχίας`);
    }
  }
}

/**
 * Φτιάχνει τον κριτή πάνω στην ιεραρχία της ΕΛΣΤΑΤ. Η απάντηση **απομνημονεύεται ανά ζεύγος**: ~1.000 ζεύγη
 * για ~200.000 γραμμές, οπότε η σκάλα τρέχει μία φορά ανά ζεύγος.
 */
export function createMamaAreaResolver(rows: readonly HierarchyEntity[]): MamaAreaResolver {
  const hierarchy = indexHierarchy(rows);
  assertAliases(hierarchy);
  const memo = new Map<string, AreaResolution>();

  return {
    resolve(prefecture, label) {
      const key = `${prefecture}\u0000${label}`;
      let result = memo.get(key);
      if (result === undefined) {
        result = resolvePair(hierarchy, prefecture, label);
        memo.set(key, result);
      }
      return result;
    },
    area(areaId) {
      const row = hierarchy.byId.get(areaId);
      if (row === undefined) throw new MamaFormatError(`άγνωστη ταυτότητα περιοχής ${areaId}`);
      return { id: row.id, name: row.n, level: row.l, parentId: row.p };
    },
  };
}
