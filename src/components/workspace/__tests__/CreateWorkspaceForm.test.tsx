/**
 * Άγκυρες της **οθόνης** του Κ-1 (ADR-787) — `CreateWorkspaceForm.tsx`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ — Η ΟΘΟΝΗ ΖΕΙ ΠΙΣΩ ΑΠΟ ΦΡΟΥΡΟ ΤΑΥΤΟΤΗΤΑΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η σελίδα `(me)/workspace/new` απαιτεί σύνδεση, οπότε **καμία ανώνυμη ανάκτηση
 * δεν τη ζωγραφίζει ποτέ** — μια `curl` επιστρέφει το κέλυφος και το «Έλεγχος
 * πρόσβασης…». Δηλαδή **το test είναι ο ΜΟΝΟΣ τρόπος** να αποδειχθεί ότι η φόρμα
 * αποδίδεται και ότι τα κλειδιά της υπάρχουν.
 *
 * ⚠️ **Τα κείμενα ελέγχονται από τα ΠΡΑΓΜΑΤΙΚΑ locale**, όχι από ψεύτικο `t`.
 * Ένα `t: (k) => k` θα έβγαινε πράσινο **ακριβώς όταν λείπει η μετάφραση** —
 * δηλαδή στην περίπτωση που το test υπάρχει για να πιάσει (σχήμα CHECK 3.51).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import el from '@/i18n/locales/el/onboarding.json';

/** Το ΠΡΑΓΜΑΤΙΚΟ ελληνικό locale — ο παρονομαστής των ισχυρισμών. */
const W = el.onboarding.workspace;

var submitCalls: Array<[string, string]> = [];
var mockState = {
  phase: 'editing' as string,
  errorCode: null as string | null,
  busy: false,
};

// ⚠️ Ο ΓΕΝΝΗΤΟΡΑΣ ΔΕΝ ΜΟΚΑΡΕΤΑΙ — ζει σε δικό του module (`alias-suggestion.ts`),
//    ακριβώς για να δοκιμάζεται ο ΠΡΑΓΜΑΤΙΚΟΣ. Ένα ψεύτικο `suggestAlias` θα
//    έκανε το Κ2 να δοκιμάζει τον εαυτό του.
jest.mock('../use-create-workspace', () => ({
  useCreateWorkspace: () => ({
    ...mockState,
    submit: async (name: string, alias: string) => { submitCalls.push([name, alias]); },
  }),
}));

jest.mock('@/i18n/route-slice', () => ({ registerRouteSlice: jest.fn() }));
jest.mock('@/i18n/generated/routes/workspace__new.el.json', () => ({}), { virtual: true });

jest.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const value = key.split('.').reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        { onboarding: { workspace: W } },
      );
      if (typeof value !== 'string') return key; // ⚠️ ωμό κλειδί ⇒ ο ισχυρισμός σκάει
      // ⚠️ **ICU, ΜΟΝΑ άγκιστρα** (`{min}`), όχι `{{min}}`: το repo τρέχει
      //    `i18next-icu` και το **CHECK 3.9** το επιβάλλει στα locale JSON. Η πρώτη
      //    γραφή αυτού του mock αντέγραφε τη σύνταξη του σκέτου i18next και έμενε
      //    πράσινη μόνο επειδή τα locale είχαν ΚΙ ΑΥΤΑ τη λάθος μορφή.
      return value.replace(/\{(\w+)\}/g, (_m, name) => String(vars?.[name] ?? `{${name}}`));
    },
  }),
}));

import { CreateWorkspaceForm } from '../CreateWorkspaceForm';
import { suggestAlias } from '../alias-suggestion';
import { ALIAS_MAX_LENGTH } from '@/types/workspace-alias';

beforeEach(() => {
  submitCalls = [];
  mockState = { phase: 'editing', errorCode: null, busy: false };
});

const nameBox = () => screen.getByLabelText(W.nameLabel) as HTMLInputElement;
const aliasBox = () => screen.getByLabelText(W.aliasLabel) as HTMLInputElement;

describe('Κ1 — η οθόνη ζωγραφίζεται, ΜΕ ΜΕΤΑΦΡΑΣΜΕΝΟ κείμενο', () => {
  it('δείχνει τίτλο, δύο πεδία και τις δύο διαβεβαιώσεις', () => {
    render(<CreateWorkspaceForm />);

    expect(screen.getByRole('heading', { name: W.title })).toBeInTheDocument();
    expect(nameBox()).toBeInTheDocument();
    expect(aliasBox()).toBeInTheDocument();
    expect(screen.getByText(W.youBecomeAdmin)).toBeInTheDocument();
    expect(screen.getByText(W.privateStays)).toBeInTheDocument();
  });

  it('ΚΑΝΕΝΑ ωμό κλειδί δεν φτάνει στην οθόνη', () => {
    const { container } = render(<CreateWorkspaceForm />);
    expect(container.textContent).not.toMatch(/onboarding\.workspace\./);
  });

  it('το πρόθεμα «/o/» έρχεται από το SSoT και είναι ορατό', () => {
    render(<CreateWorkspaceForm />);
    expect(screen.getByText('/o/')).toBeInTheDocument();
  });
});

