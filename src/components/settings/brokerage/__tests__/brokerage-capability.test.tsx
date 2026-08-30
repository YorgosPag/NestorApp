/**
 * @fileoverview **ADR-824 §8 Κ13 — Η ΟΘΟΝΗ ΤΟΥ ΙΔΡΥΤΗ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ, ΚΑΙ ΤΗΝ ΠΡΑΞΗ.**
 * @related ADR-824 §12.14 · components/settings/brokerage/BrokerageCapabilityContent.tsx
 *
 * ⛔ **ΔΕΝ δοκιμάζει ασφάλεια.** Ο φρουρός είναι ο τύπος `BrokerageAuthority` στον
 * διακομιστή· εδώ κρίνεται **ειλικρίνεια της οθόνης** και **εκπλήρωση της υπόσχεσης**.
 *
 * 🔴 **ΔΙΑΒΑΖΕΙ ΑΠΟΔΟΣΗ ΚΑΙ ΚΛΗΣΗ, ΠΟΤΕ ΥΠΑΡΞΗ IMPORT** *(μάθημα Κ5/Κ7)*: αποδίδεται
 * το δέντρο και ελέγχεται **τι βλέπει ο άνθρωπος** και **τι έφυγε στο σύρμα**.
 *
 * 🔑 **Ο ΑΡΝΗΤΙΚΟΣ ΙΣΧΥΡΙΣΜΟΣ ΕΧΕΙ ΠΑΝΤΑ ΘΕΤΙΚΟ ΣΥΝΟΔΟ** *(μάθημα Κ12γ: ένα
 * `not.toContain` ήταν **κενά πράσινο** επειδή τίποτα δεν είχε έρθει)*. Κάθε
 * `queryBy…===null` εδώ συνοδεύεται από ισχυρισμό ότι η οθόνη **απέδωσε κάτι** —
 * αλλιώς μια οθόνη που κρασάρει σιωπηλά θα περνούσε κάθε άρνηση.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { BrokerageCapabilityContent } from '../BrokerageCapabilityContent';
import {
  BROKERAGE_CAPABILITY_KEYS,
  BROKERAGE_REQUIREMENT_KEYS,
  BROKERAGE_REQUIREMENT_FALLBACK,
  BROKERAGE_STATUS_HEADLINE_KEYS,
} from '../brokerage-capability-labels';
import {
  CAPABILITY_STATUSES,
  canDeclareCapability,
  type CapabilityDisclosure,
  type CapabilityStatus,
} from '@/types/organization-capability';

const capabilities = jest.fn<
  { disclosures: Record<string, CapabilityDisclosure | null>; settled: boolean },
  unknown[]
>();

jest.mock('@/services/realtime/hooks/useOrganizationCapability', () => ({
  useMyOrganizationCapabilities: () => capabilities(),
}));

// Το κλειδί επιστρέφεται **αυτούσιο**: η δοκιμή ρωτά «ποιο μήνυμα διάλεξε η οθόνη;»,
// όχι «πώς μεταφράστηκε» — η μετάφραση είναι δουλειά των locales (ομάδα Μ αλλού).
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// 🧩 Το route slice είναι **παραγόμενο**: η δοκιμή δεν το χρειάζεται και δεν επιτρέπεται
//    να εξαρτάται από τη φρεσκάδα του.
jest.mock('@/i18n/generated/routes/o__workspace__settings__brokerage.el.json', () => ({}), {
  virtual: true,
});
jest.mock('@/i18n/route-slice', () => ({ registerRouteSlice: jest.fn() }));

function disclosureOf(overrides: Partial<CapabilityDisclosure> = {}): CapabilityDisclosure {
  return {
    status: 'pending',
    requirements: [],
    declaration: null,
    decidedAt: null,
    revocationReason: null,
    ...overrides,
  };
}

function renderWith(
  disclosure: CapabilityDisclosure | null,
  settled = true,
): void {
  capabilities.mockReturnValue({
    disclosures: { brokerage_listings: disclosure },
    settled,
  });
  render(<BrokerageCapabilityContent />);
}

/** Η ρυθμιζόμενη προσφορά, όπως τη βλέπει ο άνθρωπος. */
function offersForm(): boolean {
  return screen.queryByTestId('brokerage-declaration-form') !== null;
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ status: 'pending' }),
  }) as unknown as typeof fetch;
});

