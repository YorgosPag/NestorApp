/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΗΣ ΚΑΡΤΑΣ** — τι γίνεται δεκτό ως κατάστημα (ADR-841 §7 Α21.16).
 * @related lib/agency/showcase-read.ts (ο καλών) · types/showcase-card.ts (η σύμβαση) · CHECK 3.74
 * @module lib/agency/showcase-read-locations
 *
 * 🔴 **ΚΑΘΕ ΠΑΛΙΟ ΕΓΓΡΑΦΟ ΔΕΝ ΕΧΕΙ ΑΥΤΟ ΤΟ ΠΕΔΙΟ** — και το διαβάζει **ανώνυμος**. Ακριβώς
 * η κλάση που γέννησε την CHECK 3.74 (`legality` χωρίς τιμή ⇒ λευκή σελίδα). Άρα: απόν ή
 * σκουπίδι ⇒ `[]`, **ποτέ** σφάλμα.
 *
 * ⚠️ **Ανεκτικός ανά κατάστημα, αυστηρός ανά πεδίο**: ένα χαλασμένο κατάστημα **παραλείπεται**
 * (τα υπόλοιπα μένουν)· μια μισή οδός γίνεται `null` (λειτουργία «μόνο περιοχή»), ποτέ μισή
 * διεύθυνση σε δημόσια κάρτα.
 */

import { readWeeklyHours } from '@/lib/calendar/weekly-hours';
import { readPosition } from '@/lib/agency/showcase-read-geo';
import { readPlace, text } from '@/lib/agency/showcase-read-primitives';
import {
  MAX_SHOWCASE_LOCATIONS,
  SHOWCASE_LOCATION_ROLES,
  type ShowcaseChannelKind,
  type ShowcaseLocation,
  type ShowcaseLocationRole,
  type ShowcaseStreetLine,
} from '@/types/showcase-card';

function isRole(value: unknown): value is ShowcaseLocationRole {
  return SHOWCASE_LOCATION_ROLES.some((role) => role === value);
}

/** Η οδός — **ή ολόκληρη ή `null`**. Ο αριθμός μπορεί να λείπει (αγροτική διεύθυνση). */
export function readStreetLine(raw: unknown): ShowcaseStreetLine | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const street = text(source.street);
  const postalCode = text(source.postalCode);
  if (street === null || postalCode === null) return null;
  return { street, number: text(source.number) ?? '', postalCode };
}

/** Μόνο γνωστά είδη, χωρίς επαναλήψεις, σε σταθερή σειρά. */
function readChannelKinds(raw: unknown): readonly ShowcaseChannelKind[] {
  if (!Array.isArray(raw)) return [];
  const kinds: ShowcaseChannelKind[] = ['phone', 'email'];
  return kinds.filter((kind) => raw.includes(kind));
}

function readLocation(raw: unknown): ShowcaseLocation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const id = text(source.id);
  const place = readPlace(source.place);
  if (id === null || place === null || !isRole(source.role)) return null;

  return {
    id,
    role: source.role,
    label: text(source.label),
    place,
    position: readPosition(source.position),
    street: readStreetLine(source.street),
    hours: readWeeklyHours(source.hours),
    channelKinds: readChannelKinds(source.channelKinds),
  };
}

/**
 * **Τα καταστήματα** — με την **έδρα πρώτη** και το ταβάνι επιβεβλημένο **και εδώ**: ανάμεσα
 * στον γραφέα και στον αναγνώστη υπάρχει χειροκίνητη επεξεργασία και λάθος ανάπτυξη.
 */
export function readLocations(raw: unknown): readonly ShowcaseLocation[] {
  if (!Array.isArray(raw)) return [];
  const read: ShowcaseLocation[] = [];
  for (const entry of raw) {
    const location = readLocation(entry);
    if (location !== null) read.push(location);
    if (read.length === MAX_SHOWCASE_LOCATIONS) break;
  }
  return read.sort((left, right) => Number(right.role === 'headquarters') - Number(left.role === 'headquarters'));
}
