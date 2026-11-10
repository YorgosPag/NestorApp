/**
 * =============================================================================
 * ΟΙ ΠΟΡΟΙ ΤΟΥ OCR ΚΑΤΟΨΗΣ ΑΠΟ ΤΟ ΜΗΤΡΩΟ `.model-assets.json` (ADR-929 Φ0.4)
 * =============================================================================
 *
 * Ποια αρχεία χρειάζεται ο κινητήρας (ο εκτελεστής WASM + ανιχνευτής + δύο αναγνώστες, το «v6dual» της Φ0.1) και με ποιο
 * αποτύπωμα. Το sha256 και το μέγεθος **δεν** γράφονται εδώ: διαβάζονται από το **ίδιο** μητρώο που δηλώνει άδεια και
 * προέλευση (ένα σημείο αλήθειας — πρότυπο του `publication-fonts.ts`, που δείχνει σε διαδρομές του `.font-assets.json`).
 * Αρχείο που λείπει από το μητρώο ⇒ **σφάλμα** στη φόρτωση, ποτέ λήψη χωρίς έλεγχο (fail-closed).
 *
 * 📏 Η διαδρομή του μητρώου είναι από τη ρίζα του έργου (`public/…`)· το URL που σερβίρεται είναι χωρίς το `public`.
 * ⚠️ Η έκδοση του εκτελεστή στη διαδρομή (`public/ort/<έκδοση>/`) πρέπει να είναι η εγκατεστημένη `onnxruntime-web` — το
 *   ελέγχει ο worker (`ocr-onnx-runtime.ts`) πριν φορτώσει το WASM.
 *
 * @module bim/plan-recognition/ocr/ocr-model-assets
 */

import modelAssets from '../../../../../../.model-assets.json';

/** Ένα αρχείο προς λήψη: URL χωρίς βάση (`/models/…`) + το αναμενόμενο αποτύπωμα. */
export interface OcrAsset {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

/** Ένα μοντέλο PP-OCR: τα βάρη και οι επίσημες ρυθμίσεις του (`inference.yml`: κατώφλια DB ή λεξικό). */
export interface OcrModelAssets {
  readonly onnx: OcrAsset;
  readonly yml: OcrAsset;
}

export interface OcrAssetSet {
  readonly runtime: OcrAsset;
  readonly detector: OcrModelAssets;
  readonly primary: OcrModelAssets;
  readonly secondary: OcrModelAssets;
}

/** Η έκδοση του `onnxruntime-web` που ταιριάζει με το WASM του μητρώου. */
export const OCR_RUNTIME_VERSION = '1.30.0';

const RUNTIME_FILE = `public/ort/${OCR_RUNTIME_VERSION}/ort-wasm-simd-threaded.wasm`;
/** Το «v6dual» (απόφαση Giorgio 2026-11-10, ADR-929 Φ0.1). */
const DETECTOR_DIR = 'public/models/ocr/PP-OCRv6_small_det_onnx@28fe5895';
const PRIMARY_DIR = 'public/models/ocr/PP-OCRv6_small_rec_onnx@b8f84f0b';
const SECONDARY_DIR = 'public/models/ocr/el_PP-OCRv5_mobile_rec_onnx@8152b89d';

interface RegisteredAsset {
  readonly sha256: string;
  readonly bytes: number;
}

const REGISTERED: Readonly<Record<string, RegisteredAsset | undefined>> = modelAssets.assets;

export class OcrAssetRegistryError extends Error {
  constructor(file: string) {
    super(`ocr-model-assets: ${file} is not declared in .model-assets.json`);
    this.name = 'OcrAssetRegistryError';
  }
}

function registered(file: string): OcrAsset {
  const entry = REGISTERED[file];
  if (entry === undefined) throw new OcrAssetRegistryError(file);
  return { path: file.replace(/^public\//, '/'), sha256: entry.sha256, bytes: entry.bytes };
}

const model = (dir: string): OcrModelAssets => ({
  onnx: registered(`${dir}/inference.onnx`),
  yml: registered(`${dir}/inference.yml`),
});

/** Όλα τα αρχεία της ανάγνωσης, με το αποτύπωμά τους από το μητρώο. Ρίχνει αν κάποιο δεν είναι δηλωμένο. */
export function resolveOcrAssets(): OcrAssetSet {
  return {
    runtime: registered(RUNTIME_FILE),
    detector: model(DETECTOR_DIR),
    primary: model(PRIMARY_DIR),
    secondary: model(SECONDARY_DIR),
  };
}
