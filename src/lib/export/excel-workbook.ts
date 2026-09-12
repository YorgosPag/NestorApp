/**
 * =============================================================================
 * EXCEL WORKBOOK — το **κοινό** ντύσιμο και το κοινό κατέβασμα
 * =============================================================================
 *
 * Ό,τι κάνει ένα `.xlsx` της εφαρμογής να μοιάζει με τα υπόλοιπα, και ο ένας τρόπος να
 * φτάσει στον δίσκο του ανθρώπου.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🧹 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο μετατροπέας `#RRGGBB → FFRRGGBB` ήταν γραμμένος σε **επτά** αρχεία, με **δύο** ονόματα
 * (`toExcelArgb` / `toArgb`) και **δύο** σώματα (βοηθητική μεταβλητή / μονόγραμμο) — δηλαδή
 * ακόμα κι ένα grep στο όνομα θα έβρισκε τα μισά. Μαζί του ταξίδευαν το `HEADER_FILL` και
 * το `HEADER_FONT` με **ταυτόσημες** τιμές από τα `designTokens`.
 *
 * Και το κατέβασμα: `writeBuffer()` → `Blob` **με το μακρύ MIME του OOXML** → trigger,
 * επαναλαμβανόμενο αυτούσιο. Ένα λάθος γράμμα σε εκείνο το MIME δίνει αρχείο που το Excel
 * αρνείται — και η μόνη άμυνα ήταν να είναι σωστά αντιγραμμένο **κάθε** φορά.
 *
 * Το έπιασε το **CHECK 3.28** (2026-09-12) όταν το ADR-857 άγγιξε τους εξαγωγείς.
 *
 * 🔶 **Η μετανάστευση ΔΕΝ είναι πλήρης, και αυτό είναι γραμμένο επίτηδες**: εδώ πέρασαν
 * `gantt` · `payment` · `milestone`. Μένουν `report-engine/{report-excel,builder-excel-*}`
 * και `lib/export/analytics-xlsx` — καταγεγραμμένα στο `.claude-rules/pending-ratchet-work.md`.
 * Boy Scout όταν τα ακουμπήσεις, όχι μαζική αλλαγή σε δουλειά ταυτότητας.
 *
 * @module lib/export/excel-workbook
 * @enterprise ADR-583 (CHECK 3.28)
 */

import type ExcelJS from 'exceljs';
import { designTokens } from '@/styles/design-tokens';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { canonicalMimeForFilename } from '@/config/file-types/classification-registry';

/**
 * `#RRGGBB` → `FFRRGGBB` — το ExcelJS θέλει **άλφα μπροστά**.
 *
 * ⚠️ Το `FF` είναι αδιαφανές. Παράλειψή του δίνει χρώμα που το Excel διαβάζει ως διαφανές
 * και **δεν ζωγραφίζει** — σιωπηλά, χωρίς σφάλμα.
 */
export function toExcelArgb(hexColor: string): string {
  return `FF${hexColor.replace('#', '').toUpperCase()}`;
}

/** Το γέμισμα της γραμμής κεφαλίδας — το πρωτεύον χρώμα της εφαρμογής. */
export const EXCEL_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: toExcelArgb(designTokens.colors.blue['500']) },
};

/**
 * Η γραμματοσειρά της κεφαλίδας — έντονη, στο χρώμα του φόντου (αντίθεση πάνω στο γέμισμα).
 *
 * @param size προαιρετικό μέγεθος· χωρίς αυτό μένει η προεπιλογή του φύλλου
 */
export function excelHeaderFont(size?: number): Partial<ExcelJS.Font> {
  return {
    bold: true,
    color: { argb: toExcelArgb(designTokens.colors.background.primary) },
    ...(size === undefined ? {} : { size }),
  };
}

/**
 * **Γράψε το βιβλίο και δώσ' το στον άνθρωπο.**
 *
 * ⚠️ Το `writeBuffer()` είναι το σημείο χωρίς επιστροφή: μετά από αυτό το βιβλίο έχει
 * σειριοποιηθεί και αλλαγές σε φύλλα **δεν** φτάνουν στο αρχείο. Καλείται τελευταίο.
 *
 * 🔑 **Το MIME ΔΕΝ γράφεται εδώ** — το δίνει το `canonicalMimeForFilename` από το μητρώο
 * τύπων αρχείου (ADR-296, CHECK 3.7). Η πρώτη γραφή αυτού του module το είχε ως δική της
 * σταθερά *«γραμμένη μία φορά, επίτηδες»* — και η πύλη είχε δίκιο που το έκοψε: «μία φορά
 * **εδώ**» είναι **άλλη** μια φορά. Το μητρώο ξέρει ήδη ότι `.xlsx` σημαίνει
 * `…spreadsheetml.sheet`, και το ξέρει **μαζί** με την προέκταση — άρα ένα `.xls` δεν
 * μπορεί να φύγει με λάθος MIME.
 */
export async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const type = canonicalMimeForFilename(filename);
  triggerExportDownload({ blob: new Blob([buffer], { type }), filename });
}