describe('Κ13α — τέσσερις καταστάσεις, τέσσερα ΔΙΑΦΟΡΕΤΙΚΑ κείμενα', () => {
  /**
   * 🔴 `revoked` ≠ `unrequested` **επίτηδες** (ADR-824 §5.2). Ένα κοινό μήνυμα στέλνει
   * *«δεν ζήτησε ποτέ»* και *«του το πήραμε»* στο ίδιο αδιέξοδο.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα δύο κλειδιά του `BROKERAGE_STATUS_HEADLINE_KEYS` στο ίδιο ⇒ κόκκινο.
   */
  it.each(CAPABILITY_STATUSES.map((status) => [status] as const))(
    'σε %s η οθόνη διαλέγει το ΔΙΚΟ της κλειδί επικεφαλίδας',
    (status: CapabilityStatus) => {
      renderWith(disclosureOf({ status }));

      // ✅ ΘΕΤΙΚΟΣ ΣΥΝΟΔΟΣ: η οθόνη **απέδωσε** κάτι αναγνωρίσιμο πριν συγκρίνουμε.
      expect(screen.getByTestId('brokerage-status-headline').textContent).toBe(
        BROKERAGE_STATUS_HEADLINE_KEYS[status],
      );
    },
  );

  /**
   * 🔴 **Η ΔΙΑΚΡΙΤΟΤΗΤΑ ΕΙΝΑΙ Ο ΙΣΧΥΡΙΣΜΟΣ, ΚΑΙ ΔΕΝ ΤΗΝ ΠΙΑΝΕΙ Ο ΕΛΕΓΧΟΣ ΑΠΟ ΠΑΝΩ.**
   * Ένας πίνακας με **δύο ίδια** κλειδιά περνά κάθε γραμμή του `it.each` — η οθόνη
   * «διάλεξε το δικό της», απλώς τα δικά τους ήταν το ίδιο. Το `revoked` θα διάβαζε
   * ό,τι και το `unrequested`, δηλαδή θα χανόταν ολόκληρη η διάκριση του §5.2.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα δύο κλειδιά του πίνακα στο ίδιο ⇒ κόκκινο **μόνο εδώ**.
   */
  it('τα τέσσερα κλειδιά είναι ΤΕΣΣΕΡΑ, όχι λιγότερα', () => {
    const keys = CAPABILITY_STATUSES.map((status) => BROKERAGE_STATUS_HEADLINE_KEYS[status]);

    expect(keys).toHaveLength(4);
    expect(new Set(keys).size).toBe(4);
  });
});

describe('Κ13β — όσο δεν ξέρω, ΚΑΜΙΑ κατάσταση', () => {
  /**
   * 🔴 **Μετρημένη ζωντανή βλάβη (2026-08-28)**: εγκεκριμένο γραφείο διάβαζε *«δεν έχεις
   * δηλώσει»* για ~1,5 δευτερόλεπτο σε **κάθε** φόρτωση, επειδή το `companyId` φτάνει
   * αργότερα από την πρώτη απόδοση. Ίδιο ελάττωμα με το Κ7β, μία οθόνη πιο πέρα.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε τον κλάδο `if (!settled)` ⇒ κόκκινο.
   */
  it('με settled=false δείχνει «φορτώνει» και ΚΑΜΙΑ κατάσταση', () => {
    renderWith(null, false);

    // ✅ ΘΕΤΙΚΟΣ ΣΥΝΟΔΟΣ πριν από κάθε άρνηση: η οθόνη **μίλησε**, απλώς είπε «φορτώνει».
    expect(screen.getByText(BROKERAGE_CAPABILITY_KEYS.loading)).not.toBeNull();
    expect(screen.queryByTestId('brokerage-status')).toBeNull();
    expect(offersForm()).toBe(false);
  });

  /**
   * Ο **παρονομαστής**: μόλις μάθει, μιλά. Χωρίς αυτόν, ένα `settled` που έμενε πάντα
   * `false` θα περνούσε τον έλεγχο από πάνω και η οθόνη **δεν θα άνοιγε ποτέ**.
   */
  it('με settled=true σταματά να λέει «φορτώνει» και δείχνει κατάσταση', () => {
    renderWith(null);

    expect(screen.queryByText(BROKERAGE_CAPABILITY_KEYS.loading)).toBeNull();
    expect(screen.getByTestId('brokerage-status')).not.toBeNull();
  });
});

