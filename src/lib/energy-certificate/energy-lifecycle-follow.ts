/**
 * @fileoverview **Η ενεργειακή απάντηση ακολουθεί τη λειτουργική κατάσταση — μέχρι να την πάρει ο άνθρωπος** (ADR-777
 * §8.102.1) — καθαρή συνάρτηση.
 * @related `./energy-construction-notice.ts` (η υπενθύμιση όταν **δεν** ακολουθεί) · `./energy-certificate.ts` (ο ΕΝΑΣ
 *   αναγνώστης, ο κανόνας ορφανού της εκτίμησης) · `hooks/energy-certificate/useEnergyLifecycleFollow.ts` (η φόρμα)
 * @module lib/energy-certificate/energy-lifecycle-follow
 *
 * 🔑 **Κληρονομημένη τιμή με παράκαμψη** (Figma component overrides · Revit «By Category» · AutoCAD «ByLayer»): όσο ο
 * άνθρωπος δεν έχει απαντήσει, η απάντηση **προκύπτει** από την κατάσταση της μονάδας και φέρει σήμα «αυτόματα»· μόλις
 * την αγγίξει, γίνεται **δική του** και καμία αλλαγή κατάστασης δεν την ξαναγράφει.
 *
 * 🔑 **Χωρίς απώλειες** (πέρα από τους μεγάλους): το `before` κρατά την απάντηση **πριν** την παραγωγή. Κάθε επόμενη
 * αλλαγή κατάστασης ξεκινά από εκεί — όχι από την παραγόμενη — άρα «Υπό κατασκευή → Έτοιμο → Υπό κατασκευή» επιστρέφει
 * **ακριβώς** την εκτίμηση της ΜΕΑ που ο κανόνας ορφανού είχε κρύψει στο «υπό έκδοση».
 *
 * ⛔ **Ποτέ εγγραφή**: αλλάζει **μόνο** τη φόρμα· τίποτα δεν φεύγει χωρίς «Αποθήκευση», και ο έλεγχος επιπτώσεων το λέει.
 * ⛔ **Ποτέ πάνω σε κλάση ΠΕΑ**: δηλωμένο πιστοποιητικό είναι γεγονός, όχι προεπιλογή.
 * ⛔ **Ποτέ η εκτίμηση της ΜΕΑ**: τη γράφει η μελέτη, όχι η κατάσταση της μονάδας.
 */

import { isPreCompletionOperationalStatus, normalizeOperationalStatus } from '@/constants/operational-statuses';

import { applyEnergyCertificatePatch, type EnergyCertificate, type EnergyCertificateAbsence } from './energy-certificate';

/** Γιατί η απάντηση βγήκε αυτόματα — κάθε λόγος έχει ΜΙΑ φράση στην οθόνη. */
export type EnergyLifecycleReason = 'not-completed' | 'completed';

/** Η μνήμη μιας αυτόματης απάντησης: τι υπήρχε πριν, και γιατί άλλαξε. `null` = η απάντηση είναι του ανθρώπου. */
export interface EnergyLifecycleFollow {
  readonly before: EnergyCertificate;
  readonly reason: EnergyLifecycleReason;
}

export interface EnergyLifecycleOutcome {
  readonly certificate: EnergyCertificate;
  readonly follow: EnergyLifecycleFollow | null;
}

/**
 * Η απάντηση που **προκύπτει** για αυτή την κατάσταση — `null` όταν η κατάσταση δεν λέει τίποτα για το ΠΕΑ.
 *
 * - μονάδα που **δεν ολοκληρώθηκε** (`draft` · `under-construction`) χωρίς απάντηση ⇒ «υπό κατασκευή» (ν. 4122/2013
 *   άρθ. 12 §1α: ΠΕΑ εκδίδεται μετά την ολοκλήρωση)·
 * - μονάδα **έτοιμη** που λέει ακόμη «υπό κατασκευή» ⇒ «υπό έκδοση» (το ΠΕΑ οφείλεται πλέον). **Όχι** κενό: το κενό
 *   θα ήταν «δεν δηλώθηκε», που για ολοκληρωμένο κτήριο είναι ψευδές·
 * - επιθεώρηση · συντήρηση ⇒ τίποτα: το κτήριο υπάρχει, το ΠΕΑ δεν εξαρτάται από αυτό.
 */
function derivedAbsenceOf(
  certificate: EnergyCertificate,
  status: unknown,
): { readonly absence: EnergyCertificateAbsence; readonly reason: EnergyLifecycleReason } | null {
  if (certificate.class !== null) return null;
  const normalized = normalizeOperationalStatus(status);
  if (isPreCompletionOperationalStatus(normalized) && certificate.absence === null) {
    return { absence: 'under-construction', reason: 'not-completed' };
  }
  if (normalized === 'ready' && certificate.absence === 'under-construction') {
    return { absence: 'pending', reason: 'completed' };
  }
  return null;
}

/**
 * Η ενεργειακή απάντηση **μετά** την αλλαγή της λειτουργικής κατάστασης σε `nextStatus`.
 *
 * @param current η απάντηση της φόρμας τώρα.
 * @param follow η μνήμη της προηγούμενης αυτόματης απάντησης — `null` όταν η απάντηση είναι του ανθρώπου.
 */
export function energyFollowingOperationalStatus(
  current: EnergyCertificate,
  nextStatus: unknown,
  follow: EnergyLifecycleFollow | null,
): EnergyLifecycleOutcome {
  const base = follow === null ? current : follow.before;
  const derived = derivedAbsenceOf(base, nextStatus);
  if (derived === null) return { certificate: base, follow: null };
  return {
    certificate: applyEnergyCertificatePatch(base, { absence: derived.absence }),
    follow: { before: base, reason: derived.reason },
  };
}
