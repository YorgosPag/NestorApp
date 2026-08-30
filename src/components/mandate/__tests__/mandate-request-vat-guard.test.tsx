/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΦΡΟΥΡΟΥ ΤΟΥ ΑΦΜ** — «το κενό το μαθαίνει αυτός που μπορεί να το λύσει».
 * @related ADR-827 §9.21 ι #1 · §9.20 β · lib/forms/draft-identity.ts · hooks/account/useInFlowTaxIdentity.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΚΛΕΙΔΩΝΕΙ, ΚΑΙ ΓΙΑΤΙ ΤΟ ΚΑΘΕΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Κ** — ο κριτής: δύο σχήματα *(λίστα · κατηγόρημα)*, **μία** απάντηση.
 * **Χ** — ο χαρτογράφος λόγου→κλειδιού· το `Χ3` είναι η άγκυρα του **ωμού κωδικού
 *         στην οθόνη** — ο παλιός ισχυρισμός `as keyof typeof …` επέστρεφε
 *         `undefined` για το `'write-failed'`, που **δεν ανήκει** στην ένωση.
 * **Λ** — η συγχώνευση στη λίστα της φόρμας. Το `Λ1` έχει **ΠΑΡΟΝΟΜΑΣΤΗ** (`Λ0`):
 *         χωρίς αυτόν, το «είναι incomplete» θα μπορούσε να είναι πράσινο επειδή
 *         το fixture ήταν άκυρο για **άλλο** λόγο.
 * **Ρ** — 🔴 **ΣΥΜΠΕΡΙΦΟΡΑ ΤΗΣ ΠΟΛΙΤΙΚΗΣ**, όχι κείμενο: το κενό **δεν** είναι
 *         ανάκληση μέσα στη ροή, και ο ίδιος αριθμός **δεν** ξαναγράφεται.
 * **Ε** — τα κείμενα υπάρχουν σε **ΔΥΟ** γλώσσες. Εμπόδιο χωρίς κείμενο είναι
 *         ωμό κλειδί στην οθόνη ενός ανθρώπου που δεν ξέρει τι να αλλάξει.
 * **Π** — η **ΡΑΦΗ**: ότι η φόρμα καλεί όντως τους SSoT, και —το σημαντικότερο—
 *         ότι το **δίχτυ του Σ3 ΕΠΙΒΙΩΣΕ**. Ένας φρουρός που «μετακόμισε» και
 *         πήρε μαζί του την άμυνα θα ήταν **οπισθοδρόμηση**, όχι βελτίωση.
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: το `Π` κρίνει **πηγή**, όχι απόδοση — το
 * `MandateRequestFormContent` σέρνει `useAuth`, δρομολογητή, ζωντανό Firestore hook
 * και route slice, και δεν αποδίδεται φθηνά. Κλειδώνει τη **ραφή**· τη **λογική**
 * την κλειδώνουν τα `Κ`/`Λ`/`Ρ`. Δεν ισχυρίζεται περισσότερα.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { renderHook, act } from '@testing-library/react';

import {
  taxIdentityBlockers,
  hasTaxIdentity,
  TAX_IDENTITY_BLOCKERS,
} from '@/lib/forms/draft-identity';
import { withExtraBlockers, type DraftFormValidation } from '@/lib/forms/draft-validation';
import { vatIssueKey, VAT_FIELD_KEYS, VAT_REJECTION_KEYS } from '@/components/account/tax-identity-labels';
import { TEXT_KEYS, type MandateRequestBlocker } from '@/components/mandate/mandate-request-form-labels';
import { useInFlowTaxIdentity } from '@/hooks/account/useInFlowTaxIdentity';

import elMarket from '@/i18n/locales/el/property-market.json';
import enMarket from '@/i18n/locales/en/property-market.json';

// ── Ο μοναδικός γραφέας, υπό παρακολούθηση ────────────────────────────────────
const updateVatNumber = jest.fn<Promise<string | null>, [string]>();
let currentVat: string | null = null;

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ vatNumber: currentVat, updateVatNumber }),
}));

beforeEach(() => {
  updateVatNumber.mockReset();
  updateVatNumber.mockResolvedValue(null);
  currentVat = null;
});

function repoFile(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), 'utf8');
}

