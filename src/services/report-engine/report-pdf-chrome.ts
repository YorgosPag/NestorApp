/**
 * =============================================================================
 * REPORT PDF CHROME — η **επίπλωση** της σελίδας, σε ένα σπίτι
 * =============================================================================
 *
 * Το περιθώριο, η παλέτα και το υποσέλιδο: ό,τι είναι **ίδιο** σε κάθε PDF της μηχανής
 * αναφορών, ανεξάρτητα από το τι γράφει μέσα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🧹 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΟ ΑΝΤΙΓΡΑΦΟ ΤΟ ΟΜΟΛΟΓΟΥΣΕ ΣΕ ΣΧΟΛΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η παλέτα ήταν γραμμένη **τρεις φορές** με ταυτόσημες τιμές, και το
 * `builder-pdf-exporter.ts` το έγραφε μόνο του: *«CONSTANTS (match report-pdf-exporter.ts
 * palette)»*. Ένα σχόλιο που ζητά από τον άνθρωπο να **συντηρεί** τη συμφωνία δεν είναι
 * SSoT — είναι **ευχή**: η επόμενη αλλαγή χρώματος θα γινόταν σε ένα από τα τρία και τα
 * PDF θα απέκλιναν σιωπηλά.
 *
 * Και το υποσέλιδο ήταν **δίδυμο 24 γραμμών** (`addFooters` / `addPageFooters`) με **μία**
 * πραγματική διαφορά: το κείμενο στο κέντρο. Το έπιασε το **CHECK 3.28** (2026-09-12,
 * 16+8 γραμμές / 179 tokens) τη στιγμή που το ADR-857 άγγιξε **και τα δύο** — δηλαδή η
 * πύλη είδε το δίδυμο επειδή η ίδια αλλαγή ταυτότητας χρειάστηκε να γραφτεί δύο φορές.
 *
 * ⚠️ **ΤΙ ΔΕΝ ΜΠΗΚΕ ΕΔΩ, ΕΠΙΤΗΔΕΣ**: το `owner-report-pdf-exporter.ts` έχει `MARGIN = 16`.
 * Διαφορετική τιμή σημαίνει **διαφορετική απόφαση**, όχι απόκλιση — δεν ισοπεδώνεται.
 *
 * @module services/report-engine/report-pdf-chrome
 * @enterprise ADR-583 (CHECK 3.28) · ADR-857 (η ταυτότητα στο κέντρο του υποσέλιδου)
 */

import type jsPDF from 'jspdf';
import { formatDateShort } from '@/lib/intl-utils';

// ============================================================================
// ΓΕΩΜΕΤΡΙΑ & ΠΑΛΕΤΑ
// ============================================================================

/** Περιθώριο σελίδας σε mm. */
export const MARGIN = 14;

/** blue-500 — το χρώμα των κεφαλίδων πίνακα. */
export const PRIMARY: [number, number, number] = [59, 130, 246];

export const SLATE_800: [number, number, number] = [30, 41, 59];
export const SLATE_500: [number, number, number] = [71, 85, 105];
export const SLATE_400: [number, number, number] = [148, 163, 184];
export const SLATE_200: [number, number, number] = [226, 232, 240];

// ============================================================================
// ΕΠΙΚΕΦΑΛΙΔΑ
// ============================================================================

/**
 * **Ο τίτλος αριστερά, η ημερομηνία αναφοράς δεξιά** — στην ίδια γραμμή βάσης.
 *
 * ⚠️ Τα δύο γράφονται μαζί επειδή **μοιράζονται το `y`**: είναι μία οπτική γραμμή, όχι δύο
 * ανεξάρτητα κείμενα που τυχαίνει να συμπίπτουν. Χωριστά, μια αλλαγή στο ένα θα άφηνε το
 * άλλο μετέωρο — και ακριβώς αυτό ήταν το δίδυμο που μέτρησε το CHECK 3.28 (12 γραμμές).
 */
export function drawReportHeading(pdf: jsPDF, title: string, y: number, pageWidth: number): void {
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(...SLATE_800);
  pdf.text(title, MARGIN, y);

  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...SLATE_500);
  pdf.text(
    `Ημ. Αναφοράς: ${formatDateShort(new Date())}`,
    pageWidth - MARGIN,
    y,
    { align: 'right' },
  );
}

// ============================================================================
// ΠΙΝΑΚΕΣ (autoTable)
// ============================================================================

/**
 * **Επίβαλε τη Roboto σε ΚΑΘΕ κελί.**
 *
 * Η `autoTable` ξαναγράφει το `font` ανά κελί από τα δικά της προεπιλεγμένα· χωρίς αυτό το
 * hook τα ελληνικά πέφτουν σε γραμματοσειρά που δεν τα έχει. Γι' αυτό επαναλαμβανόταν σε
 * **κάθε** κλήση — τώρα είναι μία αναφορά συνάρτησης.
 */
export function forceRobotoCell(data: { cell: { styles: { font: string } } }): void {
  data.cell.styles.font = 'Roboto';
}

/**
 * **Πού τελείωσε ο πίνακας που μόλις γράφτηκε;**
 *
 * Η `autoTable` αφήνει το `lastAutoTable.finalY` πάνω στο instance — δεν το επιστρέφει. Το
 * cast είναι ο **ένας** τρόπος να ρωτηθεί· ήταν γραμμένος τέσσερις φορές, κάθε μία με δικό
 * της εφεδρικό βήμα.
 *
 * @param fallbackStep πόσο να κατέβει αν η `autoTable` δεν άφησε τίποτα (δεν έγραψε πίνακα)
 */
export function yAfterTable(pdf: jsPDF, y: number, fallbackStep: number): number {
  return (pdf as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + fallbackStep;
}

// ============================================================================
// ΥΠΟΣΕΛΙΔΟ
// ============================================================================

interface ReportPdfFooterOptions {
  readonly pageWidth: number;
  readonly pageHeight: number;
  /**
   * Το κείμενο στο **κέντρο** — η ταυτότητα που υπογράφει το αρχείο (ADR-857).
   *
   * ⚠️ Είναι **παράμετρος** και όχι σταθερά επειδή εδώ ήταν η **μόνη** πραγματική διαφορά
   * των δύο διδύμων: ο Report Builder υπογράφει με προσδιορισμό, η μηχανή αναφορών με
   * σκέτο το όνομα του προϊόντος. Η ρίζα και των δύο είναι το `constants/product-identity`.
   */
  readonly centerLabel: string;
}

/**
 * **Γράψε το υποσέλιδο σε ΚΑΘΕ σελίδα** — αριθμός · ταυτότητα · χρονοσφραγίδα.
 *
 * ⚠️ Καλείται **στο τέλος**, αφού μπουν όλες οι σελίδες: το `getNumberOfPages()` πρέπει να
 * ξέρει το σύνολο για να γράψει «Σελίδα 3/7». Κλήση στη μέση δίνει λάθος παρονομαστή σε
 * **κάθε** σελίδα που γράφτηκε ως τότε.
 */
export function addReportPdfFooters(pdf: jsPDF, options: ReportPdfFooterOptions): void {
  const { pageWidth, pageHeight, centerLabel } = options;
  const totalPages = pdf.getNumberOfPages();
  const timestamp = new Date().toLocaleString('el-GR');

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE_400);

    pdf.text(`Σελίδα ${i}/${totalPages}`, MARGIN, pageHeight - 8);
    pdf.text(centerLabel, pageWidth / 2, pageHeight - 8, { align: 'center' });
    pdf.text(timestamp, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });

    pdf.setDrawColor(...SLATE_200);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);
  }
}
