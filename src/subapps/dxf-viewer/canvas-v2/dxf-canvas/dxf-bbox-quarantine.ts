/**
 * ADR-746 — 🛡️ Απομόνωση «δηλητηριώδους» οντότητας στον υπολογισμό ορίων (culling).
 *
 * ⚠️ ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ζωντανό crash 2026-08-01): μία διάσταση χωρίς `defPoints` πέταξε μέσα στο
 * `getEntityBBox` → η εξαίρεση ανέβηκε μέχρι το `try` του `DxfBitmapCache.rebuild` → `cacheKey`
 * μηδενίστηκε → **κάθε καρέ** ξαναέχτιζε το raster ΟΛΟΥ του σχεδίου και το ξαναπετούσε.
 * Το κόστος μιας κακής οντότητας ήταν **ολόκληρη η σκηνή, για πάντα**.
 *
 * 🏛️ ΑΡΧΗ (Revit «Audit on open» / element isolation): ένα διεφθαρμένο στοιχείο **δεν** ακυρώνει
 * το μοντέλο. Απομονώνεται, αναφέρεται μία φορά, και το υπόλοιπο μοντέλο ζωγραφίζεται κανονικά.
 * Ο Revit το διαγράφει σε recovery file· εμείς το κρατάμε ορατό με το συντηρητικό κουτί (βλ. πιο
 * κάτω) και αφήνουμε τη γεωμετρική επισκευή στο `resolveDimDefPoints` (ADR-746 §3).
 *
 * 📐 ΓΙΑΤΙ ΤΟ FALLBACK ΕΙΝΑΙ «ΠΑΝΤΑ ΟΡΑΤΟ» ΚΑΙ ΟΧΙ «ΠΟΤΕ ΟΡΑΤΟ»: το culling απαντά σε ΕΝΑ
 * ερώτημα — «μπορώ να το παραλείψω με ασφάλεια;». Άγνωστα όρια ⇒ η απάντηση είναι **όχι**.
 * Ένα κενό κουτί θα έκανε την οντότητα να **εξαφανιστεί σιωπηλά**, που είναι ακριβώς το σφάλμα
 * της κλάσης ADR-362/ADR-568 («αόρατο στο 2D, αλλά ανάβει στο hover») — μια σιωπηλή απώλεια
 * είναι **χειρότερη** από ένα ορατό σφάλμα. Ίδια σύμβαση με το υπάρχον `FULL_PLANE_BBOX`.
 *
 * 🔇 ΓΙΑΤΙ QUARANTINE ΚΑΙ ΟΧΙ ΣΚΕΤΟ try/catch: χωρίς μνήμη, το ίδιο σφάλμα καταγράφεται
 * **60 φορές το δευτερόλεπτο** — η κονσόλα γεμίζει, το DevTools παγώνει και το πραγματικό σήμα
 * χάνεται. Κάθε οντότητα αναφέρεται **ακριβώς μία φορά**.
 *
 * @see ADR-746 §4 — γιατί η απομόνωση ζει εδώ και όχι στο `DxfRenderer.drawInOrder`
 */

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('DxfBBoxQuarantine');

/**
 * Πόσες **διαφορετικές** οντότητες αναφέρονται αναλυτικά πριν η καταγραφή σιωπήσει.
 * Σε κατεστραμμένο αρχείο τα ευρήματα είναι εκατοντάδες· τα πρώτα ~20 αρκούν για διάγνωση,
 * τα υπόλοιπα είναι θόρυβος που κρύβει το σήμα.
 */
const MAX_REPORTED = 20;

/** Οντότητες που έχουν ήδη αποτύχει — δεν ξανα-αναφέρονται (ούτε ξαναδοκιμάζονται σε log). */
const quarantined = new Set<string>();
let suppressedCount = 0;

/**
 * Καταγράφει **μία φορά** την αποτυχία ορίων μιας οντότητας.
 * @returns `true` αν ήταν η πρώτη φορά για αυτή την οντότητα.
 */
export function reportBBoxFailure(
  entityId: string,
  entityType: string,
  error: unknown,
): boolean {
  const key = `${entityType}#${entityId}`;
  if (quarantined.has(key)) return false;
  quarantined.add(key);

  if (quarantined.size > MAX_REPORTED) {
    suppressedCount++;
    return true;
  }

  logger.error('Entity bbox computation failed — entity quarantined, scene keeps rendering', {
    entityId,
    entityType,
    // Το μήνυμα ΚΑΙ το stack: χωρίς stack η αιτία («ποιο πεδίο έλειπε») δεν είναι ανακτήσιμη.
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    quarantinedTotal: quarantined.size,
  });
  return true;
}

/** Πόσες οντότητες βρίσκονται σε καραντίνα (διαγνωστικό + assertions σε tests). */
export function quarantinedCount(): number {
  return quarantined.size;
}

/**
 * Καθαρίζει την καραντίνα. Κάλεσέ το όταν **αλλάζει σκηνή** (νέο αρχείο / νέα στάθμη), ώστε
 * τα σφάλματα της νέας σκηνής να αναφερθούν κανονικά, και στα tests για απομόνωση.
 */
export function resetBBoxQuarantine(): void {
  if (suppressedCount > 0) {
    logger.warn('Quarantine reset — additional failures were suppressed', { suppressedCount });
  }
  quarantined.clear();
  suppressedCount = 0;
}