// =============================================================================
describe('Κ — ο κριτής της φορολογικής ταυτότητας', () => {
  it('Κ1 — καθόλου ΑΦΜ ⇒ εμπόδιο `tax-identity-required`', () => {
    expect(taxIdentityBlockers(null)).toEqual(['tax-identity-required']);
  });

  it('Κ2 — ΚΕΝΗ συμβολοσειρά μετράει ως απουσία (άκυρο στοιχείο σε σύμβαση)', () => {
    expect(taxIdentityBlockers('')).toEqual(['tax-identity-required']);
  });

  it('Κ3 — δηλωμένο ΑΦΜ ⇒ κανένα εμπόδιο', () => {
    expect(taxIdentityBlockers('094259216')).toEqual([]);
  });

  it('Κ4 — λίστα και κατηγόρημα ΔΕΝ μπορούν να αποκλίνουν', () => {
    for (const candidate of [null, '', ' ', '094259216', '000000000']) {
      expect(taxIdentityBlockers(candidate).length === 0).toBe(hasTaxIdentity(candidate));
    }
  });

  it('Κ5 — 🔴 ΞΕΧΩΡΙΣΤΟ λεξιλόγιο: δεν μολύνει τη φόρμα προσφοράς με νεκρό κλειδί', () => {
    // Αν κάποιος «απλοποιήσει» βάζοντας το εμπόδιο στο `DRAFT_IDENTITY_BLOCKERS`,
    // το `offer-form-labels.ts` θα απαιτούσε κλειδί για μήνυμα που **δεν δείχνει ποτέ**.
    const offerLabels = repoFile('src/components/owner-property/offer-form-labels.ts');
    // ⚠️ Βρόχος πάνω στο **κλειστό σύνολο**, ποτέ καρφωμένο πλήθος: μια τρίτη τιμή
    //    αύριο πρέπει να **κληρονομεί** τον έλεγχο, όχι να τον σπάει (μετρημένο
    //    2026-08-30, όταν το `tax-identity-unsaved` κοκκίνισε αυτή τη γραμμή).
    expect(TAX_IDENTITY_BLOCKERS.length).toBeGreaterThan(0);
    for (const code of TAX_IDENTITY_BLOCKERS) {
      expect(offerLabels).not.toContain(code);
    }
  });
});

// =============================================================================
describe('Χ — ο χαρτογράφος λόγου → κλειδιού', () => {
  it('Χ1 — καμία άρνηση ⇒ τίποτα να ειπωθεί', () => {
    expect(vatIssueKey(null)).toBeNull();
  });

  it('Χ2 — ονομαστική άρνηση ⇒ ΤΟ ΔΙΚΟ ΤΗΣ κλειδί, ποτέ το γενικό', () => {
    expect(vatIssueKey('vat-check-digit-invalid')).toBe(
      VAT_REJECTION_KEYS['vat-check-digit-invalid'],
    );
    expect(vatIssueKey('vat-format-invalid')).toBe(VAT_REJECTION_KEYS['vat-format-invalid']);
    expect(vatIssueKey('vat-check-digit-invalid')).not.toBe(VAT_FIELD_KEYS.saveError);
  });

  it('Χ3 — 🔴 `write-failed` ⇒ ΤΟ ΓΕΝΙΚΟ, ποτέ `undefined` (βλάβη ≠ άρνηση, N.12)', () => {
    expect(vatIssueKey('write-failed')).toBe(VAT_FIELD_KEYS.saveError);
  });

  it('Χ4 — άγνωστος λόγος ΔΕΝ φτάνει ωμός στην οθόνη', () => {
    const key = vatIssueKey('something-nobody-declared');
    expect(key).toBe(VAT_FIELD_KEYS.saveError);
    expect(key).not.toContain('something-nobody-declared');
  });
});

