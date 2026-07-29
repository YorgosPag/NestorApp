/**
 * SSoT — η **διάσχιση** του πίνακα `LAYER` του DXF (TABLES → TABLE/LAYER → εγγραφές → ENDTAB).
 *
 * Δύο parsers διαβάζουν τον ίδιο πίνακα και μέχρι τώρα καθένας κουβαλούσε **δικό του αντίγραφο**
 * της ίδιας μηχανής καταστάσεων (`inTables` / `inLayerTable` / `inEntry` / `prevCode`):
 *   • `dxf-table-parsers.parseLayerColors` — legacy 2-field reader (τροφοδοτεί τον scene builder)
 *   • `dxf-layer-table-parser.parseLayerTable` — ο πλήρης `SceneLayer[]`
 *
 * ⚠️ **Και είχαν ήδη αποκλίνει**: ο legacy έκανε `break` στο `ENDSEC` **χωρίς flush** ⇒ σε αρχείο
 * χωρίς `ENDTAB` **έχανε την τελευταία εγγραφή layer**, ενώ ο πλήρης την κρατούσε. Ακριβώς ο
 * λόγος που η διάσχιση ζει πλέον εδώ: μία συμπεριφορά, όχι δύο. (Το ίδιο σχήμα με τα bits του
 * group 70 — βλ. `dxf-layer-flags`.)
 *
 * Ο walker **δεν ερμηνεύει τίποτα**: παραδίδει τα ωμά ζεύγη κάθε εγγραφής και κάθε καταναλωτής
 * χτίζει το δικό του μοντέλο. Έτσι ο legacy μένει 2-field και ο πλήρης κρατά XDATA/linetype
 * χωρίς να μολύνουν ο ένας τον άλλον.
 *
 * @see AutoCAD DXF Reference — TABLES section, LAYER table
 */

/** Ένα ωμό ζεύγος (κωδικός ομάδας, τιμή) μιας εγγραφής LAYER. */
export interface DxfLayerPair {
  readonly code: string;
  readonly value: string;
}

/**
 * Παράγει, για **κάθε** εγγραφή `LAYER` του πίνακα, τα ζεύγη που της ανήκουν — με τη σειρά του
 * αρχείου, χωρίς το ίδιο το `0/LAYER` marker.
 *
 * Οι μη-LAYER πίνακες (DIMSTYLE, LTYPE, …) αγνοούνται· η τελευταία εγγραφή παραδίδεται ακόμη κι
 * αν λείπει το `ENDTAB`/`ENDSEC` (κολοβό αρχείο ⇒ ό,τι διαβάστηκε δεν πετιέται).
 */
export function* dxfLayerTableEntries(lines: string[]): Generator<ReadonlyArray<DxfLayerPair>> {
  let inTables = false;
  let inLayerTable = false;
  let inEntry = false;
  let prevCode = '';
  let prevValue = '';
  let buf: DxfLayerPair[] = [];

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1]?.trim() ?? '';

    if (prevCode === '0' && prevValue === 'SECTION' && code === '2' && value === 'TABLES') {
      inTables = true;
    } else if (code === '0' && value === 'ENDSEC' && inTables) {
      if (inEntry) yield buf;
      return;
    } else if (inTables) {
      if (prevCode === '0' && prevValue === 'TABLE' && code === '2' && value === 'LAYER') {
        inLayerTable = true;
      } else if (code === '0' && value === 'ENDTAB' && inLayerTable) {
        if (inEntry) yield buf;
        buf = [];
        inLayerTable = false;
        inEntry = false;
      } else if (inLayerTable && code === '0' && value === 'LAYER') {
        if (inEntry) yield buf;
        buf = [];
        inEntry = true;
      } else if (inLayerTable && inEntry) {
        buf.push({ code, value });
      }
    }

    prevCode = code;
    prevValue = value;
  }

  if (inEntry) yield buf;
}
