/**
 * **`/contacts/inbox` — «ποιοι με πλησίασαν»** (ADR-843 §10 Κ7 #1).
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link ContactInboxContent}, ίδιο ιδίωμα με το
 * `(me)/demands/page.tsx` → `MyDemandsContent`.
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα) το δίνει το `(me)/layout.tsx` —
 * **ποτέ** φρουρός μέσα στη σελίδα (CHECK 3.52 · ADR-777 §8.12).
 *
 * @module app/(me)/contacts/inbox/page
 */

import { ContactInboxContent } from '@/components/contact/ContactInboxContent';

export default function ContactInboxPage() {
  return <ContactInboxContent />;
}
