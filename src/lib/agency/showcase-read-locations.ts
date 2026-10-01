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

import { readSpecialDays } from '@/lib/calendar/special-hours';
import { readWeeklyHours } from '@/lib/calendar/weekly-hours';
import { readPosition } from '@/lib/agency/showcase-read-geo';
import { readPlace, text } from '@/lib/agency/showcase-read-primitives';
import { isAdminAreaId } from '@/lib/geo/admin-area-index-file';
import {
  MAX_SHOWCASE_LOCATIONS,
  SHOWCASE_LOCATION_ROLES,
  type ShowcaseAreaLocation,
  type ShowcaseChannelKind,
  type ShowcaseLocation,
  type ShowcaseLocationArea,
  type ShowcaseStreetLocation,
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

/**
 * **Η νεότερη επιβεβαίωση email** (Α21.18) — μόνο αν το κατάστημα **έχει** email και η ημερομηνία
 * διαβάζεται. Σήμα χωρίς κανάλι θα έλεγε «λαμβάνει» για γραμματοκιβώτιο που δεν δημοσιεύεται.
 */
function readEmailConfirmedAt(raw: unknown, kinds: readonly ShowcaseChannelKind[]): string | null {
  const at = text(raw);
  return at !== null && kinds.includes('email') && Number.isFinite(Date.parse(at)) ? at : null;
}

/** Η δημόσια περιοχή — μόνο ταυτότητα ADR-883 που **αναγνωρίζεται**· αλλιώς `null` («δεν δημοσιεύεται»). */
function readArea(raw: unknown): ShowcaseLocationArea | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const adminId = text((raw as Record<string, unknown>).adminId);
  return adminId !== null && isAdminAreaId(adminId) ? { adminId } : null;
}

/**
 * 🔴 **«ΜΟΝΟ ΠΕΡΙΟΧΗ» ⇒ Ο ΤΟΠΟΣ ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ, ΑΚΟΜΗ ΚΙ ΑΝ ΥΠΑΡΧΕΙ** (ADR-896 §6). Έγγραφο γραμμένο πριν τη
 * διόρθωση κρατά ακόμη `place`/`position` — η σελίδα **δεν** τα αποδίδει ποτέ, ώσπου η μετάπτωση να τα
 * μεταφέρει στο ιδιωτικό μισό. Η οδός αντίθετα **χρειάζεται** τόπο: χωρίς αυτόν το κατάστημα παραλείπεται.
 */
type LocationSite =
  | Pick<ShowcaseStreetLocation, 'street' | 'place' | 'position'>
  | Pick<ShowcaseAreaLocation, 'street' | 'area'>;

function readSite(source: Record<string, unknown>): LocationSite | null {
  const street = readStreetLine(source.street);
  if (street === null) return { street: null, area: readArea(source.area) };
  const place = readPlace(source.place);
  return place === null ? null : { street, place, position: readPosition(source.position) };
}

function readLocation(raw: unknown): ShowcaseLocation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const id = text(source.id);
  const site = readSite(source);
  if (id === null || site === null || !isRole(source.role)) return null;
  const channelKinds = readChannelKinds(source.channelKinds);

  return {
    id,
    role: source.role,
    label: text(source.label),
    ...site,
    hours: readWeeklyHours(source.hours),
    // Α21.21 — κάθε παλιό έγγραφο δεν έχει το πεδίο ⇒ `[]`, καμία μετανάστευση.
    specialHours: readSpecialDays(source.specialHours),
    channelKinds,
    emailConfirmedAt: readEmailConfirmedAt(source.emailConfirmedAt, channelKinds),
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
