/**
 * 🖼️ **ΠΟΙΑ ΕΙΚΟΝΑ ΤΑΥΤΟΤΗΤΑΣ ΕΧΕΙ ΑΥΤΗ Η ΕΠΑΦΗ** — μία απάντηση, για κάθε οθόνη (ADR-190 §Display).
 *
 * Ως τις 2026-10-18 η απάντηση ζούσε **μέσα στο** `ContactDetailsHeader` (switch ανά τύπο + cache-buster), ενώ το
 * πλέγμα και η λίστα δεν έδειχναν **καμία** εικόνα. Κάθε νέα οθόνη θα έγραφε δεύτερη εκδοχή του ίδιου switch.
 *
 * Κανόνας (HubSpot · Attio · Google Contacts):
 * - **πρόσωπο** → `photoURL` · σχήμα `person` (κύκλος, γέμισμα με περικοπή)
 * - **εταιρεία / υπηρεσία** → `logoURL` · σχήμα `organization` (στρογγυλεμένο τετράγωνο, **χωρίς** περικοπή)
 * - χωρίς εικόνα → `imageUrl: undefined` ⇒ ο καταναλωτής δείχνει **αρχικά** (ποτέ γενικό εικονίδιο).
 *
 * 🔴 **Ο cache-buster ήταν χαλασμένος**: κολλούσε `?v=…` πάνω σε URL του Firebase που έχει **ήδη** query
 * (`?alt=media&token=…`) ⇒ `token=xxx?v=…`, δηλαδή **άλλο token**. Και το `updatedAt` είναι Timestamp ⇒
 * `?v=[object Object]`. Εδώ η παράμετρος μπαίνει με το URL API και η έκδοση είναι αριθμός.
 *
 * @module lib/contacts/contact-identity-image
 */

import { normalizeToDate } from '@/lib/date-local';
import type { EntityAvatarSpec } from '@/design-system/primitives/Avatar/entity-avatar.types';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName, isIndividualContact } from '@/types/contacts';

/** Η παράμετρος έκδοσης που βάζει ο επιλυτής — ένα όνομα, για όποιον χρειαστεί να την αναγνωρίσει. */
export const CONTACT_IMAGE_VERSION_PARAM = 'v';

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Το ωμό URL εικόνας ανά τύπο — **χωρίς** cache-buster. Χρήσιμο για σύγκριση με τη συλλογή φωτογραφιών
 * (`multiplePhotoURLs`, `[logoURL, photoURL]`), όπου τα στοιχεία δεν φέρουν ποτέ παράμετρο έκδοσης.
 */
export function contactImageSourceUrl(contact: Contact): string | undefined {
  return isIndividualContact(contact) ? nonEmpty(contact.photoURL) : nonEmpty(contact.logoURL);
}

/**
 * Ατομική φωτογραφία **χωρίς** συλλογή ⇒ μπορεί να αντικαταστάθηκε στην ίδια διαδρομή, άρα ο browser (και η
 * cache μικρογραφιών) πρέπει να ξέρει την έκδοση. Η ίδια συνθήκη με την ιστορική κεφαλίδα (2025-12-04).
 */
function needsVersion(contact: Contact): boolean {
  return isIndividualContact(contact) && Array.isArray(contact.multiplePhotoURLs) && contact.multiplePhotoURLs.length === 0;
}

function withVersion(url: string, contact: Contact): string {
  const version = normalizeToDate(contact.updatedAt)?.getTime();
  if (version === undefined || !/^https?:\/\//i.test(url)) return url;
  const parsed = new URL(url);
  parsed.searchParams.set(CONTACT_IMAGE_VERSION_PARAM, String(version));
  return parsed.toString();
}

/** **Ο επιλυτής**: ό,τι χρειάζεται ένα avatar επαφής — εικόνα (αν υπάρχει), όνομα αρχικών, σπόρος χρώματος, σχήμα. */
export function resolveContactIdentityImage(contact: Contact): EntityAvatarSpec {
  const source = contactImageSourceUrl(contact);
  return {
    name: getContactDisplayName(contact),
    seed: contact.id ?? getContactDisplayName(contact),
    imageUrl: source && needsVersion(contact) ? withVersion(source, contact) : source,
    kind: isIndividualContact(contact) ? 'person' : 'organization',
  };
}
