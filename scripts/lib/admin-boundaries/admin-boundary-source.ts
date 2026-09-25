/**
 * @fileoverview **Η ΠΗΓΗ ΤΩΝ ΠΟΛΥΓΩΝΩΝ ΤΟΥ ΚΑΛΛΙΚΡΑΤΗ** — μία φόρτωση, μία αντιστοίχιση, δύο γεννήτορες.
 * @related ADR-846 Φ2.5 · ADR-883 · `scripts/build-admin-footprints.ts` · `scripts/build-admin-boundaries.ts`
 * @module scripts/lib/admin-boundaries/admin-boundary-source
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΞΗΧΘΗ (ADR-883, N.18)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ο γεννήτορας των **αποτυπωμάτων** (δύο κύκλοι) ήταν ο μόνος που διάβαζε τα πολύγωνα.
 * Ο γεννήτορας των **ορίων** (το σχήμα στον χάρτη) χρειάζεται **ακριβώς** την ίδια
 * διαδρομή: ίδιο WFS, ίδια cache, ίδια αντιστοίχιση κωδικού Καλλικράτη → `id`, ίδιος
 * αποκλεισμός διφορούμενων κωδικών, ίδια σύνθεση των δήμων του Κλεισθένη από τις
 * δημοτικές τους ενότητες. Ένα δεύτερο αντίγραφο θα ήταν δύο απαντήσεις στο *«ποιο
 * πολύγωνο ανήκει σε ποια οντότητα;»* — και ο χάρτης θα μπορούσε να δείχνει άλλο σχήμα
 * από εκείνο που κρίνει ο κριτής κάλυψης.
 *
 * ⚖️ **Η άδεια ζει ΕΔΩ, μία φορά**: geodata.gov.gr, CC-BY 3.0 — δες την κεφαλίδα του
 * `build-admin-footprints.ts` και το `types/geo/admin-footprint.ts` για τον πλήρη πίνακα.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * ⚠️ Η cache ζει στο `node_modules/.cache` επίτηδες: είναι ο ένας φάκελος που **καμία**
 * διαδρομή του git δεν βλέπει, άρα τα ~120 MB πολυγώνων δεν μπορούν να μπουν κατά λάθος
 * σε commit — ούτε με `git add -A`.
 */
const CACHE_DIR = join(REPO_ROOT, 'node_modules', '.cache', 'admin-boundaries');
const HIERARCHY_PATH = join(REPO_ROOT, 'public', 'data', 'administrative-hierarchy.json');
const WFS_BASE = 'https://wfdservices.ypeka.gr/geoserver/WFD_geodata_50K/wfs';

/** Η αναφορά πηγής που **απαιτεί** η CC-BY. Ταξιδεύει μέσα σε κάθε παραγόμενο αρχείο. */
export const ATTRIBUTION = {
  source: 'geodata.gov.gr — «Όρια Δήμων (Καλλικράτης)» (ΟΚΧΕ/ΕΚΧΑ)',
  sourceId: '63786e9f-7be9-4d1e-99c9-48ff45d0962f',
  license: 'CC-BY 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  via: 'data.gov.gr — ΥΠΕΝ «gis-ypen-wfd-wms» (WFS), δηλώνει «Πηγή: geodata.gov.gr»',
} as const;

/**
 * Ποιο επίπεδο της ιεραρχίας δίνει ποιο layer του WFS.
 *
 * ⚠️ **Το επίπεδο 8 (οικισμοί) λείπει σκόπιμα**: είναι **σημεία**, όχι πολύγωνα. Το
 * επίπεδο 1 (μεγάλες γεωγραφικές ενότητες) δεν υπάρχει καθόλου στην πηγή.
 */
export const LAYERS: readonly { readonly layer: string; readonly level: number }[] = [
  { layer: 'apokentromenes_dioikiseis', level: 2 },
  { layer: 'perifereies', level: 3 },
  { layer: 'perifereiakes_enotites', level: 4 },
  { layer: 'kallikratikoi_dimoi', level: 5 },
  { layer: 'dimotikes_enotites', level: 6 },
  { layer: 'dimotikes_topikes_koinotites', level: 7 },
];