// =============================================================================
describe('Λ — το εμπόδιο μπαίνει στη ΜΙΑ λίστα της φόρμας', () => {
  const READY: DraftFormValidation<{ ok: true }, MandateRequestBlocker, never> = {
    kind: 'ready',
    draft: { ok: true },
  };

  it('Λ0 — ΠΑΡΟΝΟΜΑΣΤΗΣ: με δηλωμένο ΑΦΜ, η ίδια πλήρης φόρμα μένει `ready`', () => {
    const merged = withExtraBlockers(READY, taxIdentityBlockers('094259216'));
    expect(merged.kind).toBe('ready');
  });

  it('Λ1 — 🔴 χωρίς ΑΦΜ, η ΙΔΙΑ πλήρης φόρμα ΠΑΥΕΙ να είναι `ready`', () => {
    const merged = withExtraBlockers(READY, taxIdentityBlockers(null));
    expect(merged.kind).toBe('incomplete');
    if (merged.kind === 'incomplete') {
      expect(merged.blockers).toContain('tax-identity-required');
    }
  });

  it('Λ2 — τα εμπόδια της φόρμας μένουν ΟΡΑΤΑ δίπλα του (μία λίστα, ποτέ δύο)', () => {
    const incomplete: DraftFormValidation<{ ok: true }, MandateRequestBlocker, never> = {
      kind: 'incomplete',
      malformed: [],
      blockers: ['request-listing-unset'],
      violations: [],
    };
    const merged = withExtraBlockers(incomplete, taxIdentityBlockers(null));
    expect(merged.kind).toBe('incomplete');
    if (merged.kind === 'incomplete') {
      expect(merged.blockers).toEqual(['request-listing-unset', 'tax-identity-required']);
    }
  });
});

// =============================================================================
describe('Ρ — η πολιτική της ροής (ΣΥΜΠΕΡΙΦΟΡΑ, όχι κείμενο)', () => {
  it('Ρ1 — χωρίς ΑΦΜ, ο hook εκθέτει το εμπόδιο', () => {
    const { result } = renderHook(() => useInFlowTaxIdentity());
    expect(result.current.blockers).toEqual(['tax-identity-required']);
  });

  it('Ρ2 — ο αποθηκευμένος αριθμός γεμίζει το πεδίο (φτάνει ΜΕΤΑ την πρώτη απόδοση)', () => {
    currentVat = '094259216';
    const { result } = renderHook(() => useInFlowTaxIdentity());
    expect(result.current.value).toBe('094259216');
    expect(result.current.blockers).toEqual([]);
  });

  it('Ρ3 — 🔴 ΤΟ ΚΕΝΟ ΔΕΝ ΕΙΝΑΙ ΑΝΑΚΛΗΣΗ: καμία γραφή, και το πεδίο επανέρχεται', async () => {
    currentVat = '094259216';
    const { result } = renderHook(() => useInFlowTaxIdentity());

    await act(async () => {
      result.current.onChange('');
      result.current.onCommit('');
    });

    // Η ανάκληση είναι **πράξη**, και ζει στο προφίλ — όχι μέσα σε ροή ανάθεσης.
    expect(updateVatNumber).not.toHaveBeenCalled();
    expect(result.current.value).toBe('094259216');
  });

  it('Ρ4 — ΙΔΕΜΠΟΤΕΝΤ: ίδιος αριθμός ⇒ κανένα αίτημα δικτύου', async () => {
    currentVat = '094259216';
    const { result } = renderHook(() => useInFlowTaxIdentity());

    await act(async () => {
      result.current.onCommit('094259216');
    });

    expect(updateVatNumber).not.toHaveBeenCalled();
  });

  it('Ρ5 — νέος αριθμός ⇒ γράφεται ΜΙΑ φορά, από τον ΕΝΑ γραφέα', async () => {
    const { result } = renderHook(() => useInFlowTaxIdentity());

    await act(async () => {
      result.current.onCommit('094259216');
    });

    expect(updateVatNumber).toHaveBeenCalledTimes(1);
    expect(updateVatNumber).toHaveBeenCalledWith('094259216');
    expect(result.current.issueKey).toBeNull();
  });

  it('Ρ6 — 🔴 άρνηση του διακομιστή ⇒ ΟΝΟΜΑΣΤΙΚΗ οδηγία, όχι το γενικό σφάλμα', async () => {
    updateVatNumber.mockResolvedValue('vat-check-digit-invalid');
    const { result } = renderHook(() => useInFlowTaxIdentity());

    await act(async () => {
      result.current.onCommit('094259217');
    });

    expect(result.current.issueKey).toBe(VAT_REJECTION_KEYS['vat-check-digit-invalid']);
    expect(result.current.issueKey).not.toBe(VAT_FIELD_KEYS.saveError);
  });

  it('Ρ8 — 🔴🔴 ΤΟ ΕΥΡΗΜΑ ΤΗΣ ΖΩΝΤΑΝΗΣ ΕΠΑΛΗΘΕΥΣΗΣ: αποθηκευμένο ΕΓΚΥΡΟ + απορριφθέν στην οθόνη ⇒ Η ΦΟΡΜΑ ΔΕΝ ΦΕΥΓΕΙ', async () => {
    // Μετρημένο ζωντανά 2026-08-30: το κουμπί έμενε **ενεργό** και θα έστελνε τον
    // ΠΑΛΙΟ αριθμό ενώ το πεδίο έδειχνε τον απορριφθέντα. Καμία πύλη δεν το έπιανε.
    currentVat = '094259216';
    updateVatNumber.mockResolvedValue('vat-check-digit-invalid');
    const { result } = renderHook(() => useInFlowTaxIdentity());

    // Ο παρονομαστής: με αποθηκευμένο έγκυρο, καμία ένσταση ⇒ κανένα εμπόδιο.
    expect(result.current.blockers).toEqual([]);

    await act(async () => {
      result.current.onCommit('094014202');
    });

    expect(result.current.issueKey).not.toBeNull();
    // 🔑 ΟΝΟΜΑΣΤΙΚΑ «δεν σώθηκε», ΠΟΤΕ «λείπει» — ο άνθρωπος ΕΧΕΙ ΑΦΜ.
    expect(result.current.blockers).toEqual(['tax-identity-unsaved']);
    expect(result.current.blockers).not.toContain('tax-identity-required');
  });

  it('Ρ9 — το άδειασμα του πεδίου ΛΥΝΕΙ το ανοιχτό ζήτημα και επαναφέρει τον αποθηκευμένο', async () => {
    currentVat = '094259216';
    updateVatNumber.mockResolvedValue('vat-format-invalid');
    const { result } = renderHook(() => useInFlowTaxIdentity());

    await act(async () => {
      result.current.onCommit('123');
    });
    expect(result.current.blockers).toEqual(['tax-identity-unsaved']);

    // Η **δεύτερη** διαδρομή διαφυγής που υπόσχεται το κείμενο του εμποδίου.
    await act(async () => {
      result.current.onChange('');
      result.current.onCommit('');
    });

    expect(result.current.issueKey).toBeNull();
    expect(result.current.value).toBe('094259216');
    expect(result.current.blockers).toEqual([]);
  });

  it('Ρ7 — η επόμενη πληκτρολόγηση σβήνει ένσταση που αφορούσε ΑΛΛΟΝ αριθμό', async () => {
    updateVatNumber.mockResolvedValue('vat-format-invalid');
    const { result } = renderHook(() => useInFlowTaxIdentity());

    await act(async () => {
      result.current.onCommit('123');
    });
    expect(result.current.issueKey).not.toBeNull();

    act(() => {
      result.current.onChange('0942');
    });
    expect(result.current.issueKey).toBeNull();
  });
});

