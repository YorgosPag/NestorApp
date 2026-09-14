/**
 * @fileoverview **Ο ΑΝΑΓΝΩΣΤΗΣ ΤΩΝ ΙΔΙΩΤΙΚΩΝ ΚΑΝΑΛΙΩΝ** — `showcase_card_channels/{companyId}` (ADR-841 §7 Α21.16).
 * @related lib/agency/showcase-card-form.ts (η άλλη κατεύθυνση) · types/showcase-card.ts
 * @module lib/agency/showcase-card-channels-read
 *
 * ⚠️ **Ανεκτικός**: απόν έγγραφο ή κατάστημα ⇒ κενά κανάλια, **ποτέ** σφάλμα. Το σύνορο
 * δέχεται `unknown` — ανάμεσα στον γραφέα και σε αυτόν υπάρχει χειροκίνητη επεξεργασία.
 */

import { text } from '@/lib/agency/showcase-read-primitives';
import type { ShowcaseLocationChannels, ShowcasePhone } from '@/types/showcase-card';

export const NO_CHANNELS: ShowcaseLocationChannels = { phones: [], emails: [] };

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
  return { phones: readPhones(row.phones), emails };
}
