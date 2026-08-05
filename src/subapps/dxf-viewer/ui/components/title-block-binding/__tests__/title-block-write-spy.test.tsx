/**
 * @jest-environment ./tests/service-integration/_harness/jsdom-with-node-globals.js
 *
 * @fileoverview 🔴 Ο ΚΑΤΑΣΚΟΠΟΣ ΕΓΓΡΑΦΗΣ — «καμία εγγραφή χωρίς κλικ» (ADR-745 §5.1, Φ3β Δ2).
 *
 * Η θεμελιώδης αρχή του ADR είναι μία πρόταση: **η πινακίδα δεν είναι ποτέ SSoT· καμία εγγραφή
 * χωρίς ρητή ανθρώπινη έγκριση.** Αυτό είναι το μόνο test που την ελέγχει.
 *
 * ⚠️ **Η υπάρχουσα άγκυρα καθαρότητας ΔΕΝ αρκεί, και το λέει η ίδια.** Το
 * `title-block-purity.test.ts` αποδεικνύει ότι ο **Λ2** δεν *μπορεί* να φτάσει σε Firestore·
 * δεν λέει τίποτα για την **παλέτα**, που είναι ακριβώς το αρχείο που **θα** γράψει. Ο κίνδυνος
 * είναι μετρημένος: το `ContactSearchManager:221-229` κατεβάζει ήδη επαφές μέσα από `useEffect`
 * **χωρίς κανένα κλικ**. Ένα «αν είναι μονοσήμαντο, εφάρμοσέ το» είναι **μία γραμμή** μακριά.
 *
 * 🔑 **ΤΡΕΙΣ αστοχίες που αυτό το test αποφεύγει επίτηδες** — κάθε μία πληρωμένη σε αυτό το ADR:
 *
 * **(α) Κατασκοπεία μόνο του Firestore SDK θα μετρούσε λάθος πράγμα.** Από τους τέσσερις
 * εγγράψιμους στόχους, οι **τρεις** γράφουν μέσω **HTTP**: `updateProjectWithPolicy` →
 * `updateProjectClient` → `apiClient.patch` (`projects-client.service.ts:186`). Ένας κατάσκοπος
 * που παρακολουθεί μόνο `setDoc/updateDoc` θα έβλεπε **0 εγγραφές** για τους τρεις και το test
 * θα «περνούσε» αφού κάποιος διόρθωνε τον αριθμό — αποδεικνύοντας ότι **δεν γράφτηκε ο στόχος**.
 * ⇒ Κατασκοπεύονται **και τα δύο** κανάλια.
 *
 * **(β) Το «0 εγγραφές» είναι ΔΩΡΕΑΝ ΑΛΗΘΕΣ αν δεν κοιτάξεις πρώτα.** Η παλέτα με κλειστό store
 * αποδίδει `null` και το `useTitleBlockProposals` κόβει στο `if (!enabled) return`. Ένα test που
 * μετρά μηδέν σε άδεια οθόνη δεν ελέγχει τίποτα. ⇒ Βεβαιώνεται **πρώτα** ότι υπάρχουν προτάσεις
 * **και κουμπιά**, και μόνο μετά μετριέται το μηδέν. Ίδιο σχήμα με το M8 του §9.4.
 *
 * **(γ) Ο αριθμός δηλώνεται ΑΝΑ ΕΙΔΟΣ ΣΤΟΧΟΥ**, όχι ένα καθολικό «2»: ο `contact` γράφει
 * 1 Firestore (link) + 1 Firestore (binding)· ο `landowner` 1 HTTP (project) + 1 Firestore.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BindingProposal } from '@/types/title-block-binding';

// ── Οι δύο κατάσκοποι ────────────────────────────────────────────────────────
const firestoreWrites: string[] = [];
const httpWrites: string[] = [];
/**
 * **Τι** γράφτηκε, όχι μόνο **πόσα**.
 *
 * Ένας μετρητής αποδεικνύει ότι έγινε εγγραφή· δεν αποδεικνύει ότι γράφτηκε ο υποψήφιος **που
 * διάλεξε ο άνθρωπος**. Ακριβώς εκεί ζούσε το ελάττωμα της 05/08: οι εγγραφές ήταν πάντα δύο,
 * και μία από αυτές είχε αυθαίρετο ρόλο.
 */