// =============================================================================
describe('Ε — το εμπόδιο ΕΧΕΙ κείμενο, και στις δύο γλώσσες', () => {
  it('Ε1 — ο πίνακας της φόρμας δείχνει το κλειδί', () => {
    expect(TEXT_KEYS['tax-identity-required']).toBe(
      'property-market:mandate.request.tax-identity-required',
    );
  });

  it('Ε2 — 🔴 το κλειδί ΛΥΝΕΤΑΙ σε ελληνικά ΚΑΙ αγγλικά (αλλιώς: ωμό κλειδί στην οθόνη)', () => {
    for (const [lang, bundle] of [['el', elMarket], ['en', enMarket]] as const) {
      const text = (bundle as { mandate: { request: Record<string, string> } }).mandate.request[
        'tax-identity-required'
      ];
      expect(typeof text === 'string' && text.length > 0).toBe(true);
      expect(text).not.toContain('tax-identity-required');
      // Η οδηγία οφείλει να κατονομάζει **τι** λείπει — αλλιώς δεν είναι οδηγία.
      expect(text.toLowerCase()).toMatch(lang === 'el' ? /αφμ/ : /tax id/);
    }
  });

  it('Ε3 — ΚΑΘΕ κωδικός του λεξιλογίου έχει κείμενο, σε ΚΑΙ ΤΙΣ ΔΥΟ γλώσσες', () => {
    // 🔑 Βρόχος πάνω στο **κλειστό σύνολο**, όχι χειρόγραφη λίστα: τέταρτος κωδικός
    //    αύριο κοκκινίζει **εδώ** αν ξεχάσει locale, χωρίς να το θυμηθεί κανείς.
    for (const code of TAX_IDENTITY_BLOCKERS) {
      for (const bundle of [elMarket, enMarket]) {
        const text = (bundle as { mandate: { request: Record<string, string> } }).mandate.request[
          code
        ];
        expect(typeof text === 'string' && text.length > 0).toBe(true);
        expect(text).not.toContain(code);
      }
      expect(TEXT_KEYS[code]).toBe(`property-market:mandate.request.${code}`);
    }
  });
});

