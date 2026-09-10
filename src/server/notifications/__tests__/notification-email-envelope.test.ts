/**
 * @jest-environment node
 *
 * Άγκυρα — **Ο ΦΑΚΕΛΟΣ: ΠΟΙΟΣ ΠΑΙΡΝΕΙ ΣΥΝΔΕΣΜΟ ΚΑΙ ΠΟΙΟΣ ΚΕΦΑΛΙΔΑ ΔΙΑΓΡΑΦΗΣ** (ADR-848)
 *
 * | Μήνυμα | Σύνδεσμος | Διαχείριση | `List-Unsubscribe` |
 * |---|---|---|---|
 * | Ειδοποίηση | ✅ | ✅ | ✅ |
 * | **Επείγουσα** (ασφάλεια) | ✅ | ❌ | ❌ — καμία ρύθμιση δεν τη σταματά |
 * | Όχι ειδοποίηση | ❌ | ❌ | ❌ — δεν μας ανήκει ο φάκελός της |
 */

jest.mock('server-only', () => ({}));

import { scopeField } from '@/lib/notifications/email-subscription-scope';
import { planEmailDelivery, type PendingEmail } from '@/server/notifications/email-digest';
import {
  digestHeaders,
  soloEnvelope,
  subscriptionHeaders,
} from '@/server/notifications/notification-email-envelope';
import type { EmailLinks } from '@/server/notifications/notification-email-render';
import { MESSAGE_CATEGORIES, MESSAGE_PRIORITIES } from '@/types/communications';

const ORIGIN = 'https://nestorconstruct.gr';

const LINKS: EmailLinks = {
  permalink: (id) => `${ORIGIN}/n/${encodeURIComponent(id)}`,
  preferences: (uid) => `${ORIGIN}/email/preferences/tok-${uid}`,
  oneClickUnsubscribe: (uid) => `${ORIGIN}/api/notifications/email/subscription?t=tok-${uid}`,
};

function pending(overrides: Partial<PendingEmail> = {}): PendingEmail {
  return {
    id: 'm1',
    to: 'owner@example.com',
    subject: 'Νέα αγγελία ταιριάζει στη ζήτησή σας',
    content: '',
    priority: MESSAGE_PRIORITIES.NORMAL,
    category: MESSAGE_CATEGORIES.NOTIFICATION,
    language: 'el',
    notificationId: 'listing_match:u1:l1',
    recipientId: 'u1',
    ...overrides,
  };
}