/** Το επίπεδο των δημοτικών ενοτήτων — η πρώτη ύλη της σύνθεσης των νέων δήμων. */
export const MUNICIPAL_UNIT_LEVEL = 6;

export interface HierarchyRow {
  readonly id: string;
  readonly n: string;
  readonly c: string;
  readonly l: number;
  /** Ο γονέας — τον χρειάζεται η **σύνθεση** δήμου από δημοτικές ενότητες (ADR-846 Φ4). */
  readonly p: string | null;
}

export function readHierarchyRows(): readonly HierarchyRow[] {
  const hierarchy = JSON.parse(readFileSync(HIERARCHY_PATH, 'utf8')) as { data: HierarchyRow[] };
  return hierarchy.data;
}

function wfsUrl(layer: string): string {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: `WFD_geodata_50K:${layer}`,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
  });
  return `${WFS_BASE}?${params.toString()}`;
}

/** Κατεβάζει το layer **μία φορά** και το κρατά στην cache εκτός παρακολούθησης. */
export async function loadLayer(layer: string): Promise<GeoJSON.FeatureCollection> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cached = join(CACHE_DIR, `${layer}.geojson`);

  if (!existsSync(cached)) {
    process.stdout.write(`  ↓ ${layer} … `);
    const response = await fetch(wfsUrl(layer));
    if (!response.ok) throw new Error(`WFS ${layer}: HTTP ${response.status}`);
    const body = await response.text();
    writeFileSync(cached, body);
    process.stdout.write(`${(body.length / 1e6).toFixed(1)} MB\n`);
  }

  return JSON.parse(readFileSync(cached, 'utf8')) as GeoJSON.FeatureCollection;
}

/**
 * `<επίπεδο>:<κωδικός Καλλικράτη>` → το `id` της ιεραρχίας.
 *
 * 🔴 **Οι διφορούμενοι κωδικοί ΑΦΑΙΡΟΥΝΤΑΙ, δεν επιλύονται.** Να δώσουμε γεωμετρία σε
 * κωδικό που ανήκει σε **δύο** οντότητες σημαίνει να αποδώσουμε το σχήμα **της μίας στην
 * άλλη** — ψέμα, και μάλιστα αόρατο. Η απουσία δίνει «δεν ξέρω»· η εικασία λάθος.
 *
 * ⚠️ *Μετρημένο 2026-09-25*: η ιεραρχία **δεν έχει πια** διφορούμενους κωδικούς — οι τρεις
 * του 2026-09-08 (`municipality:0502` · `:1502` · `:3202`) διορθώθηκαν όταν οι δήμοι του
 * Κλεισθένη πήραν κωδικό ΥΠΕΣ (ADR-846 Φ4). Ο φρουρός μένει: είναι φθηνός, και η επόμενη
 * μεταρρύθμιση θα ξαναγεννήσει το ίδιο σχήμα.
 */
export function buildIdIndex(rows: readonly HierarchyRow[]): {
  readonly index: ReadonlyMap<string, string>;
  readonly ambiguous: ReadonlySet<string>;
} {
  const index = new Map<string, string>();
  const ambiguous = new Set<string>();

  for (const row of rows) {
    const key = `${row.l}:${row.c}`;
    if (index.has(key)) {
      ambiguous.add(key);
      index.delete(key);
      continue;
    }
    if (!ambiguous.has(key)) index.set(key, row.id);
  }

  return { index, ambiguous };
}

/** Γιατί ένα χαρακτηριστικό του WFS **δεν** έγινε οντότητα — για την αναφορά του γεννήτορα. */
export type FeatureSkip = 'ambiguous' | 'unmatched' | 'not-a-shape';

export type FeatureMatch =
  | { readonly kind: 'matched'; readonly id: string; readonly geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon }
  | { readonly kind: 'skipped'; readonly reason: FeatureSkip };

