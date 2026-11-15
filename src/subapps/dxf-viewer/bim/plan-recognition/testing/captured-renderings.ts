/**
 * **Αποδόσεις της παραγωγής, καταγεγραμμένες** (ADR-929 §6.21.5): εικόνες που έδωσε ο browser του χρήστη για μια πηγή του
 * χρυσού συνόλου, μεταφερμένες pixel προς pixel στο repo.
 *
 * 🔑 **Γιατί δεύτερη απόδοση.** Το pdf.js στο Node και στο Chrome ζωγραφίζουν την ίδια σελίδα με **άλλη** εξομάλυνση
 * (§6.21.3: η πάνω πλευρά του ορθογωνίου του ΤΕΣΤ2 βγαίνει 1 px στο Chrome, 2 στο Node). Ο χρυσός runner που μετρά μόνο
 * την απόδοση του Node θα έβλεπε πράσινο εκεί όπου η παραγωγή έσπαγε.
 * 🔑 **Κλειδί = sha256 της πηγής.** Το μανιφέστο ζει εκτός repo· το repo δεν ξέρει ονόματα αρχείων ή διαδρομές. Το
 * αποτύπωμα δεν αποκαλύπτει τίποτα από το περιεχόμενο (ούτε τα metadata) και δένει την εικόνα με **ακριβώς** εκείνο το
 * αρχείο: άλλη έκδοση της πηγής ⇒ καμία καταγεγραμμένη απόδοση, όχι λάθος σύγκριση.
 * 🔑 **Άθροισμα ελέγχου.** Η αποκωδικοποιημένη εικόνα πρέπει να δίνει το άθροισμα που μετρήθηκε στον browser.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/captured-renderings
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { decodeGrayRle, type GrayImage } from './gray-rle-raster';

export interface CapturedRendering {
  /** Ποιος ζωγράφισε (π.χ. `chrome-production`) — εμφανίζεται στο όνομα του test. */
  readonly renderer: string;
  /** Σχετικά με τον φάκελο `__tests__/fixtures` της αναγνώρισης. */
  readonly fixture: string;
  readonly width: number;
  readonly height: number;
  /** {@link grayChecksum} όπως μετρήθηκε στον browser. */
  readonly checksum: number;
}

const FIXTURES_DIR = path.resolve(__dirname, '..', '__tests__', 'fixtures');

/** ΤΕΣΤ2 (ADR-929 §6.21): η εικόνα της αναγνώρισης στο Chrome της παραγωγής, `PLAN_RENDER_SCALE` = 2. */
export const TEST2_CHROME_RENDERING: CapturedRendering = {
  renderer: 'chrome-production',
  fixture: 'test2-chrome-render.rle.txt',
  width: 1190,
  height: 1684,
  checksum: 3914516178,
};

/** sha256 της πηγής → οι καταγεγραμμένες αποδόσεις της. */
const CAPTURED_BY_SOURCE: Readonly<Record<string, readonly CapturedRendering[]>> = {
  '01c86397bf1122e6f65171cb0e465327b05438705b2d91b12a7ee7c84134ad74': [TEST2_CHROME_RENDERING],
};

export function capturedRenderingsOf(sourceSha256: string): readonly CapturedRendering[] {
  return CAPTURED_BY_SOURCE[sourceSha256] ?? [];
}

/** Η εικόνα μιας καταγεγραμμένης απόδοσης, από το fixture του repo. */
export function loadCapturedRendering(r: CapturedRendering): GrayImage {
  return decodeGrayRle(readFileSync(path.join(FIXTURES_DIR, r.fixture), 'utf8'), r.width, r.height);
}
