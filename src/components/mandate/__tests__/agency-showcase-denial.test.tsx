/**
 * @fileoverview **ADR-824 §8 Κ10 — Η ΑΡΝΗΣΗ ΦΤΑΝΕΙ ΟΛΟΚΛΗΡΗ ΣΤΟΝ ΑΝΘΡΩΠΟ.**
 * @related ADR-824 §6 · ADR-827 §9.10 · lib/auth/brokerage-gate.ts · N.11 · CHECK 3.8
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ (2026-08-30)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `gateBrokerage` απαντούσε **403 με τρία πεδία** (`error` · `reason` ·
 * `capabilityStatus`), ο κριτής είχε **τρία γραμμένα κείμενα σε δύο γλώσσες**, και ο
 * `failureOf` έγραφε `return { kind: 'not-allowed' }` — **πετώντας και τα δύο**. Ο
 * ιδρυτής διάβαζε ένα γενικό *«δεν επιτρέπεται»* ενώ ο διακομιστής του είχε ήδη πει
 * **ποια** από τις τρεις καταστάσεις τον σταματά. Και οι τρεις έχουν **διαφορετική
 * θεραπεία**: `pending` ⇒ *περίμενε* · `revoked` ⇒ *διάβασε τον λόγο* · `unrequested`
 * ⇒ *δήλωσε*. Ένα κοινό μήνυμα στέλνει και τους τρεις στο ίδιο αδιέξοδο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Η ΑΓΚΥΡΑ ΠΕΡΝΑΕΙ ΑΠΟ ΤΟ `fetch` ΚΑΙ ΟΧΙ ΑΠΟ mock ΤΟΥ HOOK
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ελάττωμα ζούσε **ανάμεσα** στα δύο: στη μετάφραση σώματος → `ShowcaseFailure`.
 * Ένα `jest.mock('@/hooks/mandate/useAgencyShowcase')` θα παρέδιδε το `status`
 * **έτοιμο**, δηλαδή θα δοκίμαζε τη μισή διαδρομή και θα έμενε **πράσινο πάνω στο ίδιο
 * το ελάττωμα**. Εδώ μπαίνει **ωμό σώμα HTTP** και μετριέται **το κείμενο στην οθόνη**:
 * σύρμα → `failureOf` → στένεμα → ευρετηρίαση πίνακα → `t()`. Μετάλλαξη σε
 * **οποιοδήποτε** από τα σκαλιά κοκκινίζει.
 *
 * ⚠️ **ΚΑΜΙΑ άγκυρα εδώ δεν ζητά σκέτο όνομα συμβόλου** — μετρημένο μάθημα (§9.22 Π3):
 * άγκυρα που ζητούσε `'isValidGreekVat'` έμεινε **πράσινη** ενώ ο έλεγχος είχε
 * αφαιρεθεί, γιατί το όνομα **επιβιώνει στη γραμμή εισαγωγής**. Εδώ κρίνεται μόνο
 * **τι διαβάζει ο άνθρωπος**.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { AgencyShowcaseContent } from '../AgencyShowcaseContent';
import { SHOWCASE_KEYS } from '../agency-showcase-labels';
import { BROKERAGE_DENY_REASON_KEYS } from '@/lib/auth/brokerage-authority';
import { CAPABILITY_STATUSES, type CapabilityStatus } from '@/types/organization-capability';

// Το κλειδί επιστρέφεται **αυτούσιο**: η δοκιμή ρωτά «ποιο μήνυμα διάλεξε η οθόνη;»,
// όχι «πώς μεταφράστηκε» — η μετάφραση είναι δουλειά των locales και της CHECK 3.8.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { companyId: 'comp_test' } }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  useWorkspaceAlias: () => 'test-agency',
  // ⚠️ **Το `href` περνά ΑΥΤΟΥΣΙΟ** *(χωρίς το πρόθεμα χώρου, που το προσθέτει το
  //    πραγματικό σύνορο)*: έτσι η άγκυρα μπορεί να ρωτήσει **πού δείχνει** ο σύνδεσμος
  //    — που είναι ακριβώς η υπόσχεση του `denyReason.revoked`.
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

/**
 * ⚠️ **Η βιτρίνα απαντά «δεν δημοσιεύτηκε», όχι «φορτώνει».** Οθόνη κολλημένη στο
 * `loading` δεν θα άφηνε την άγκυρα να πυροδοτήσει καν τη διαδρομή που κρίνει.
 */
jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: {
    subscribeDoc: (
      _collection: string,
      _id: string,
      onDoc: (profile: unknown) => void,
    ): (() => void) => {
      onDoc(null);
      return () => undefined;
    },
  },
}));

/** Το 403 της πόρτας, **ακριβώς όπως το γράφει** ο `gateBrokerage`. */
function denialBody(status: CapabilityStatus): string {
  return JSON.stringify({
    error: 'BROKERAGE_NOT_ALLOWED',
    reason: `auth:brokerage.denyReason.${status}`,
    capabilityStatus: status,
  });
}

