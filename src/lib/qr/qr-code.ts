/**
 * @fileoverview **Ο ΚΩΔΙΚΑΣ QR** — μία γέννηση, προκαθορισμένες χρήσεις (ADR-841 §7 Α21.17).
 * @related hooks/mandate/useShowcaseQr.ts · app/api/attendance/qr/generate · services/two-factor ·
 *   subapps/dxf-viewer/text-engine/title-block/qr-image-client.ts ·
 *   subapps/catalog/publishing/publication-qr.ts (τυπωμένος κατάλογος, μέσω `qrModuleRuns`, ADR-923 §5.13 Σ7)
 * @module lib/qr/qr-code
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΚΕΝΤΡΙΚΟΠΟΙΗΘΗΚΕ (N.0.2)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τρία σημεία καλούσαν το `qrcode` απευθείας, και **το καθένα διάλεγε μόνο του** το επίπεδο διόρθωσης
 * και το περιθώριο — `margin: 2`, `margin: 2`, `margin: 1`. Η προδιαγραφή (ISO/IEC 18004) ζητά
 * **ήσυχη ζώνη 4 μονάδων**: με λιγότερη, ένας σαρωτής σε σκούρο φόντο δεν βρίσκει πού τελειώνει ο
 * κωδικός. Η βιτρίνα θα ήταν ο τέταρτος που θα διάλεγε — εδώ διαλέγεται **μία φορά, με όνομα**.
 *
 * | Χρήση | Διόρθωση | Περιθώριο | Γιατί |
 * |---|---|---|---|
 * | `screen` | M (15%) | 4 | οθόνη: καθαρή εικόνα, μικρότερος κωδικός διαβάζεται ευκολότερα |
 * | `print` | Q (25%) | 4 | χαρτί/βιτρίνα: γδαρσίματα, αντανακλάσεις, κακός εκτυπωτής |
 * | `embedded` | M | 1 | **μέσα σε κελί** που ήδη έχει λευκό γύρω του (πινακίδα σχεδίου) — η ζώνη υπάρχει, απλώς δεν είναι του κωδικού |
 *
 * ⚠️ **Ισομορφικό**: το `qrcode` έχει build για φυλλομετρητή (`toString` χωρίς DOM, `toDataURL` με canvas).
 * Στη δημόσια σελίδα εισάγεται **δυναμικά** κατά το άνοιγμα — βιβλιοθήκη, όχι κλειδιά i18n.
 */

import QRCode from 'qrcode';

export const QR_PRESETS = {
  screen: { errorCorrectionLevel: 'M', margin: 4 },
  print: { errorCorrectionLevel: 'Q', margin: 4 },
  embedded: { errorCorrectionLevel: 'M', margin: 1 },
} as const;

export type QrPreset = keyof typeof QR_PRESETS;

/** Χρώματα σε `#rrggbb` — ο κωδικός θέλει **αντίθεση**, όχι θέμα· δες το `EnterpriseTwoFactorService`. */
export interface QrColors {
  readonly dark: string;
  readonly light: string;
}

/** **Διανυσματικός** κωδικός — για εκτύπωση σε οποιοδήποτε μέγεθος. */
export function qrSvg(payload: string, preset: QrPreset, colors?: QrColors): Promise<string> {
  return QRCode.toString(payload, { type: 'svg', ...QR_PRESETS[preset], color: colors });
}

/** Μία οριζόντια σειρά σκούρων μονάδων: γραμμή, πρώτη στήλη, μήκος — σε μονάδες του συμβόλου, χωρίς τη ζώνη. */
export type QrModuleRun = readonly [row: number, column: number, length: number];

/** Ο κωδικός ως **γεωμετρία**, για μηχανή που ζωγραφίζει μόνη της (Typst): ίδιο σύμβολο με το {@link qrSvg}. */
export interface QrModuleRuns {
  /** Πλευρά του συμβόλου σε μονάδες, χωρίς τη ζώνη ησυχίας. */
  readonly size: number;
  /** Η ζώνη ησυχίας της χρήσης, σε μονάδες, σε κάθε πλευρά. */
  readonly quietModules: number;
  readonly runs: readonly QrModuleRun[];
}

function rowRuns(row: number, size: number, dark: (row: number, column: number) => boolean): QrModuleRun[] {
  const runs: QrModuleRun[] = [];
  for (let column = 0; column < size; column += 1) {
    if (!dark(row, column)) continue;
    const start = column;
    while (column + 1 < size && dark(row, column + 1)) column += 1;
    runs.push([row, start, column - start + 1]);
  }
  return runs;
}

/**
 * **Σειρές σκούρων μονάδων** — ο κωδικός για χρώμα που δεν είναι RGB. Το SVG του `qrcode` γράφει `#000000`, άρα σε CMYK
 * αρχείο θα έμπαινε RGB· η μηχανή που ζωγραφίζει από γεωμετρία βάζει το δικό της μελάνι. Σύγχρονο και ντετερμινιστικό.
 */
export function qrModuleRuns(payload: string, preset: QrPreset): QrModuleRuns {
  const { errorCorrectionLevel, margin } = QR_PRESETS[preset];
  const { modules } = QRCode.create(payload, { errorCorrectionLevel });
  const dark = (row: number, column: number) => modules.get(row, column) === 1;
  const runs = Array.from({ length: modules.size }, (_, row) => rowRuns(row, modules.size, dark)).flat();
  return { size: modules.size, quietModules: margin, runs };
}

/** **PNG ως data URL** — για email, για ενσωμάτωση σε PDF, για όπου το SVG δεν γίνεται δεκτό. */
export function qrPngDataUrl(payload: string, preset: QrPreset, widthPx: number, colors?: QrColors): Promise<string> {
  return QRCode.toDataURL(payload, { ...QR_PRESETS[preset], width: widthPx, color: colors });
}