/**
 * **Σε ποια οντότητα ανήκει αυτό το χαρακτηριστικό;** — η ΜΙΑ απάντηση για τους δύο γεννήτορες.
 */
export function matchFeature(
  feature: GeoJSON.Feature,
  level: number,
  index: ReadonlyMap<string, string>,
  ambiguous: ReadonlySet<string>,
): FeatureMatch {
  const key = `${level}:${String(feature.properties?.kalcode ?? '')}`;
  if (ambiguous.has(key)) return { kind: 'skipped', reason: 'ambiguous' };

  const id = index.get(key);
  if (id === undefined) return { kind: 'skipped', reason: 'unmatched' };

  const { geometry } = feature;
  if (geometry === null || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
    return { kind: 'skipped', reason: 'not-a-shape' };
  }
  return { kind: 'matched', id, geometry };
}

/**
 * 🔴 **ΟΙ ΔΗΜΟΙ ΠΟΥ Η ΠΗΓΗ ΔΕΝ ΞΕΡΕΙ** — ADR-846 Φ4.
 *
 * Το layer `kallikratikoi_dimoi` είναι ο Καλλικράτης του 2011 και **τελείωσε εκεί**. Οι
 * δήμοι που γέννησε ο Κλεισθένης *(ν.4600/2019)* δεν υπάρχουν σε αυτό. 🔑 **Και όμως το
 * έδαφός τους ΤΟ ΕΧΟΥΜΕ**: ο νόμος δεν χάραξε νέα σύνορα, **μοίρασε δημοτικές ενότητες**,
 * και το layer `dimotikes_enotites` τις έχει όλες — ίδια πηγή, ίδια άδεια.
 *
 * Επιστρέφει, για κάθε δήμο που **λείπει** από το `known`, την **GeoJSON γεωμετρία της
 * ένωσης** των δημοτικών του ενοτήτων — ως `MultiPolygon` με τα πολύγωνα των παιδιών
 * **αυτούσια** (όχι ενωμένα σε ένα περίγραμμα). Και οι δύο καταναλωτές το αντέχουν: ο
 * κριτής μετρά περιττό πλήθος δακτυλίων, ο χάρτης σχεδιάζει κάθε πολύγωνο· τα εσωτερικά
 * σύνορα των ενοτήτων μένουν ορατά μόνο στο περίγραμμα, και το σημειώνει η αναφορά.
 *
 * @returns `id` δήμου → `{ geometry, children }`
 */
export function composeMunicipalitiesFromUnits(
  rows: readonly HierarchyRow[],
  units: GeoJSON.FeatureCollection,
  known: ReadonlySet<string>,
): ReadonlyMap<string, { readonly geometry: GeoJSON.MultiPolygon; readonly children: number }> {
  const polygonsByCode = new Map<string, GeoJSON.Position[][][]>();
  for (const feature of units.features) {
    const { geometry } = feature;
    const code = String(feature.properties?.kalcode ?? '');
    if (geometry?.type === 'Polygon') polygonsByCode.set(code, [geometry.coordinates]);
    else if (geometry?.type === 'MultiPolygon') polygonsByCode.set(code, geometry.coordinates);
  }

  const childCodes = new Map<string, string[]>();
  for (const row of rows) {
    if (row.l !== MUNICIPAL_UNIT_LEVEL || row.p === null) continue;
    const siblings = childCodes.get(row.p);
    if (siblings) siblings.push(row.c);
    else childCodes.set(row.p, [row.c]);
  }

  const composed = new Map<string, { geometry: GeoJSON.MultiPolygon; children: number }>();
  for (const row of rows) {
    if (row.l !== 5 || known.has(row.id)) continue;
    const codes = childCodes.get(row.id) ?? [];
    const coordinates = codes.flatMap((code) => polygonsByCode.get(code) ?? []);
    if (coordinates.length === 0) continue;
    composed.set(row.id, { geometry: { type: 'MultiPolygon', coordinates }, children: codes.length });
  }
  return composed;
}