/**
 * ⚠️ **Στοιχειώδης απόκριση, ΟΧΙ `new Response(...)`** — και είναι μέτρηση, όχι γούστο:
 * το `Response` του jsdom **δεν** επιστρέφει σώμα από το `.json()` σε αυτό το
 * περιβάλλον, οπότε ο `failureOf` έπεφτε στο `catch` και **κάθε** περίπτωση απαντούσε
 * `'failed'` — δηλαδή η άγκυρα θα ήταν **κόκκινη για λάθος λόγο** και, χειρότερα, θα
 * έμενε κόκκινη ό,τι κι αν έκανε ο κώδικας που κρίνει.
 *
 * 🔑 Το σώμα μένει **συμβολοσειρά** και περνά από `JSON.parse`: ο πραγματικός γύρος
 * σειριοποίησης είναι μέρος του συμβολαίου που δοκιμάζεται.
 */
function answerWith(body: string): void {
  global.fetch = jest.fn(async () => ({
    ok: false,
    status: 403,
    json: async () => JSON.parse(body) as unknown,
  })) as unknown as typeof fetch;
}

/** Πατά «Δημοσίευση» και επιστρέφει **ό,τι διάβασε ο άνθρωπος**. */
async function publishAndReadAlert(): Promise<string> {
  render(<AgencyShowcaseContent />);
  fireEvent.click(screen.getByText(SHOWCASE_KEYS.publish));
  const alert = await waitFor(() => screen.getByRole('alert'));
  return alert.textContent ?? '';
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Κ10 — κάθε κατάσταση που αρνείται λέει ΤΟ ΔΙΚΟ ΤΗΣ γιατί', () => {
  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ 1: στον `failureOf`, γύρνα το `case 'BROKERAGE_NOT_ALLOWED'` σε
   *    `{ kind: 'not-allowed', status: null }` ⇒ κόκκινο (γενικό μήνυμα).
   * ⛔ ΜΕΤΑΛΛΑΞΗ 2: στο `FailureMessage`, γύρνα τον κλάδο σε
   *    `t(SHOWCASE_KEYS.notAllowed)` ⇒ κόκκινο.
   * ⛔ ΜΕΤΑΛΛΑΞΗ 3: σβήσε το `capabilityStatus` από το σώμα του `denialBody` ⇒ κόκκινο.
   */
  it.each(['unrequested', 'pending', 'revoked'] as const)(
    'το «%s» ζωγραφίζει ΤΟ ΔΙΚΟ ΤΟΥ κλειδί, όχι το γενικό',
    async (status) => {
      answerWith(denialBody(status));

      const alert = await publishAndReadAlert();

      // ⚠️ **`toContain` και όχι `toBe` από τις 2026-08-30 (ADR-824 §12.14)**: η άρνηση
      //    κουβαλά πλέον **και τον δρόμο** *(σύνδεσμος προς τις ρυθμίσεις μεσιτείας)*.
      //    Η χαλάρωση **πληρώνεται αμέσως** από τον αρνητικό έλεγχο από κάτω: το γενικό
      //    μήνυμα εξακολουθεί να **απαγορεύεται**, άρα η άγκυρα δεν έχασε δύναμη.
      expect(alert).toContain(BROKERAGE_DENY_REASON_KEYS[status]);
      expect(alert).not.toContain(SHOWCASE_KEYS.notAllowed);
    },
  );

  /**
   * 🔴 **Η ΥΠΟΣΧΕΣΗ ΤΟΥ ΚΕΙΜΕΝΟΥ ΟΔΗΓΕΙ ΟΝΤΩΣ ΚΑΠΟΥ** (ADR-824 §12.14).
   *
   * Το `denyReason.revoked` λέει *«δες τον λόγο **στις ρυθμίσεις του οργανισμού**»* —
   * και μέχρι σήμερα **δεν υπήρχε τέτοια σελίδα**, ούτε σύνδεσμος. Η άγκυρα ρωτά και
   * τα δύο: ότι ο δρόμος **προσφέρεται**, και ότι δείχνει **στη σωστή διεύθυνση**.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε τον `<Link>` από το `FailureMessage` ⇒ κόκκινο.
   * ⛔ ΜΕΤΑΛΛΑΞΗ: άλλαξε τη διαδρομή του συνδέσμου ⇒ κόκκινο.
   */
  it.each(['unrequested', 'pending', 'revoked'] as const)(
    'το «%s» προσφέρει τον ΔΡΟΜΟ προς τις ρυθμίσεις μεσιτείας',
    async (status) => {
      answerWith(denialBody(status));
      await publishAndReadAlert();

      const link = screen.getByRole('link');
      // ✅ ΘΕΤΙΚΟΣ ΣΥΝΟΔΟΣ: ο σύνδεσμος **υπάρχει και έχει κείμενο**…
      expect(link.textContent).not.toBe('');
      // …και δείχνει **εκεί που υπόσχεται το κείμενο του κριτή**.
      expect(link.getAttribute('href')).toBe('/settings/brokerage');
    },
  );

  /**
   * 🔑 **Η ΔΙΑΚΡΙΤΟΤΗΤΑ ΕΙΝΑΙ ΤΟ ΖΗΤΟΥΜΕΝΟ, ΟΧΙ Η ΥΠΑΡΞΗ ΚΕΙΜΕΝΟΥ.** Τρία κλειδιά που
   * δείχνουν στο **ίδιο** μήνυμα θα περνούσαν κάθε έλεγχο «υπάρχει κείμενο;» — και θα
   * ήταν **ακριβώς το ελάττωμα** που διορθώθηκε. Ίδιο ιδίωμα με το `Set(reasons).size`
   * της άγκυρας Κ3 στον κριτή.
   */
  it('και τα τρία μηνύματα είναι ΔΙΑΦΟΡΕΤΙΚΑ μεταξύ τους', () => {
    const keys = (['unrequested', 'pending', 'revoked'] as const).map(
      (status) => BROKERAGE_DENY_REASON_KEYS[status],
    );

    expect(new Set(keys).size).toBe(3);
    expect(keys).not.toContain(SHOWCASE_KEYS.notAllowed);
  });

  /**
   * 🔴 **Ο ΠΙΝΑΚΑΣ ΚΑΛΥΠΤΕΙ ΚΑΘΕ ΚΑΤΑΣΤΑΣΗ ΠΟΥ ΑΡΝΕΙΤΑΙ — ΚΑΙ ΜΟΝΟ ΑΥΤΕΣ.**
   *
   * Ο μεταγλωττιστής το φυλά ήδη μέσω `Record<Exclude<CapabilityStatus, 'active'>, …>`,
   * αλλά **μόνο για τον κώδικα που γράφτηκε**. Αυτή η άγκυρα το φυλά για το **σύνολο**:
   * πέμπτη κατάσταση στο `CAPABILITY_STATUSES` κοκκινίζει **εδώ**, ακόμη κι αν κανείς
   * δεν την ευρετηρίασε ακόμη πουθενά.
   */
  it('καμία κατάσταση που αρνείται δεν μένει χωρίς κείμενο', () => {
    const denying = CAPABILITY_STATUSES.filter((status) => status !== 'active');

    expect(denying).toHaveLength(3);
    for (const status of denying) {
      expect(BROKERAGE_DENY_REASON_KEYS[status]).toMatch(/^auth:brokerage\.denyReason\./);
    }
    expect(Object.keys(BROKERAGE_DENY_REASON_KEYS)).toHaveLength(denying.length);
  });
});