describe('Κ13γ — η φόρμα ζωγραφίζεται ΜΟΝΟ όπου ο γραφέας δέχεται δήλωση', () => {
  /**
   * 🔑 **Δεν είναι δεύτερο βιβλίο**: η οθόνη ρωτά τον {@link canDeclareCapability}, και
   * το Κ13ζ παρακάτω **εκτελεί τον πραγματικό γραφέα** για να αποδείξει ότι συμφωνούν.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε τη φόρμα να αποδίδεται πάντα *(σβήσε τον φρουρό)* ⇒ κόκκινο στο
   *    `pending`/`active`. Κάνε την να μην αποδίδεται ποτέ ⇒ κόκκινο στα άλλα δύο.
   */
  it.each(CAPABILITY_STATUSES.map((status) => [status] as const))(
    'σε %s η φόρμα ακολουθεί τον κανόνα της μετάβασης',
    (status: CapabilityStatus) => {
      renderWith(disclosureOf({ status }));

      // ✅ ΘΕΤΙΚΟΣ ΣΥΝΟΔΟΣ: η οθόνη απέδωσε — η άρνηση παρακάτω αφορά τη φόρμα, όχι κενό.
      expect(screen.getByTestId('brokerage-status-name')).not.toBeNull();
      expect(offersForm()).toBe(canDeclareCapability(status));
    },
  );

  /** Το `pending` **δεν** προσφέρει δεύτερη δήλωση — θα έσβηνε την πρώτη. */
  it('σε pending ΔΕΝ υπάρχει φόρμα', () => {
    renderWith(disclosureOf({ status: 'pending' }));

    expect(screen.getByTestId('brokerage-status-name')).not.toBeNull();
    expect(offersForm()).toBe(false);
  });
});

describe('Κ13δ — σε revoked φτάνει Ο ΛΟΓΟΣ, όχι γενικό κείμενο', () => {
  /**
   * ⚖️ **Κανονισμός (ΕΕ) 2019/1150, άρθρο 4** — *statement of reasons* σε **durable
   * medium**, και *opportunity to clarify*. Ο λόγος είναι **ελεύθερο κείμενο
   * διαχειριστή**: ζωγραφίζεται αυτούσιος, ποτέ μέσα από `t()`.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε την οθόνη να αγνοεί το `revocationReason` ⇒ κόκκινο.
   */
  it('δείχνει τον γραπτό λόγο και την ημερομηνία της απόφασης', () => {
    renderWith(
      disclosureOf({
        status: 'revoked',
        revocationReason: 'Έληξε η εγγραφή στο Επιμελητήριο.',
        decidedAt: '2026-08-20T10:00:00.000Z',
      }),
    );

    const panel = screen.getByTestId('brokerage-revocation');
    expect(panel.textContent).toContain('Έληξε η εγγραφή στο Επιμελητήριο.');
    expect(panel.textContent).toContain(BROKERAGE_CAPABILITY_KEYS.decidedAt);
  });

  /**
   * 🔴 **Ανάκληση χωρίς λόγο ΔΕΝ σιωπά.** Είναι ακριβώς η κατάσταση που το άρθρο 4
   * απαγορεύει — η οθόνη τη **δηλώνει** αντί να δείξει κενό πλαίσιο.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: άσε το κενό `revocationReason` να ζωγραφίζεται ως κενό ⇒ κόκκινο.
   */
  it('με λόγο κενό δηλώνει την απουσία, δεν δείχνει κενό', () => {
    renderWith(disclosureOf({ status: 'revoked', revocationReason: '   ' }));

    const panel = screen.getByTestId('brokerage-revocation');
    expect(panel.textContent).toContain(BROKERAGE_CAPABILITY_KEYS.revocationMissing);
  });

  /**
   * Ο **παρονομαστής**: το πλαίσιο ανάκλησης **δεν** εμφανίζεται όταν δεν υπάρχει
   * ανάκληση. Χωρίς αυτόν, μια οθόνη που το δείχνει πάντα θα περνούσε τα δύο από πάνω.
   */
  it('σε pending ΔΕΝ υπάρχει πλαίσιο ανάκλησης', () => {
    renderWith(disclosureOf({ status: 'pending', revocationReason: 'δεν πρέπει να φανεί' }));

    expect(screen.getByTestId('brokerage-status-name')).not.toBeNull();
    expect(screen.queryByTestId('brokerage-revocation')).toBeNull();
  });
});

