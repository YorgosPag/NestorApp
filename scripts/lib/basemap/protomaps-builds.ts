/**
 * @fileoverview **ΑΠΟ ΠΟΙΟ BUILD ΤΟΥ PROTOMAPS ΚΟΒΕΤΑΙ Η ΕΛΛΑΔΑ** — επιλογή κατά σχήμα, όχι κατά ημερομηνία (ADR-891 Φ2).
 * @related ADR-891 §7 · `scripts/build-basemap.ts`
 * @module scripts/lib/basemap/protomaps-builds
 *
 * Το Protomaps δημοσιεύει **ημερήσιο** build του πλανήτη (~138 GB, ODbL) και κρατά την τελευταία εβδομάδα +
 * το τελευταίο build **ανά έκδοση σχήματος**. Κάθε build δηλώνει την έκδοση του σχήματος των πλακιδίων
 * (`version`, π.χ. `4.15.2`).
 *
 * 🔑 **ΤΟ ΣΧΗΜΑ ΚΑΡΦΩΝΕΤΑΙ, Η ΗΜΕΡΟΜΗΝΙΑ ΟΧΙ.** Το στυλ (`@protomaps/basemaps`, Φ3) διαβάζει ονόματα
 * στρώσεων και πεδίων του σχήματος. Ένα build νέας **κύριας** έκδοσης αλλάζει αυτά τα ονόματα ⇒ ο χάρτης
 * θα έβγαινε **άδειος χωρίς σφάλμα**. Γι' αυτό επιλέγεται το νεότερο build **της καρφωμένης κύριας έκδοσης**,
 * και η αλλαγή της είναι ρητή απόφαση (μαζί με το στυλ), ποτέ παρενέργεια του «τρέξαμε σήμερα».
 *
 * ⚖️ **Όροι**: τα δεδομένα είναι ODbL («© OpenStreetMap contributors» — ήδη στον χάρτη). Το build διαβάζεται
 * **μία** φορά ανά ανανέωση, με αιτήματα Range (~125 αιτήματα για ολόκληρη την εξαγωγή)· **ποτέ** από
 * επισκέπτη. Ο χάρτης σερβίρεται από τη δική μας υποδομή (Φ3).
 */

/** Η κύρια έκδοση σχήματος πλακιδίων που διαβάζει το στυλ μας. Αλλάζει **μόνο** μαζί με το στυλ (Φ3). */
export const PROTOMAPS_TILES_SCHEMA_MAJOR = 4;

const PROTOMAPS_BUILD_HOST = 'https://build.protomaps.com';
const PROTOMAPS_BUILDS_INDEX = 'https://build-metadata.protomaps.dev/builds.json';

/** Μία γραμμή του ευρετηρίου builds, όπως τη δίνει το Protomaps. */
export interface ProtomapsBuild {
  /** `YYYYMMDD.pmtiles` */
  readonly key: string;
  readonly size: number;
  readonly version: string;
  readonly uploaded: string;
  /** BLAKE3 ολόκληρου του πλανήτη — καταγράφεται ως ταυτότητα της πηγής. */
  readonly b3sum?: string;
}

function isBuild(value: unknown): value is ProtomapsBuild {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.key === 'string' && /^\d{8}\.pmtiles$/.test(row.key) &&
    typeof row.size === 'number' && typeof row.version === 'string' && typeof row.uploaded === 'string'
  );
}

/** Διαβάζει το ευρετήριο — ό,τι δεν μοιάζει με build **πετιέται**, δεν μαντεύεται. */
export function parseBuildsIndex(payload: unknown): ProtomapsBuild[] {
  if (!Array.isArray(payload)) throw new Error('ευρετήριο builds Protomaps: δεν είναι πίνακας');
  return payload.filter(isBuild);
}

function schemaMajor(version: string): number {
  return Number(version.split('.')[0]);
}

/**
 * Το build που χρησιμοποιείται: το ζητημένο (`YYYYMMDD`) αν δόθηκε, αλλιώς το **νεότερο** της καρφωμένης
 * κύριας έκδοσης. Ζητημένο build άλλης κύριας έκδοσης **απορρίπτεται** — το στυλ δεν θα το διάβαζε.
 */
export function selectBuild(builds: readonly ProtomapsBuild[], requested: string | null, major: number = PROTOMAPS_TILES_SCHEMA_MAJOR): ProtomapsBuild {
  const compatible = builds.filter((b) => schemaMajor(b.version) === major);
  if (requested !== null) {
    const build = builds.find((b) => b.key === `${requested}.pmtiles`);
    if (build === undefined) throw new Error(`build ${requested}: δεν υπάρχει (το Protomaps κρατά ~1 εβδομάδα + ένα ανά έκδοση)`);
    if (schemaMajor(build.version) !== major) {
      throw new Error(`build ${requested}: σχήμα ${build.version}, το στυλ διαβάζει ${major}.x`);
    }
    return build;
  }
  const latest = [...compatible].sort((a, b) => b.key.localeCompare(a.key))[0];
  if (latest === undefined) throw new Error(`κανένα build με σχήμα ${major}.x — άλλαξε το σχήμα ΜΑΖΙ με το στυλ`);
  return latest;
}

export function buildUrl(build: ProtomapsBuild): string {
  return `${PROTOMAPS_BUILD_HOST}/${build.key}`;
}

export async function fetchBuildsIndex(): Promise<ProtomapsBuild[]> {
  const response = await fetch(PROTOMAPS_BUILDS_INDEX);
  if (!response.ok) throw new Error(`ευρετήριο builds Protomaps: HTTP ${response.status}`);
  return parseBuildsIndex(await response.json());
}