describe('Κ10β — ό,τι ΔΕΝ ονομάζει κατάσταση πέφτει στο γενικό, ποτέ σε εικασία', () => {
  /**
   * 🔑 *Άγνωστο ≠ κενό.* Παλιότερος διακομιστής που δεν στέλνει ακόμη το πεδίο **δεν**
   * επιτρέπεται να διαβαστεί ως «δεν δήλωσε ποτέ»: θα έστελνε γραφείο με **εκκρεμή**
   * δήλωση να την ξανακαταθέσει.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε το `status` να πέφτει σε `'unrequested'` αντί για `null` ⇒ κόκκινο.
   */
  it('σώμα ΧΩΡΙΣ capabilityStatus ⇒ γενικό μήνυμα', async () => {
    answerWith(JSON.stringify({ error: 'BROKERAGE_NOT_ALLOWED' }));

    expect(await publishAndReadAlert()).toBe(SHOWCASE_KEYS.notAllowed);
  });

  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: αφαίρεσε τον `isCapabilityStatus` και πέρασε την ωμή τιμή ⇒ η οθόνη
   *    ζωγραφίζει `undefined` αντί για το γενικό ⇒ κόκκινο.
   */
  it('τιμή ΕΚΤΟΣ του κλειστού συνόλου ⇒ γενικό μήνυμα, όχι ωμό κλειδί', async () => {
    answerWith(JSON.stringify({ error: 'BROKERAGE_NOT_ALLOWED', capabilityStatus: 'OTINANAI' }));

    expect(await publishAndReadAlert()).toBe(SHOWCASE_KEYS.notAllowed);
  });

  /**
   * ⚠️ Το `active` **δεν αρνείται ποτέ**, άρα δεν έχει τι να εξηγήσει. Αν ποτέ φτάσει
   * εδώ, η οθόνη οφείλει να μιλήσει γενικά — **όχι** να ζωγραφίσει κενό ή `undefined`.
   */
  it('«active» σε άρνηση ⇒ γενικό μήνυμα, ποτέ κενό', async () => {
    answerWith(denialBody('active'));

    expect(await publishAndReadAlert()).toBe(SHOWCASE_KEYS.notAllowed);
  });
});