describe('Κ13ε — «τι εκκρεμεί»: ό,τι ονομάζει ο διακομιστής, ΠΟΤΕ ωμό κλειδί', () => {
  const KNOWN = Object.keys(BROKERAGE_REQUIREMENT_KEYS)[0] as string;

  /**
   * 🔑 Πρότυπο `requirements.currently_due` της Stripe: ο διακομιστής ονομάζει τι λείπει.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε το `<Requirements/>` από την οθόνη ⇒ κόκκινο.
   */
  it('αναγνωρισμένη απαίτηση αποδίδεται με το κλειδί της', () => {
    renderWith(disclosureOf({ status: 'pending', requirements: [{ key: KNOWN }] }));

    const list = screen.getByTestId('brokerage-requirements');
    expect(list.textContent).toContain(BROKERAGE_REQUIREMENT_KEYS[KNOWN]);
  });

  /**
   * 🔴 **Η ΓΡΑΜΜΗ ΠΟΥ ΜΑΣ ΞΕΧΩΡΙΖΕΙ ΑΠΟ ΤΟ ΠΡΟΤΥΠΟ.** Η Stripe στέλνει ελεύθερες
   * συμβολοσειρές· ένας πελάτης που συναντά άγνωστη απαίτηση δείχνει **σιωπή ή
   * σκουπίδι**. Εδώ δείχνει **μεταφρασμένη πρόταση**, και **ποτέ το ίδιο το κλειδί**.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα το `isRecognizedRequirement` σε `() => true` ⇒ κόκκινο
   *    *(θα ζωγραφίσει το ωμό κλειδί)*.
   */
  it('ΑΓΝΩΣΤΗ απαίτηση πέφτει στο γενικό — και το ωμό κλειδί ΔΕΝ φτάνει στην οθόνη', () => {
    const alien = 'auth:brokerage.requirement.δεν-υπάρχει';
    renderWith(disclosureOf({ status: 'pending', requirements: [{ key: alien }] }));

    const list = screen.getByTestId('brokerage-requirements');
    // ✅ ΘΕΤΙΚΟΣ ΣΥΝΟΔΟΣ: κοίταξε **κάτι** — ο κατάλογος έχει περιεχόμενο…
    expect(list.textContent).toContain(BROKERAGE_REQUIREMENT_FALLBACK.unknown);
    // …και **μόνο τότε** έχει νόημα να πούμε τι ΔΕΝ έχει.
    expect(list.textContent).not.toContain(alien);
  });

  /** Ο **παρονομαστής**: κενή λίστα ⇒ κανένας τίτλος «Τι εκκρεμεί» πάνω από το τίποτα. */
  it('χωρίς απαιτήσεις δεν αποδίδεται ο κατάλογος', () => {
    renderWith(disclosureOf({ status: 'active', requirements: [] }));

    expect(screen.getByTestId('brokerage-status-name')).not.toBeNull();
    expect(screen.queryByTestId('brokerage-requirements')).toBeNull();
  });
});

describe('Κ13στ — η φόρμα ΚΑΛΕΙ την πόρτα, με ΚΑΙ ΤΑ ΤΡΙΑ πεδία', () => {
  /**
   * 🔴 **Ελέγχει την ΚΛΗΣΗ, όχι την ύπαρξη του hook** *(άγκυρα που ζητά σκέτο όνομα
   * συνάρτησης έχει **μετρηθεί** ότι μένει πράσινη ενώ ο έλεγχος έχει αφαιρεθεί)*.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε ένα πεδίο από το σώμα του αιτήματος ⇒ κόκκινο.
   * ⛔ ΜΕΤΑΛΛΑΞΗ: άλλαξε τη διεύθυνση της πόρτας ⇒ κόκκινο.
   */
  it('στέλνει gemiNumber + chamberRegistryNumber + legalRepresentativeName', async () => {
    renderWith(null);

    fireEvent.change(screen.getByLabelText(BROKERAGE_CAPABILITY_KEYS.gemiLabel), {
      target: { value: '123456789000' },
    });
    fireEvent.change(screen.getByLabelText(BROKERAGE_CAPABILITY_KEYS.chamberLabel), {
      target: { value: '12345' },
    });
    fireEvent.change(screen.getByLabelText(BROKERAGE_CAPABILITY_KEYS.representativeLabel), {
      target: { value: 'Γιώργος Παγώνης' },
    });
    fireEvent.submit(screen.getByTestId('brokerage-declaration-form'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/companies/capabilities/brokerage');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      gemiNumber: '123456789000',
      chamberRegistryNumber: '12345',
      legalRepresentativeName: 'Γιώργος Παγώνης',
    });
  });

  /**
   * 🔑 **Ημιτελής φόρμα ΔΕΝ ταξιδεύει.** Ο κριτής μένει ο διακομιστής· αυτό είναι
   * ευγένεια — να μην πάρει ο άνθρωπος 422 για κάτι που φαίνεται από εδώ.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε τον έλεγχο `complete` ⇒ κόκκινο.
   */
  it('με ελλιπή στοιχεία ΔΕΝ καλεί την πόρτα', async () => {
    renderWith(null);

    fireEvent.change(screen.getByLabelText(BROKERAGE_CAPABILITY_KEYS.gemiLabel), {
      target: { value: '123456789000' },
    });
    fireEvent.submit(screen.getByTestId('brokerage-declaration-form'));

    // ✅ ΘΕΤΙΚΟΣ ΣΥΝΟΔΟΣ: η φόρμα **υπάρχει και δέχτηκε είσοδο** — άρα η απουσία
    //    κλήσης είναι απόφαση, όχι οθόνη που δεν αποδόθηκε ποτέ.
    expect(screen.getByTestId('brokerage-declaration-form')).not.toBeNull();
    expect((screen.getByLabelText(BROKERAGE_CAPABILITY_KEYS.gemiLabel) as HTMLInputElement).value)
      .toBe('123456789000');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
