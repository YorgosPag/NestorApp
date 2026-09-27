/**
 * @fileoverview **ΤΟ WIKIDATA ΩΣ ΔΕΥΤΕΡΗ ΠΗΓΗ ΤΟΝΩΝ** — ADR-893.
 * @related `law-3852.ts` (η αυθεντία) · `resolve-display-names.ts` (καταναλωτής)
 *
 * Δύο ερωτήματα, ένα αίτημα το καθένα:
 * - **κατά κωδικό ΕΛΣΤΑΤ** (`P1116`) — περιφερειακές ενότητες (2 ψηφία), δήμοι (4), δημοτικές
 *   ενότητες (6)· ετικέτα + εναλλακτικές + τίτλος της ελληνικής Βικιπαίδειας.
 * - **κατά τύπο** — οι βαθμίδες **χωρίς** `P1116`: περιφέρειες (`Q207299`), αποκεντρωμένες
 *   διοικήσεις (`Q3559207`), στατιστικές περιφέρειες NUTS 1 (`Q406957`, κωδικός `EL` + 1 ψηφίο).
 *
 * 🔴 **ΠΑΓΙΔΕΣ ΜΕΤΡΗΜΕΝΕΣ 2026-09-27** — και γιατί ο κωδικός **δεν** αρκεί ποτέ μόνος του:
 * - οι διψήφιοι κωδικοί των **αποκεντρωμένων διοικήσεων** του μητρώου μας συμπίπτουν με των
 *   **περιφερειακών ενοτήτων** του Wikidata (το `11` είναι εκεί η **Πιερία**)· γι' αυτό η βαθμίδα 2
 *   ρωτιέται κατά τύπο, ποτέ κατά κωδικό·
 * - σε Κοζάνη/Καστοριά οι κωδικοί των δημοτικών ενοτήτων είναι **μετατοπισμένοι** (`160201` =
 *   «Άργους Ορεστικού» εκεί, «ΝΕΣΤΟΡΙΟΥ» στην ΕΛΣΤΑΤ)·
 * - πολλές ετικέτες είναι **κεφαλαίες** (`ΒΕΡΟΙΑΣ`) ή έχουν **ουρά** νομού (`… Ροδόπης`).
 * Άρα κάθε ετικέτα γίνεται δεκτή **μόνο** αν έχει τις **ίδιες λέξεις** με το επίσημο όνομα.
 *
 * ⚖️ **Άδεια**: CC0 (τα δεδομένα του Wikidata)· οι τίτλοι Βικιπαίδειας είναι γεγονότα, όχι έργο.
 */

export const WIKIDATA_SOURCE = {
  id: 'wikidata',
  title: 'Wikidata — ετικέτες ελληνικών διοικητικών μονάδων',
  license: 'CC0 1.0',
} as const;

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

/** Η βαθμίδα του μητρώου μας για κάθε μήκος κωδικού `P1116` — **μόνο** αυτές. */
export const ELSTAT_CODE_LEVEL: Readonly<Record<number, number>> = { 2: 4, 4: 5, 6: 6 };

const BY_CODE_QUERY = `SELECT ?code ?label WHERE {
  ?item wdt:P1116 ?code . FILTER(STRLEN(?code) IN (2, 4, 6)) FILTER NOT EXISTS { ?item wdt:P576 [] }
  { ?item rdfs:label ?label } UNION { ?item skos:altLabel ?label }
  UNION { ?article schema:about ?item ; schema:isPartOf <https://el.wikipedia.org/> ; schema:name ?label }
  FILTER(LANG(?label) = "el")
}`;

/** Βαθμίδα του μητρώου → τύπος Wikidata. Η βαθμίδα 1 (NUTS 1) φιλτράρεται επιπλέον κατά κωδικό. */
const TYPED_LEVELS: readonly { readonly level: number; readonly type: string }[] = [
  { level: 1, type: 'Q406957' },
  { level: 2, type: 'Q3559207' },
  { level: 3, type: 'Q207299' },
];

const BY_TYPE_QUERY = `SELECT ?type ?nuts ?label WHERE {
  VALUES ?type { ${TYPED_LEVELS.map(({ type }) => `wd:${type}`).join(' ')} }
  ?item wdt:P31 ?type . FILTER NOT EXISTS { ?item wdt:P576 [] }
  OPTIONAL { ?item wdt:P605 ?nuts }
  { ?item rdfs:label ?label } UNION { ?item skos:altLabel ?label }
  FILTER(LANG(?label) = "el")
}`;

export function sparqlUrl(query: string): string {
  return `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
}

export const WIKIDATA_QUERIES = {
  byCode: sparqlUrl(BY_CODE_QUERY),
  byType: sparqlUrl(BY_TYPE_QUERY),
} as const;

interface SparqlJson {
  readonly results: { readonly bindings: readonly Record<string, { readonly value: string } | undefined>[] };
}

/** Υποψήφιες ετικέτες ανά `(βαθμίδα, κωδικός)` ή ανά βαθμίδα (χωρίς κωδικό). */
export interface WikidataNames {
  readonly byLevelCode: ReadonlyMap<string, readonly string[]>;
  readonly byLevel: ReadonlyMap<number, readonly string[]>;
}

export function levelCodeKey(level: number, code: string): string {
  return `${level}:${code}`;
}

function push<K>(map: Map<K, string[]>, key: K, value: string): void {
  const list = map.get(key) ?? [];
  if (!list.includes(value)) list.push(value);
  map.set(key, list);
}

/** Η Ελλάδα στο NUTS 1 είναι `EL3`…`EL6` — τρεις χαρακτήρες· το `EL30` είναι ήδη NUTS 2. */
const GREEK_NUTS1 = /^EL\d$/;

export function parseWikidataNames(byCode: SparqlJson, byType: SparqlJson): WikidataNames {
  const byLevelCode = new Map<string, string[]>();
  for (const row of byCode.results.bindings) {
    const code = row.code?.value;
    const label = row.label?.value;
    const level = code === undefined ? undefined : ELSTAT_CODE_LEVEL[code.length];
    if (code && label && level) push(byLevelCode, levelCodeKey(level, code), label);
  }
  const byLevel = new Map<number, string[]>();
  for (const row of byType.results.bindings) {
    const level = TYPED_LEVELS.find(({ type }) => row.type?.value.endsWith(`/${type}`))?.level;
    const label = row.label?.value;
    if (level === undefined || label === undefined) continue;
    if (level === 1 && !GREEK_NUTS1.test(row.nuts?.value ?? '')) continue;
    push(byLevel, level, label);
  }
  return { byLevelCode, byLevel };
}