describe('Α — μεμονωμένη ειδοποίηση', () => {
  it('Α1 🔑 — HTML, υπογεγραμμένο θέμα και ΚΑΙ ΟΙ ΔΥΟ κεφαλίδες του RFC 8058', () => {
    const envelope = soloEnvelope(pending(), LINKS);

    expect(envelope.subject).toBe('Νέα αγγελία ταιριάζει στη ζήτησή σας — ΝΕΣΤΩΡ');
    expect(envelope.html).toContain(`${ORIGIN}/n/listing_match%3Au1%3Al1`);
    expect(envelope.headers).toEqual({
      'List-Unsubscribe': `<${ORIGIN}/api/notifications/email/subscription?t=tok-u1>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('Α2 🔴 — ΕΠΕΙΓΟΥΣΑ: σύνδεσμος ναι, «διαχείριση» και κεφαλίδες ΟΧΙ', () => {
    // Μια υποχρεωτική ειδοποίηση ασφαλείας με «σταματήστε αυτά τα email» θα
    // υποσχόταν κάτι που καμία ρύθμιση δεν κάνει.
    const envelope = soloEnvelope(pending({ priority: MESSAGE_PRIORITIES.URGENT }), LINKS);

    expect(envelope.html).toContain('/n/listing_match');
    expect(envelope.html).not.toContain('/email/preferences/');
    expect(envelope.text).not.toContain('/email/preferences/');
    expect(envelope.headers).toBeUndefined();
  });

  it('Α3 — ό,τι ΔΕΝ είναι ειδοποίηση φεύγει όπως έφευγε: μόνο θέμα + κείμενο', () => {
    const envelope = soloEnvelope(
      pending({ category: 'marketing', content: 'Το δικό του σώμα' }),
      LINKS,
    );
    expect(envelope).toEqual({ subject: 'Νέα αγγελία ταιριάζει στη ζήτησή σας — ΝΕΣΤΩΡ', text: 'Το δικό του σώμα' });
  });
});

describe('Β — κεφαλίδες: και οι δύο, ή καμία', () => {
  it('Β1 — χωρίς παραλήπτη ή χωρίς token ⇒ καμία κεφαλίδα', () => {
    expect(subscriptionHeaders(undefined, LINKS)).toBeUndefined();
    expect(subscriptionHeaders('u1', { ...LINKS, oneClickUnsubscribe: () => null })).toBeUndefined();
  });

  it('Β2 🔴 — σύνοψη με δύο λογαριασμούς στην ίδια διεύθυνση ⇒ ΚΑΜΙΑ κεφαλίδα', () => {
    const plan = planEmailDelivery(
      [pending({ id: 'a' }), pending({ id: 'b', recipientId: 'u2' })],
      LINKS,
    );
    const digest = plan.find((entry) => entry.kind === 'digest');
    if (digest?.kind !== 'digest') throw new Error('Δεν σχηματίστηκε σύνοψη — η άγκυρα δεν κοίταξε τίποτα.');
    expect(digestHeaders(digest, LINKS)).toBeUndefined();
  });

  it('Β3 — σύνοψη ΕΝΟΣ ανθρώπου ⇒ κεφαλίδες του', () => {
    const plan = planEmailDelivery([pending({ id: 'a' }), pending({ id: 'b' })], LINKS);
    const digest = plan.find((entry) => entry.kind === 'digest');
    if (digest?.kind !== 'digest') throw new Error('Δεν σχηματίστηκε σύνοψη — η άγκυρα δεν κοίταξε τίποτα.');
    expect(digestHeaders(digest, LINKS)?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });
});

describe('📧 Γ — ADR-849: η εμβέλεια των συνδέσμων', () => {
  /** Σύνδεσμοι που **δείχνουν** την εμβέλεια — ώστε η άγκυρα να τη βλέπει στο URL. */
  const SCOPED: EmailLinks = {
    permalink: LINKS.permalink,
    preferences: (uid, scope) => `${ORIGIN}/email/preferences/tok-${uid}-${scopeField(scope)}`,
    oneClickUnsubscribe: (uid, scope) => `${ORIGIN}/api/notifications/email/subscription?t=tok-${uid}-${scopeField(scope)}`,
  };
  const MATCH = 'properties.demandListingMatch';

  it('Γ1 🔑 — μεμονωμένο email τύπου: one-click ΜΟΝΟ του τύπου + «Να μη λαμβάνω τέτοια email»', () => {
    const envelope = soloEnvelope(pending({ eventType: MATCH }), SCOPED);
    expect(envelope.headers?.['List-Unsubscribe']).toBe(`<${ORIGIN}/api/notifications/email/subscription?t=tok-u1-${MATCH}>`);
    expect(envelope.html).toContain(`${ORIGIN}/email/preferences/tok-u1-${MATCH}`);
    expect(envelope.html).toContain('Να μη λαμβάνω τέτοια email');
  });

  it('Γ2 — χωρίς τύπο (έγγραφο πριν το ADR-849) ⇒ «όλα», ακριβώς όπως πριν', () => {
    const envelope = soloEnvelope(pending(), SCOPED);
    expect(envelope.headers?.['List-Unsubscribe']).toBe(`<${ORIGIN}/api/notifications/email/subscription?t=tok-u1-all>`);
    expect(envelope.html).toContain('Διαχείριση ειδοποιήσεων email');
  });

  it('Γ3 🔑 — σύνοψη: one-click «όλα», αλλά η σελίδα ανοίγει με ΤΟΥΣ ΤΥΠΟΥΣ της σύνοψης μπροστά', () => {
    const plan = planEmailDelivery(
      [pending({ id: 'a', eventType: MATCH }), pending({ id: 'b', eventType: 'properties.mandateDecided' })],
      SCOPED,
    );
    const digest = plan.find((entry) => entry.kind === 'digest');
    if (digest?.kind !== 'digest') throw new Error('Δεν σχηματίστηκε σύνοψη — η άγκυρα δεν κοίταξε τίποτα.');
    expect(digestHeaders(digest, SCOPED)?.['List-Unsubscribe']).toContain('tok-u1-all');
    expect(digest.html).toContain(`tok-u1-${MATCH},properties.mandateDecided`);
  });
});
