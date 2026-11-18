/**
 * @fileoverview **Τι λέει η ενεργειακή ενότητα για τον κύκλο ζωής της κατασκευής** (ADR-777 §8.102) — καθαρή συνάρτηση.
 * @related `./energy-certificate.ts` (το μπλοκ) · `constants/operational-statuses.ts` (η κατάσταση της μονάδας) ·
 *   `components/shared/energy-certificate/EnergyProjectionFields.tsx` (η οθόνη)
 * @module lib/energy-certificate/energy-construction-notice
 *
 * 🔑 **Δύο στιγμές του νόμου, δύο υπενθυμίσεις** (ν. 4122/2013 άρθ. 12 §1α · §3):
 * - μονάδα που **χτίζεται** και η ενότητα δεν λέει τίποτα ⇒ πρόταση «υπό κατασκευή + εκτίμηση ΜΕΑ» (ΠΕΑ δεν μπορεί να
 *   υπάρξει ακόμη, άρα το «δεν έχει δηλωθεί» είναι άδικο για τον πωλητή και άχρηστο για τον αγοραστή)·
 * - μονάδα **έτοιμη** που λέει ακόμη «υπό κατασκευή» ⇒ προειδοποίηση: το ΠΕΑ οφείλεται πλέον.
 *
 * ⛔ **Πρόταση, ποτέ αυτόματη εγγραφή**: η κατάσταση της μονάδας τη γράφει άνθρωπος και μπορεί να είναι πρόχειρη· το
 * τι λέγεται δημόσια για την ενέργεια αποφασίζεται ρητά.
 */

import { isPreCompletionOperationalStatus, normalizeOperationalStatus } from '@/constants/operational-statuses';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';

import type { EnergyCertificate } from './energy-certificate';

export type EnergyConstructionNotice = 'suggest-under-construction' | 'completed-without-certificate';

/** Μία ΜΕΑ στα έγγραφα του έργου, όπως τη δείχνει η επιλογή της παραπομπής. */
export interface EnergyStudyOption {
  readonly fileId: string;
  readonly label: string;
}

/**
 * Ό,τι χρειάζεται η ενεργειακή ενότητα για ακίνητο που **χτίζεται** — το δίνει **μόνο** η φόρμα του γραφείου. Χωρίς
 * αυτό (ιδιώτης) το «υπό κατασκευή» δεν προσφέρεται.
 */
export interface EnergyConstructionContext {
  /** Οι ΜΕΑ του έργου — `null` = η μονάδα δεν ανήκει σε έργο. */
  readonly studies: readonly EnergyStudyOption[] | null;
  /**
   * **Η ΜΙΑ πόρτα ανεβάσματος της ΜΕΑ** — η καρτέλα «Έγγραφα» του έργου (`getProjectTabUrl`), `null` όταν δεν υπάρχει
   * έργο. Η οθόνη **δείχνει** τον δρόμο, δεν ανοίγει δεύτερη διαδρομή ανεβάσματος (ίδιο δοχείο με τον server).
   */
  readonly studiesHref: WorkspaceHref | null;
}

/** Η υπενθύμιση για αυτή τη μονάδα — `null` όταν η ενότητα συμφωνεί με την κατάσταση (ή η κατάσταση δεν είναι γνωστή). */
export function energyConstructionNoticeOf(
  operationalStatus: unknown,
  certificate: Pick<EnergyCertificate, 'class' | 'absence'>,
): EnergyConstructionNotice | null {
  const status = normalizeOperationalStatus(operationalStatus);
  if (status === null || certificate.class !== null) return null;
  if (isPreCompletionOperationalStatus(status) && certificate.absence === null) return 'suggest-under-construction';
  if (status === 'ready' && certificate.absence === 'under-construction') return 'completed-without-certificate';
  return null;
}