const firestorePayloads: Record<string, unknown>[] = [];

jest.mock('firebase/firestore', () => ({
  __esModule: true,
  setDoc: jest.fn(async (_ref: unknown, data: Record<string, unknown>) => {
    firestoreWrites.push('setDoc');
    firestorePayloads.push(data);
  }),
  updateDoc: jest.fn(async () => { firestoreWrites.push('updateDoc'); }),
  writeBatch: jest.fn(() => { firestoreWrites.push('writeBatch'); return { set: jest.fn(), update: jest.fn(), commit: jest.fn() }; }),
  runTransaction: jest.fn(async () => { firestoreWrites.push('runTransaction'); }),
  addDoc: jest.fn(async () => { firestoreWrites.push('addDoc'); }),
  deleteDoc: jest.fn(async () => { firestoreWrites.push('deleteDoc'); }),
  doc: jest.fn(() => ({ withConverter: jest.fn(() => ({})) })),
  collection: jest.fn(() => ({ withConverter: jest.fn(() => ({})) })),
  query: jest.fn(() => ({ withConverter: jest.fn(() => ({})) })),
  where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
  getDoc: jest.fn(async () => ({ exists: () => false, data: () => undefined })),
  getDocs: jest.fn(async () => ({ docs: [] })),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('@/lib/api/enterprise-api-client', () => ({
  __esModule: true,
  apiClient: {
    get: jest.fn(async () => ({ project: { id: 'proj_1', landowners: [], addresses: [] } })),
    patch: jest.fn(async () => { httpWrites.push('patch'); return {}; }),
    post: jest.fn(async () => { httpWrites.push('post'); return {}; }),
    put: jest.fn(async () => { httpWrites.push('put'); return {}; }),
    delete: jest.fn(async () => { httpWrites.push('delete'); return {}; }),
  },
  ApiClientError: class extends Error {},
}));

jest.mock('@/lib/firebase', () => ({ __esModule: true, db: {}, auth: {} }));
jest.mock('@/auth/hooks/useAuth', () => ({
  __esModule: true,
  useAuth: () => ({ user: { uid: 'user_test' } }),
}));
jest.mock('@/hooks/useCompanyId', () => ({
  __esModule: true,
  useCompanyId: () => ({ companyId: 'comp_test' }),
}));
// Ο φύλακας των πινάκων ποσοστών: εδώ «προχώρα», ώστε το test να μετρά ΕΓΓΡΑΦΕΣ και όχι
// διαλόγους. Ότι ο καμβάς περνά όντως από αυτόν, το πιάνει ξεχωριστό test παρακάτω.
jest.mock('@/hooks/useGuardedLandownersSave', () => ({
  __esModule: true,
  useGuardedLandownersSave: () => ({
    checking: false,
    reset: jest.fn(),
    ImpactDialog: null,
    runSaveOperation: async (_req: unknown, action: () => Promise<void>) => { await action(); return true; },
  }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Το Radix Select στηρίζεται σε pointer capture που το jsdom δεν έχει. Ίδιο πρότυπο με το
// `components/ui/__tests__/clearable-select.test.tsx`: κάθε επιλογή γίνεται πραγματικό κουμπί,
// ώστε το **κλικ** να παραμένει αληθινό κλικ και όχι κλήση συνάρτησης.
jest.mock('@/components/ui/select', () => {
  const React_ = jest.requireActual<typeof import('react')>('react');
  const Ctx = React_.createContext<(v: string) => void>(() => {});
  return {
    __esModule: true,
    Select: ({ onValueChange, children }: { onValueChange: (v: string) => void; children: React.ReactNode }) =>
      React_.createElement(Ctx.Provider, { value: onValueChange }, children),
    SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) =>
      React_.createElement('div', { id }, children),
    SelectValue: ({ placeholder }: { placeholder?: string }) =>
      React_.createElement('span', null, placeholder),
    SelectContent: ({ children }: { children: React.ReactNode }) =>
      React_.createElement('div', null, children),
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const onValueChange = React_.useContext(Ctx);
      return React_.createElement(
        'button',
        { type: 'button', role: 'option', 'aria-selected': false, onClick: () => onValueChange(value) },
        children,
      );
    },
  };
});

// eslint-disable-next-line import/first
import { TitleBlockProposalList } from '../TitleBlockProposalList';

// ── Προτάσεις που ΘΑ μπορούσαν να αυτο-εφαρμοστούν ───────────────────────────
// Και οι δύο είναι **μονοσήμαντες** (ακριβώς ένας υποψήφιος με ισχυρή μαρτυρία): αν κάποιος
// γράψει ποτέ «αν είναι βέβαιο, εφάρμοσέ το», αυτές είναι που θα πέσουν πρώτες.
const contactProposal: BindingProposal = {
  fieldKey: 'designers',
  titleBlockIndex: 0,
  sourceHandle: 'mtext_7',
  labelHandle: 'mtext_6',
  at: { x: 408012.8, y: 4497231.25 },
  snapshotValue: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ',
  personName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ',
  candidates: [{
    target: { kind: 'contact', contactId: 'cont_1', role: 'surveyor', projectId: 'proj_1' },
    label: 'Μαυρομιχάλης Κωνσταντίνος',
    evidence: [{ kind: 'email', value: 'info@x.gr' }],
  }],
};

const buildingBlockProposal: BindingProposal = {
  fieldKey: 'location',
  titleBlockIndex: 0,
  sourceHandle: 'mtext_9',
  labelHandle: 'mtext_8',
  at: { x: 408012.8, y: 4497200 },
  snapshotValue: 'Ο.Τ. Γ 753',
  candidates: [{
    target: { kind: 'project-field', projectId: 'proj_1', field: 'buildingBlock', value: 'Ο.Τ. Γ 753' },
    label: 'Ο.Τ. Γ 753',
    evidence: [],
  }],
};

/**
 * Οι αναγνώσεις του layer — **κενές εδώ επίτηδες**.
 *
 * Ο κατάσκοπος ρωτά «γράφεται κάτι χωρίς κλικ;». Με κενές αναγνώσεις καμία γραμμή δεν βρίσκει
 * πρόσωπο, άρα το κουμπί «Νέα επαφή» δεν αποδίδεται καν — και το test μετρά **αυτό που δηλώνει
 * ότι μετρά**, τη διαδρομή έγκρισης. Η διαδρομή δημιουργίας έχει τον δικό της κατάσκοπο
 * παρακάτω, όπου οι αναγνώσεις είναι γεμάτες.
 */
const NO_READINGS: never[] = [];

const renderList = (proposals: BindingProposal[]) =>
  render(
    <TitleBlockProposalList
      proposals={proposals}
      readings={NO_READINGS}
      fileRecordId="file_1"
      levelId="lvl_1"
      layerName="PINAKAKI 500"
      projectId="proj_1"
      onContactCreated={jest.fn()}
    />,
  );

beforeEach(() => {
  firestoreWrites.length = 0;
  httpWrites.length = 0;
  firestorePayloads.length = 0;
});

describe('🔴 ΚΑΜΙΑ ΕΓΓΡΑΦΗ ΧΩΡΙΣ ΚΛΙΚ', () => {
  it('το μηδέν μετριέται ΜΟΝΟ αφού αποδειχθεί ότι υπάρχει τι να γραφτεί', async () => {
    renderList([contactProposal, buildingBlockProposal]);

    // (β) Ο φρουρός του ίδιου του test: χωρίς αυτόν, «0 εγγραφές» θα ήταν δωρεάν αληθές.
    const buttons = await screen.findAllByRole('button', { name: /approve/i });
    expect(buttons.length).toBe(2);

    // Τα effects ηρεμούν. Ό,τι θα «προ-εφάρμοζε» μια βέβαιη πρόταση, θα χτυπούσε εδώ.
    await waitFor(() => expect(buttons[0]).toBeEnabled());

    expect(firestoreWrites).toEqual([]);
    expect(httpWrites).toEqual([]);
  });

  it('🔑 ΕΝΑ κλικ σε ΕΠΑΦΗ ⇒ ακριβώς 2 Firestore (σύνδεσμος + provenance), 0 HTTP', async () => {
    const user = userEvent.setup();
    renderList([contactProposal, buildingBlockProposal]);

    const buttons = await screen.findAllByRole('button', { name: /approve/i });
    await user.click(buttons[0]);

    await waitFor(() => expect(firestoreWrites.length).toBeGreaterThan(0));
    // 1 × `linkContactToEntity` (setDoc) + 1 × `saveTitleBlockBinding` (setDoc).
    expect(firestoreWrites.filter((w) => w === 'setDoc')).toHaveLength(2);
    expect(httpWrites).toEqual([]);
  });

  it('🔑 το κλικ γράφει ΜΟΝΟ το πεδίο που πατήθηκε — τα υπόλοιπα μένουν άθικτα', async () => {
    const user = userEvent.setup();
    renderList([contactProposal, buildingBlockProposal]);

    const buttons = await screen.findAllByRole('button', { name: /approve/i });
    await user.click(buttons[0]);
    await waitFor(() => expect(firestoreWrites.length).toBe(2));

    // Το δεύτερο πεδίο (Ο.Τ. → project-field) γράφει μέσω HTTP. Μηδέν HTTP ⇒ δεν αγγίχτηκε.
    expect(httpWrites).toEqual([]);
  });

  it('🔑 ΕΝΑ κλικ σε ΠΕΔΙΟ ΕΡΓΟΥ ⇒ 1 HTTP (το έργο) + 1 Firestore (provenance)', async () => {
    // (α) Αυτό ακριβώς είναι που ένας κατάσκοπος «μόνο Firestore» θα μετρούσε **0** και θα
    // συμπέραινε λάθος ότι δεν γράφτηκε τίποτα.
    const user = userEvent.setup();
    renderList([buildingBlockProposal]);

    const button = await screen.findByRole('button', { name: /approve/i });
    await user.click(button);

    await waitFor(() => expect(httpWrites).toEqual(['patch']));
    expect(firestoreWrites.filter((w) => w === 'setDoc')).toHaveLength(1);
  });
});

describe('🔴 ΤΟ ΚΟΥΜΠΙ ΚΛΕΙΝΕΙ ΜΕ ΑΙΤΙΑ, ΔΕΝ ΓΡΑΦΕΙ ΜΕ ΚΕΝΟ ΚΛΕΙΔΙ', () => {
  it('χωρίς fileRecordId (cold load) το κλικ ΔΕΝ γράφει τίποτα', async () => {
    const user = userEvent.setup();
    render(
      <TitleBlockProposalList
        proposals={[contactProposal]}
        readings={NO_READINGS}
        fileRecordId={null}
        levelId="lvl_1"
        layerName="PINAKAKI 500"
        projectId="proj_1"
        onContactCreated={jest.fn()}
      />,
    );

    const button = await screen.findByRole('button', { name: /approve/i });
    expect(button).toBeDisabled();
    await user.click(button);

    expect(firestoreWrites).toEqual([]);
    expect(httpWrites).toEqual([]);
    // Και η αιτία είναι ΟΡΑΤΗ — γκρίζο κουμπί χωρίς εξήγηση μοιάζει με σπασμένη εφαρμογή.
    expect(screen.getByRole('status')).toHaveTextContent('titleBlockBinding.disabled.noFileRecord');
  });

  it('🔑 ΟΙΚΟΠΕΔΟΥΧΟΣ χωρίς δηλωμένο ποσοστό ΔΕΝ γράφεται (Γ6)', async () => {
    const landowner: BindingProposal = {
      ...contactProposal,
      fieldKey: 'employer',
      personName: 'ΖΕΡΒΑ ΓΕΩΡΓΙΑ',
      candidates: [{
        target: { kind: 'landowner', projectId: 'proj_1', contactId: 'cont_2', acquisitionStatus: 'prospective' },
        label: 'Ζέρβα Γεωργία',
        evidence: [{ kind: 'name-exact', value: 'Ζέρβα Γεωργία' }],
      }],
    };
    const user = userEvent.setup();
    renderList([landowner]);

    const button = await screen.findByRole('button', { name: /approve/i });
    expect(button).toBeDisabled();
    await user.click(button);

    // Η πινακίδα αποδεικνύει ΟΝΟΜΑ, ποτέ μερίδιο. Γράφοντας `0` θα δηλώναμε ότι δεν κατέχει
    // τίποτα — και θα δηλητηριάζαμε την κατανομή χιλιοστών όλης της λίστας.
    expect(firestoreWrites).toEqual([]);
    expect(httpWrites).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('titleBlockBinding.disabled.needsPercent');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Η ΕΠΙΛΟΓΗ ΥΠΟΨΗΦΙΟΥ — το ελάττωμα της 05/08
// ─────────────────────────────────────────────────────────────────────────────

/** Ίδια επαφή, τρεις ρόλοι: ταυτόσημο label, ταυτόσημη μαρτυρία. Η «Μηχανικός» δίνει 5 από 7. */
const ambiguousRole: BindingProposal = {
  ...contactProposal,
  candidates: [
    { target: { kind: 'contact', contactId: 'cont_1', role: 'architect', projectId: 'proj_1' },
      label: 'Μαυρομιχάλης Κωνσταντίνος', evidence: [{ kind: 'name-exact', value: 'Μ. Κ.' }] },
    { target: { kind: 'contact', contactId: 'cont_1', role: 'surveyor', projectId: 'proj_1' },
      label: 'Μαυρομιχάλης Κωνσταντίνος', evidence: [{ kind: 'name-exact', value: 'Μ. Κ.' }] },
    { target: { kind: 'contact', contactId: 'cont_1', role: 'structural_engineer', projectId: 'proj_1' },
      label: 'Μαυρομιχάλης Κωνσταντίνος', evidence: [{ kind: 'name-exact', value: 'Μ. Κ.' }] },
  ],
};

/** ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΟΙ ΑΝΘΡΩΠΟΙ, ίδια μαρτυρία — η αστοχία που γράφει λάθος **πρόσωπο**. */
const ambiguousPerson: BindingProposal = {
  ...contactProposal,
  candidates: [
    { target: { kind: 'contact', contactId: 'cont_1', role: 'surveyor', projectId: 'proj_1' },
      label: 'Παπαδόπουλος Γεώργιος', evidence: [{ kind: 'name-exact', value: 'Π. Γ.' }] },
    { target: { kind: 'contact', contactId: 'cont_2', role: 'surveyor', projectId: 'proj_1' },
      label: 'Παπαδόπουλος Γρηγόριος', evidence: [{ kind: 'name-exact', value: 'Π. Γ.' }] },
  ],
};

describe('🔴 ΚΑΜΙΑ ΕΓΓΡΑΦΗ ΧΩΡΙΣ ΕΠΙΛΟΓΗ ΑΝΘΡΩΠΟΥ', () => {
  it('🔑 διφορούμενη ΕΙΔΙΚΟΤΗΤΑ ⇒ κουμπί κλειστό, ΑΙΤΙΑ ορατή, μηδέν εγγραφές', async () => {
    const user = userEvent.setup();
    renderList([ambiguousRole]);

    const button = await screen.findByRole('button', { name: /approve/i });
    expect(button).toBeDisabled();
    await user.click(button);

    expect(firestoreWrites).toEqual([]);
    expect(httpWrites).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('titleBlockBinding.disabled.needsChoice');
  });

  it('🔴 δύο διαφορετικοί ΑΝΘΡΩΠΟΙ με ίδια μαρτυρία ⇒ επίσης κλειστό', async () => {
    // Ο έλεγχος που πέφτει αν η ισοπαλία γραφτεί ως `compare()===0`: τα labels διαφέρουν, οπότε
    // ο πλήρης συγκριτής δίνει «νικητή» — τον αλφαβητικά πρώτο. Λάθος ΑΝΘΡΩΠΟΣ, όχι λάθος ρόλος.
    renderList([ambiguousPerson]);

    const button = await screen.findByRole('button', { name: /approve/i });
    expect(button).toBeDisabled();
    expect(firestoreWrites).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('titleBlockBinding.disabled.needsChoice');
  });

  it('🔑 ΜΕΤΑ την επιλογή γράφεται ΑΚΡΙΒΩΣ ο υποψήφιος που διάλεξε ο άνθρωπος', async () => {
    const user = userEvent.setup();
    renderList([ambiguousRole]);

    // Ο δεύτερος υποψήφιος: `surveyor`. Αν ο κώδικας ξαναπέσει στο `candidates[0]`, θα γράψει
    // `architect` — και το πλήθος εγγραφών θα ήταν **ίδιο**, γι' αυτό ελέγχεται το περιεχόμενο.
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(3);
    await user.click(options[1]);

    const button = screen.getByRole('button', { name: /approve/i });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    await waitFor(() => expect(firestoreWrites.filter((w) => w === 'setDoc')).toHaveLength(2));

    const binding = firestorePayloads.find((p) => 'fieldKey' in p && 'confirmedBy' in p);
    expect(binding).toBeDefined();
    expect(binding?.target).toEqual(
      expect.objectContaining({ kind: 'contact', contactId: 'cont_1', role: 'surveyor' }),
    );
  });

  it('🔴 ΜΗ ΟΠΙΣΘΟΔΡΟΜΗΣΗ: ΕΝΑΣ υποψήφιος ⇒ κουμπί ενεργό ΧΩΡΙΣ επιλογέα', async () => {
    // Ο μονοσήμαντος μελετητής και το Ο.Τ. (κενή μαρτυρία) είναι οι διαδρομές που δούλευαν πριν
    // τη διόρθωση. Θεραπεία που τις κλείνει είναι χειρότερη από το ελάττωμα.
    renderList([contactProposal, buildingBlockProposal]);

    const buttons = await screen.findAllByRole('button', { name: /approve/i });
    await waitFor(() => expect(buttons[0]).toBeEnabled());
    expect(buttons[1]).toBeEnabled();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('🔑 αλλαγή επιλογής ΜΕΤΑ την έγκριση ΞΕΚΛΕΙΔΩΝΕΙ τη γραμμή', async () => {
    // Χωρίς τον στόχο μέσα στο κλειδί έγκρισης, η γραμμή έμενε κλειδωμένη γράφοντας «Εγκρίθηκε»
    // ενώ ο επιλογέας έδειχνε **άλλον** υποψήφιο — η οθόνη έλεγε ψέματα.
    const user = userEvent.setup();
    renderList([ambiguousRole]);

    const options = await screen.findAllByRole('option');
    await user.click(options[0]);
    const button = screen.getByRole('button', { name: /approve/i });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    await waitFor(() => expect(screen.getByRole('button', { name: /approved/i })).toBeDisabled());

    // Ο χρήστης καταλαβαίνει το λάθος και διαλέγει άλλον ρόλο.
    await user.click(screen.getAllByRole('option')[1]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /titleBlockBinding\.approve$/i })).toBeEnabled(),
    );
  });
});
