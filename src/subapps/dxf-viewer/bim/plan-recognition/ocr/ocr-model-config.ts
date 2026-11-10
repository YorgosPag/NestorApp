/**
 * =============================================================================
 * ΡΥΘΜΙΣΕΙΣ ΜΟΝΤΕΛΟΥ OCR ΑΠΟ ΤΟ ΕΠΙΣΗΜΟ `inference.yml` (ADR-929 Φ0.3)
 * =============================================================================
 *
 * Τα κατώφλια της ανίχνευσης (DB) και το λεξικό της ανάγνωσης (CTC) διαβάζονται από το `inference.yml` του **ίδιου**
 * μοντέλου (`public/models/ocr/<μοντέλο>@<rev>/`, μητρώο `.model-assets.json`) — **ποτέ** από σταθερές στον κώδικα: η
 * μέτρηση Φ0.1 έδειξε ότι κάθε γενιά μοντέλου έχει άλλα (v4 `0,3/0,6/1,5` · v6 small `0,2/0,45/1,4`).
 *
 * 🔑 **Υποσύνολο YAML, επίτηδες.** Το αρχείο είναι καρφωμένο κατά sha256· διαβάζονται ακριβώς δύο μορφές — `κλειδί:
 *   αριθμός` και η λίστα `character_dict:` — όπως στο μετρημένο `ocr_onnx.py`. Ό,τι δεν βγαίνει ⇒ **σφάλμα**, ποτέ
 *   σιωπηλή προεπιλογή (fail-closed).
 * ⚠️ **Μόνο αφαίρεση ΚΕΝΩΝ (U+0020) στην αρχή.** Το `trim()` τρώει και το U+3000, που **είναι** χαρακτήρας του λεξικού:
 *   μετρημένο, το λεξικό βγαίνει κατά 1 μικρότερο από την έξοδο του δικτύου και **κάθε** χαρακτήρας μετά διαβάζεται λάθος.
 *
 * @module bim/plan-recognition/ocr/ocr-model-config
 */

/** Τα κατώφλια της μετα-επεξεργασίας DB (PaddleOCR `DBPostProcess`). */
export interface DbThresholds {
  /** Κατώφλι πιθανότητας ανά pixel για τη δυαδική μάσκα. */
  readonly thresh: number;
  /** Ελάχιστη μέση πιθανότητα μιας συνιστώσας για να γίνει κουτί. */
  readonly boxThresh: number;
  /** Λόγος διεύρυνσης του κουτιού (unclip). */
  readonly unclipRatio: number;
}

export type OcrModelConfigErrorCode = 'missing-key' | 'not-a-number' | 'missing-dictionary' | 'class-count-mismatch';

/** Σφάλμα ρυθμίσεων μοντέλου: το αρχείο δεν είναι αυτό που περιμένει ο κώδικας ⇒ η ανάγνωση **δεν** ξεκινά. */
export class OcrModelConfigError extends Error {
  constructor(readonly code: OcrModelConfigErrorCode, detail: string) {
    super(`ocr-model-config/${code}: ${detail}`);
    this.name = 'OcrModelConfigError';
  }
}

function readScalar(yml: string, key: string): number {
  for (const line of yml.split('\n')) {
    const s = line.trim();
    if (!s.startsWith(`${key}:`)) continue;
    const value = Number(s.slice(key.length + 1).trim());
    if (!Number.isFinite(value)) throw new OcrModelConfigError('not-a-number', key);
    return value;
  }
  throw new OcrModelConfigError('missing-key', key);
}

/** Τα κατώφλια DB του ανιχνευτή (`thresh` · `box_thresh` · `unclip_ratio`). */
export function parseDbThresholds(yml: string): DbThresholds {
  return {
    thresh: readScalar(yml, 'thresh'),
    boxThresh: readScalar(yml, 'box_thresh'),
    unclipRatio: readScalar(yml, 'unclip_ratio'),
  };
}

/** Μία τιμή της λίστας: χωρίς εισαγωγικά αυτούσια· `'…'` με `''` = `'`· `"…"` με διαφυγές JSON. */
function unquote(value: string): string {
  if (value.length < 2 || value[0] !== value[value.length - 1]) return value;
  if (value[0] === "'") return value.slice(1, -1).replace(/''/g, "'");
  if (value[0] === '"') return JSON.parse(value) as string;
  return value;
}

/** Οι χαρακτήρες της λίστας `character_dict:` με τη σειρά τους (χωρίς το blank και το τελικό κενό). */
export function parseCharacterDict(yml: string): readonly string[] {
  const lines = yml.split('\n');
  const start = lines.findIndex((l) => l.trim().startsWith('character_dict:'));
  if (start < 0) throw new OcrModelConfigError('missing-dictionary', 'character_dict');
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const s = line.replace(/\r$/, '').replace(/^ +/, '');
    if (!s.startsWith('- ')) break;
    out.push(unquote(s.slice(2)));
  }
  if (out.length === 0) throw new OcrModelConfigError('missing-dictionary', 'empty');
  return out;
}

/**
 * Οι κλάσεις της εξόδου CTC: `0` = blank, μετά το λεξικό, τελευταίο το κενό (PaddleOCR `use_space_char`). Το πλήθος
 * **ελέγχεται** απέναντι στην έξοδο του δικτύου: απόκλιση ⇒ σφάλμα, γιατί θα μετατόπιζε σιωπηλά κάθε χαρακτήρα.
 */
export function recognitionClasses(dictionary: readonly string[], outputClassCount: number): readonly string[] {
  const classes = ['', ...dictionary, ' '];
  if (classes.length !== outputClassCount) {
    throw new OcrModelConfigError('class-count-mismatch', `${classes.length} != ${outputClassCount}`);
  }
  return classes;
}