// =============================================================================
describe('Π — η ραφή, και το δίχτυ που ΔΕΝ αφαιρέθηκε', () => {
  it('Π1 — η φόρμα του Σ1 ρωτά τους SSoT, δεν κρίνει μόνη της', () => {
    const form = repoFile('src/components/mandate/MandateRequestFormContent.tsx');
    expect(form).toContain('useInFlowTaxIdentity()');
    expect(form).toContain('withExtraBlockers<');
    expect(form).toContain('taxIdentity.blockers');
  });

  it('Π2 — 🔴 Η ΦΟΡΜΑ ΔΕΝ ΓΡΑΦΕΙ ΤΟ ΠΕΔΙΟ ΜΟΝΗ ΤΗΣ (server-owned στα rules)', () => {
    const form = repoFile('src/components/mandate/MandateRequestFormContent.tsx');
    expect(form).not.toContain('updateVatNumber');
    expect(form).not.toContain('setDoc');
  });

  it('Π3 — 🔴🔴 ΤΟ ΔΙΧΤΥ ΤΟΥ Σ3 ΕΠΙΒΙΩΣΕ: ο φρουρός μετακόμισε, η άμυνα ΕΜΕΙΝΕ', () => {
    const prepare = repoFile('src/services/mandate/mandate-acceptance-prepare.ts');
    // 🔴 **Η ΚΛΗΣΗ, ΟΧΙ ΤΟ ΟΝΟΜΑ** — μετρημένο 2026-08-29 με μετάλλαξη Μ8: η πρώτη
    //    γραφή αυτής της άγκυρας ζητούσε σκέτο `'isValidGreekVat'` και **έμεινε
    //    πράσινη** ενώ ο έλεγχος είχε αφαιρεθεί, γιατί το όνομα **επιβίωνε στη
    //    γραμμή εισαγωγής**. Άγκυρα που δείχνει σε `import` δεν φυλά τίποτα.
    expect(prepare).toContain('!isValidGreekVat(vatNumber)');
    expect(prepare).toContain("reason: 'identity-incomplete'");
  });

  it('Π5 — 🔴 και το δίχτυ ΕΚΤΕΛΕΙΤΑΙ κάπου: η συμπεριφορική άγκυρα υπάρχει ακόμη', () => {
    // ⚠️ Το `Π3` κρίνει **πηγή**. Αυτό εδώ φυλά τον **εκτελεστή**: το
    //    `mandate-decision.test.ts` τρέχει τον πραγματικό κριτή με `null` / `''` /
    //    σπασμένο ψηφίο ελέγχου. Χωρίς αυτόν τον έλεγχο, κάποιος θα μπορούσε να
    //    διαγράψει τη σουίτα και το `Π3` θα έμενε πράσινο — «κάλυψη σε νεκρό δίδυμο».
    const behavioural = repoFile('src/services/mandate/__tests__/mandate-decision.test.ts');
    expect(behavioural).toContain("reason: 'identity-incomplete'");
    expect(behavioural).toContain('ΧΩΡΙΣ ΑΦΜ');
  });

  it('Π4 — 🔴 ΚΑΝΕΝΑΣ ΔΕΥΤΕΡΟΣ ΕΠΙΚΥΡΩΤΗΣ: ο mod-11 ζει ΜΟΝΟ στη γραφή', () => {
    const judge = repoFile('src/lib/forms/draft-identity.ts');
    const hook = repoFile('src/hooks/account/useInFlowTaxIdentity.ts');
    const field = repoFile('src/components/account/TaxIdentityField.tsx');
    for (const source of [judge, hook, field]) {
      expect(source).not.toContain('isValidGreekVat');
      expect(source).not.toContain('isValidGreekVatCheckDigit');
    }
  });
});
