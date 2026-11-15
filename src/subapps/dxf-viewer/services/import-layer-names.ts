/**
 * ADR-941 Δ5 × ADR-929 §6.20 — τα **ονόματα των layers εισαγωγής**: ΕΝΑ μητρώο για κάθε δρόμο που μετατρέπει ένα
 * υπόβαθρο σε οντότητες σχεδίου. Πρότυπο: AutoCAD `PDFIMPORT` → «Create object layers» (ένα layer ανά **κατηγορία**
 * εισαγόμενου αντικειμένου: `PDF_Geometry`, `PDF_Text`, …).
 *
 *   · `pdfGeometry` / `pdfText`  — ADR-941: τα διανύσματα και τα κείμενα ενός **διανυσματικού** PDF (ακριβή).
 *   · `recognizedGeometry`       — ADR-929 §6.20: οι γραμμές που **διάβασε η αναγνώριση** μιας εικόνας. Ξεχωριστό από το
 *                                  `PDF_Geometry`, γιατί έχουν άλλη πηγή και άλλη ακρίβεια (pixel, όχι διανύσματα):
 *                                  ο άνθρωπος τις κρύβει, τις ελέγχει ή τις σβήνει με ένα κλικ, χωρίς να αγγίξει τις ακριβείς.
 *
 * Τα ονόματα είναι **δεδομένα, όχι κείμενα UI** (ADR-941 Δ5): ταξιδεύουν σε DWG/DXF και δεν μεταφράζονται.
 * Οι διαστάσεις **δεν** έχουν θέση εδώ: πάνε στο layer του στυλ διάστασης (`DimStyle.targetLayer` ≡ `DIMLAYER`,
 * `services/named-layer.ts`).
 *
 * ΚΑΘΑΡΟ (δεδομένα).
 */

export const IMPORT_LAYER_NAMES = {
  pdfGeometry: 'PDF_Geometry',
  pdfText: 'PDF_Text',
  recognizedGeometry: 'RECOGNIZED_Geometry',
} as const;