describe('Κ2 — Η ΔΙΕΥΘΥΝΣΗ ΓΡΑΦΕΤΑΙ ΜΟΝΗ ΤΗΣ, ΜΕΧΡΙ ΝΑ ΤΗΝ ΑΓΓΙΞΕΙΣ', () => {
  it('η επωνυμία γεννά πρόταση διεύθυνσης', () => {
    render(<CreateWorkspaceForm />);
    fireEvent.change(nameBox(), { target: { value: 'Δομή Τεχνική' } });
    expect(aliasBox().value).toBe('δομή-τεχνική');
  });

  it('🔴 μόλις γραφτεί η διεύθυνση με το χέρι, ΠΑΥΕΙ να την ξαναγράφει η επωνυμία', () => {
    // Χωρίς αυτό, μια διόρθωση στην επωνυμία ΣΒΗΝΕΙ σιωπηλά τη διεύθυνση που
    // μόλις διάλεξε ο άνθρωπος — η κλασική βλάβη των «έξυπνων» πεδίων.
    render(<CreateWorkspaceForm />);
    fireEvent.change(nameBox(), { target: { value: 'Δομή' } });
    fireEvent.change(aliasBox(), { target: { value: 'domi-ate' } });
    fireEvent.change(nameBox(), { target: { value: 'Δομή Τεχνική ΑΕ' } });

    expect(aliasBox().value).toBe('domi-ate');
  });

  it('η πρόταση δεν ξεπερνά ΠΟΤΕ το όριο του SSoT', () => {
    const long = 'Α'.repeat(200);
    expect(suggestAlias(long, ALIAS_MAX_LENGTH).length).toBeLessThanOrEqual(ALIAS_MAX_LENGTH);
  });
});

describe('Κ3 — Η ΑΠΟΡΡΙΨΗ ΓΙΝΕΤΑΙ ΠΡΟΤΑΣΗ, ΠΟΤΕ ΩΜΟΣ ΚΩΔΙΚΟΣ', () => {
  it.each([
    ['already-taken', W.errors['already-taken']],
    ['reserved', W.errors.reserved],
    ['mixed-script', W.errors['mixed-script']],
    ['already-has-workspace', W.errors['already-has-workspace']],
    ['registry-unavailable', W.errors['registry-unavailable']],
  ])('«%s» ⇒ το κείμενο του locale', (code, expected) => {
    mockState = { phase: 'editing', errorCode: code, busy: false };
    render(<CreateWorkspaceForm />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(expected);
    expect(alert.textContent).not.toContain(code);
  });

  it('🔴 ΑΓΝΩΣΤΟΣ κωδικός ⇒ πρόταση, ΟΧΙ ο ίδιος ο κωδικός στην οθόνη', () => {
    // Ένας διακομιστής νεότερης έκδοσης μπορεί να στείλει ετυμηγορία που αυτός
    // ο κώδικας δεν ξέρει. Ο άνθρωπος δεν επιτρέπεται να δει ωμό `some-new-code`.
    mockState = { phase: 'editing', errorCode: 'some-new-code', busy: false };
    render(<CreateWorkspaceForm />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(W.errors.failed);
    expect(alert.textContent).not.toContain('some-new-code');
  });

  it('τα όρια μήκους έρχονται από το SSoT, όχι από σταθερά στο κείμενο', () => {
    mockState = { phase: 'editing', errorCode: 'too-short', busy: false };
    render(<CreateWorkspaceForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('3');
  });
});

describe('Κ4 — Η ΥΠΟΒΟΛΗ', () => {
  it('στέλνει επωνυμία και διεύθυνση όπως τα βλέπει ο άνθρωπος', async () => {
    render(<CreateWorkspaceForm />);
    fireEvent.change(nameBox(), { target: { value: 'Δομή Τεχνική' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(W.submit) }));

    await waitFor(() => expect(submitCalls).toEqual([['Δομή Τεχνική', 'δομή-τεχνική']]));
  });

  it('🔴 όσο δουλεύει, ΔΕΝ ξαναστέλνει — τα πεδία κλειδώνουν', () => {
    // Διπλή υποβολή = δεύτερη προσπάθεια δέσμευσης ονόματος όσο τρέχει η πρώτη.
    mockState = { phase: 'submitting', errorCode: null, busy: true };
    render(<CreateWorkspaceForm />);

    expect(nameBox()).toBeDisabled();
    expect(aliasBox()).toBeDisabled();
    expect(screen.getByRole('button', { name: W.submitting })).toBeDisabled();
  });

  it('η αναμονή των claims δείχνει ότι κάτι τρέχει — δεν παγώνει σιωπηλά', () => {
    mockState = { phase: 'awaiting-claims', errorCode: null, busy: true };
    render(<CreateWorkspaceForm />);
    expect(screen.getByRole('button', { name: W.submitting })).toBeDisabled();
  });
});
