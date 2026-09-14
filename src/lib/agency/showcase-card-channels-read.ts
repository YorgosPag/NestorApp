/**
 * @fileoverview **Ο ΑΝΑΓΝΩΣΤΗΣ ΤΩΝ ΙΔΙΩΤΙΚΩΝ ΚΑΝΑΛΙΩΝ** — `showcase_card_channels/{companyId}` (ADR-841 §7 Α21.16).
 * @related lib/agency/showcase-card-form.ts (η άλλη κατεύθυνση) · types/showcase-card.ts
 * @module lib/agency/showcase-card-channels-read
 *
 * ⚠️ **Ανεκτικός**: απόν έγγραφο ή κατάστημα ⇒ κενά κανάλια, **ποτέ** σφάλμα. Το σύνορο
 * δέχεται `unknown` — ανάμεσα στον γραφέα και σε αυτόν υπάρχει χειροκίνητη επεξεργασία.
 */

import { text } from '@/lib/agency/showcase-read-primitives';
import { carryConfirmations } from '@/lib/agency/showcase-email-confirmation-rules';
import type { ShowcaseEmailConfirmation, ShowcaseLocationChannels, ShowcasePhone } from '@/types/showcase-card';

export const NO_CHANNELS: ShowcaseLocationChannels = { phones: [], emails: [], emailConfirmations: [] };

/** Οι αποθηκευμένες επιβεβαιώσεις (Α21.18) — απούσες σε κάθε έγγραφο πριν τη φέτα ⇒ `[]`. */
function readConfirmations(raw: unknown): readonly ShowcaseEmailConfirmation[] {
  if (!Array.isArray(raw)) return [];
  const confirmations: ShowcaseEmailConfirmation[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const email = text(row.email);
    const confirmedAt = text(row.confirmedAt);
    if (email !== null && confirmedAt !== null) confirmations.push({ email, confirmedAt });
  }
  return confirmations;
}

function readPhones(raw: unknown): readonly ShowcasePhone[] {
  if (!Array.isArray(raw)) return [];
  const phones: ShowcasePhone[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const e164 = text(row.e164);
    if (e164 !== null) phones.push({ e164, extension: text(row.extension) });
  }
  return phones;
}

/** **Τα κανάλια ενός καταστήματος** από το ωμό έγγραφο. */
export function readLocationChannels(raw: unknown, locationId: string): ShowcaseLocationChannels {
  if (typeof raw !== 'object' || raw === null) return NO_CHANNELS;
  const locations = (raw as Record<string, unknown>).locations;
  if (typeof locations !== 'object' || locations === null) return NO_CHANNELS;
  const entry = (locations as Record<string, unknown>)[locationId];
  if (typeof entry !== 'object' || entry === null) return NO_CHANNELS;

  const row = entry as Record<string, unknown>;
  const emails = Array.isArray(row.emails)
    ? row.emails.map(text).filter((email): email is string => email !== null)
    : [];
  // ⚠️ Ο **ίδιος** κανόνας με τον γραφέα: επιβεβαίωση διεύθυνσης που δεν είναι πια στα `emails`
  //    δεν διαβάζεται — χειροκίνητη επεξεργασία στη μέση δεν γεννά σήμα χωρίς διεύθυνση.
  return { phones: readPhones(row.phones), emails, emailConfirmations: carryConfirmations(readConfirmations(row.emailConfirmations), emails) };
}
