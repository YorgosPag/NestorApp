/**
 * Άγκυρα — **Ο ΧΩΡΟΣ-ΣΤΟΧΟΣ ΤΗΣ ΕΙΔΟΠΟΙΗΣΗΣ** (ADR-849 §6δ Β1)
 *
 * | # | ισχυρισμός | η μετάλλαξη που το σπάει |
 * |---|---|---|
 * | Α | ο προορισμός ταξιδεύει ΜΑΖΙ με τον χώρο | `viewDestination` χωρίς `workspace` |
 * | Β | ο αποθηκευμένος χώρος ΞΑΝΑΚΡΙΝΕΤΑΙ | δεκτός ιδιωτικός χώρος άλλου ⇒ άνοιγμα με ξένο αίτημα |
 * | Γ | το κουδούνι περνά από τον μόνιμο σύνδεσμο | ωμό `url` ⇒ ο χώρος του θεατή |
 */

import { drawerDestination } from '@/components/notifications/drawer-destination';
import {
  firstActionUrl,
  readDestinationWorkspace,
  viewDestination,
} from '@/lib/notifications/notification-destination';
import {
  notificationPermalinkHref,
  permalinkChannelOf,
} from '@/lib/notifications/notification-permalink-route';
import { APP_ROUTES } from '@/lib/routes/appRoutes';
import { orgWorkspace, personalWorkspace } from '@/types/workspace-membership';

describe('Α — ο προορισμός και ο χώρος του, ποτέ χωριστά', () => {
  it('Α1 — ένα κουμπί «Προβολή», σταθερή ετικέτα (όχι ελληνικό κείμενο, N.11), και ο χώρος', () => {
    expect(viewDestination('/properties/p1', orgWorkspace('comp_1'))).toEqual({
      actions: [{ id: 'view', label: 'view', url: '/properties/p1' }],
      workspace: { kind: 'org', companyId: 'comp_1' },
    });
  });

  it('Α2 — το `url` της πρώτης ενέργειας, ό,τι κι αν έγραψε η βάση', () => {
    expect(firstActionUrl([{ url: '/x' }, { url: '/y' }])).toBe('/x');
    expect(firstActionUrl('όχι πίνακας')).toBeUndefined();
    expect(firstActionUrl([null])).toBeUndefined();
  });
});

describe('🔴 Β — ο αποθηκευμένος χώρος ΞΑΝΑΚΡΙΝΕΤΑΙ (η βάση δεν είναι ο μεταγλωττιστής)', () => {
  it('Β1 — εταιρικός χώρος με ταυτότητα ⇒ δεκτός', () => {
    expect(readDestinationWorkspace({ kind: 'org', companyId: 'comp_1' }, 'u1')).toEqual(
      orgWorkspace('comp_1'),
    );
  });

  it('Β2 — ιδιωτικός χώρος ΤΟΥ ΠΑΡΑΛΗΠΤΗ ⇒ δεκτός', () => {
    expect(readDestinationWorkspace({ kind: 'personal', userId: 'u1' }, 'u1')).toEqual(
      personalWorkspace('u1'),
    );
  });

  it.each([
    ['ιδιωτικός χώρος ΑΛΛΟΥ', { kind: 'personal', userId: 'u2' }],
    ['εταιρεία χωρίς ταυτότητα', { kind: 'org', companyId: '' }],
    ['εταιρεία με ταυτότητα-αριθμό', { kind: 'org', companyId: 7 }],
    ['άγνωστο είδος', { kind: 'team', companyId: 'comp_1' }],
    ['το ΚΛΕΙΔΙ αντί για την ένωση', 'org:comp_1'],
    ['τίποτα', undefined],
    ['null', null],
  ])('Β3 🔴 — %s ⇒ null, ποτέ «κάπου»', (_label, value) => {
    expect(readDestinationWorkspace(value, 'u1')).toBeNull();
  });

  it('Β4 — κενός παραλήπτης δεν «ταιριάζει» με κενό ιδιωτικό χώρο', () => {
    expect(readDestinationWorkspace({ kind: 'personal', userId: '' }, '')).toBeNull();
  });
});

describe('🔴 Γ — το κουδούνι περνά από τον μόνιμο σύνδεσμο', () => {
  const base = { id: 'demand:u1:prop_1', source: { service: 'crm' }, title: 'x' };

  it('Γ1 🔑 — αποθηκευμένη εσωτερική διαδρομή ⇒ `/n/{id}?via=inapp`, ΠΟΤΕ η ωμή διαδρομή', () => {
    const destination = drawerDestination({ ...base, actions: [{ id: 'view', label: 'view', url: '/properties/prop_1' }] });
    expect(destination).toEqual({ kind: 'permalink', href: notificationPermalinkHref(base.id, 'inapp') });
    expect(destination?.href).toBe('/n/demand%3Au1%3Aprop_1?via=inapp');
  });

  it('Γ2 — εξωτερική διεύθυνση ⇒ νέα καρτέλα', () => {
    expect(drawerDestination({ ...base, actions: [{ id: 'v', label: 'v', url: 'https://x.example/a' }] })).toEqual({
      kind: 'external',
      href: 'https://x.example/a',
    });
  });

  it.each(['//evil.example/x', 'javascript:alert(1)', 'mailto:a@b'])(
    'Γ3 🔴 — %p ⇒ κανένα κουμπί (ούτε εσωτερική ούτε http[s])',
    (url) => {
      expect(drawerDestination({ ...base, actions: [{ id: 'v', label: 'v', url }] })).toBeNull();
    },
  );

  it('Γ4 — παλιό έγγραφο χωρίς `actions`: οι δύο ιστορικές ευρετικές, από το SSoT διαδρομών', () => {
    expect(drawerDestination({ ...base, source: { service: 'crm', feature: 'ai-inbox' } })).toEqual({
      kind: 'legacy',
      href: APP_ROUTES.aiInbox,
    });
    expect(drawerDestination({ ...base, title: 'New Message from X' })?.href).toBe(APP_ROUTES.aiInbox);
    expect(drawerDestination(base)).toBeNull();
  });
});

describe('Δ — το κανάλι του μόνιμου συνδέσμου', () => {
  it('Δ1 — το email ΔΕΝ γράφει παράμετρο: κάθε σταλμένο email μένει ίδιο', () => {
    expect(notificationPermalinkHref('a:b')).toBe('/n/a%3Ab');
  });

  it.each([
    ['inapp', 'inapp'],
    ['email', 'email'],
    [undefined, 'email'],
    ['sms', 'email'],
    [['inapp', 'x'], 'email'],
  ])('Δ2 — %p ⇒ %s (ό,τι άγνωστο είναι email)', (value, expected) => {
    expect(permalinkChannelOf(value)).toBe(expected);
  });
});
