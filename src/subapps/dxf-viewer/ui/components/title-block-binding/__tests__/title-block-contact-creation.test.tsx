/**
 * @jest-environment ./tests/service-integration/_harness/jsdom-with-node-globals.js
 *
 * @fileoverview 🔴 **«Καταχώριση επαφής» — τι εμφανίζεται, τι περνά, και τι ΔΕΝ γράφεται**
 * (ADR-759 Φ1, §Θ κριτήρια 1, 4, 5).
 *
 * Ο κύκλος «προσυμπλήρωση ⇒ επαφή ⇒ `name-exact`» αποδεικνύεται **καθαρά** στο
 * `lib/title-block/__tests__/contact-prefill.test.ts`, χωρίς React. Εδώ ελέγχεται το άλλο μισό,
 * που εκείνο δεν μπορεί να δει: **η γραμμή**. Τρία πράγματα, το καθένα πληρωμένο σε αυτό το ADR:
 *
 * 1. **Πού** εμφανίζεται το κουμπί. Σε `role-undecided` ο άνθρωπος **βρέθηκε** — κουμπί εκεί
 *    είναι πρόσκληση να φτιαχτεί **δίδυμη** επαφή, δηλαδή θεραπεία που γεννά χειρότερη ασθένεια.
 * 2. **Τι** παραδίδεται στη φόρμα: ο τύπος κλειδωμένος σε φυσικό πρόσωπο, η προσυμπλήρωση, και
 *    η **υπενθύμιση προέλευσης** — χωρίς την οποία η φόρμα ισχυρίζεται ως δικά του τα στοιχεία
 *    του γραφείου.
 * 3. **Ότι η δημιουργία ΔΕΝ είναι ταυτοποίηση** (ADR-745 §8 κανόνας 1): μετά την αποθήκευση,
 *    μηδέν εγγραφές σύνδεσης — μόνο αίτημα επαναϋπολογισμού.
 *
 * ⚠️ Ο **διάλογος** επαφών είναι πλαστός εδώ, και σκόπιμα: το ζητούμενο είναι το **συμβόλαιο**
 * μεταξύ παλέτας και φόρμας. Ο πραγματικός διάλογος έχει τους δικούς του φύλακες, και μια
 * απόδοση ολόκληρου του δέντρου του θα μετρούσε εκείνους αντί για αυτό εδώ.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BindingProposal } from '@/types/title-block-binding';
import type { TitleBlockReading } from '@/types/title-block-reading';
import type { AddNewContactDialogProps } from '@/types/ContactFormTypes';

// ── Ο κατάσκοπος εγγραφής, ίδιο πρότυπο με το `title-block-write-spy` ────────
const firestoreWrites: string[] = [];
const httpWrites: string[] = [];

jest.mock('firebase/firestore', () => ({
  __esModule: true,
  setDoc: jest.fn(async () => { firestoreWrites.push('setDoc'); }),
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
jest.mock('@/hooks/useGuardedLandownersSave', () => ({
  __esModule: true,
  useGuardedLandownersSave: () => ({
    checking: false,
    reset: jest.fn(),
    ImpactDialog: null,
    runSaveOperation: async (_r: unknown, action: () => Promise<void>) => { await action(); return true; },
  }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (k: string) => k }),
}));

/**
 * Ο πλαστός διάλογος **καταγράφει τα props** και δίνει ένα κουμπί «αποθήκευσε».
 *
 * 🔑 Δεν είναι απλοποίηση για ευκολία: το `TabbedAddNewContactDialog` είναι το **κανονικό**
 * σπίτι της φόρμας και ο έλεγχός του ανήκει σε εκείνο. Αυτό που ελέγχεται εδώ είναι ότι η
 * παλέτα του **παραδίδει σωστά** — κάτι που μια πλήρης απόδοση θα έκρυβε μέσα σε δεκάδες πεδία.
 */
const dialogProps: AddNewContactDialogProps[] = [];
jest.mock('@/components/contacts/dialogs/TabbedAddNewContactDialog', () => ({
  __esModule: true,
  TabbedAddNewContactDialog: (props: AddNewContactDialogProps) => {
    dialogProps.push(props);
    const React_ = jest.requireActual<typeof import('react')>('react');
    return React_.createElement(
      'section',
      { 'data-testid': 'contact-dialog' },
      props.prefillNotice,
      React_.createElement(
        'button',
        { type: 'button', onClick: props.onContactAdded },
        'save-contact',
      ),
    );
  },
}));

// eslint-disable-next-line import/first
import { TitleBlockProposalList } from '../TitleBlockProposalList';

// ── Το κελί μελετητών του G753 ───────────────────────────────────────────────

const OFFICE = {
  phones: ['2310-788493', '6949727121'],
  emails: ['info@nikolaou.com.gr'],
  websites: ['www.nikolaou.com.gr'],
  officeSeat: 'ΝΕΟΧΩΡΟΥΔΑ',
};

const READINGS = [
  {
    layerName: 'PINAKAKI 500',
    bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    fields: [],
    unparsed: [],
    people: [
      { displayName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ', professionText: 'ΑΓΡΟΝΟΜΟΣ ΤΟΠΟΓΡΑΦΟΣ ΜΗΧΑΝΙΚΟΣ', ...OFFICE },
      { displayName: 'ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ', professionText: 'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Τ.Ε.', ...OFFICE },
    ],
  },
] as unknown as readonly TitleBlockReading[];

const noMatch: BindingProposal = {
  fieldKey: 'designers',
  titleBlockIndex: 0,
  sourceHandle: 'mtext_7',
  labelHandle: 'mtext_6',
  at: { x: 408000, y: 4497000 },
  snapshotValue: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ',
  personName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ',
  candidates: [],
  blockedBy: 'no-match',
};

const renderList = (proposals: BindingProposal[], onContactCreated = jest.fn()) => {
  render(
    <TitleBlockProposalList
      proposals={proposals}
      readings={READINGS}
      fileRecordId="file_1"
      levelId="lvl_1"
      layerName="PINAKAKI 500"
      projectId="proj_1"
      onContactCreated={onContactCreated}
    />,
  );
  return onContactCreated;
};

beforeEach(() => {
  firestoreWrites.length = 0;
  httpWrites.length = 0;
  dialogProps.length = 0;
});

describe('🔑 ΠΟΥ εμφανίζεται το κουμπί', () => {
  it('σε `no-match` με πρόσωπο ⇒ εμφανίζεται (§Θ κριτήριο 1)', () => {
    renderList([noMatch]);
    expect(screen.getByRole('button', { name: /createContact/i })).toBeInTheDocument();
  });

  it('🔴 σε `role-undecided` ⇒ ΔΕΝ εμφανίζεται — ο άνθρωπος βρέθηκε, νέα επαφή θα ήταν δίδυμη', () => {
    renderList([{ ...noMatch, blockedBy: 'role-undecided' }]);
    expect(screen.queryByRole('button', { name: /createContact/i })).not.toBeInTheDocument();
  });

  it('🔴 σε πρόταση ΧΩΡΙΣ πρόσωπο (δήμος, Ο.Τ.) ⇒ ΔΕΝ εμφανίζεται', () => {
    renderList([{ ...noMatch, personName: undefined, snapshotValue: 'Ο.Τ. Γ 753' }]);
    expect(screen.queryByRole('button', { name: /createContact/i })).not.toBeInTheDocument();
  });

  it('🔴 όταν οι αναγνώσεις λείπουν, το κουμπί δεν εμφανίζεται — ποτέ φόρμα με κενή προσυμπλήρωση', () => {
    render(
      <TitleBlockProposalList
        proposals={[noMatch]}
        readings={[]}
        fileRecordId="file_1"
        levelId="lvl_1"
        layerName="PINAKAKI 500"
        projectId="proj_1"
        onContactCreated={jest.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /createContact/i })).not.toBeInTheDocument();
  });
});

describe('🔑 ΤΙ παραδίδεται στη φόρμα', () => {
  it('ο διάλογος δεν υπάρχει πριν το κλικ — ούτε στο DOM ούτε ως δεσμευμένο id', () => {
    renderList([noMatch]);
    expect(screen.queryByTestId('contact-dialog')).not.toBeInTheDocument();
    expect(dialogProps).toHaveLength(0);
  });

  it('🔑 τύπος κλειδωμένος σε φυσικό πρόσωπο + προσυμπλήρωση από την πινακίδα', async () => {
    const user = userEvent.setup();
    renderList([noMatch]);
    await user.click(screen.getByRole('button', { name: /createContact/i }));

    const props = dialogProps[dialogProps.length - 1];
    expect(props.allowedContactTypes).toEqual(['individual']);
    expect(props.prefill).toMatchObject({
      type: 'individual',
      lastName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ',
      firstName: 'ΚΩΝ/ΝΟΣ',
      city: 'ΝΕΟΧΩΡΟΥΔΑ',
    });
    expect(props.prefill?.websites?.[0].url).toBe('https://www.nikolaou.com.gr');
  });

  it('🔴 η ΠΡΟΕΛΕΥΣΗ φαίνεται, και μαζί της τα στοιχεία του ΓΡΑΦΕΙΟΥ', async () => {
    const user = userEvent.setup();
    renderList([noMatch]);
    await user.click(screen.getByRole('button', { name: /createContact/i }));

    // Χωρίς αυτό, η φόρμα παρουσιάζει το e-mail του **συνεργάτη** ως στοιχείο του ανθρώπου.
    expect(screen.getByText('titleBlockBinding.newContact.noticeTitle')).toBeInTheDocument();
    expect(screen.getByText('info@nikolaou.com.gr')).toBeInTheDocument();
  });

  it('🔴 ΚΑΜΙΑ προειδοποίηση σειράς ονόματος όταν το σχέδιο έδωσε σήμα', async () => {
    // Το «ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ» έχει συστολή ⇒ η σειρά δεν μαντεύτηκε. Προειδοποίηση εδώ θα
    // ήταν θόρυβος — και ο θόρυβος εκπαιδεύει τον χρήστη να αγνοεί και την πραγματική.
    const user = userEvent.setup();
    renderList([noMatch]);
    await user.click(screen.getByRole('button', { name: /createContact/i }));
    expect(
      screen.queryByText('titleBlockBinding.newContact.checkNameOrder'),
    ).not.toBeInTheDocument();
  });
});

describe('🔴 ΔΗΜΙΟΥΡΓΙΑ ≠ ΤΑΥΤΟΠΟΙΗΣΗ (§Θ κριτήριο 4)', () => {
  it('🔑 μετά την αποθήκευση: ΜΗΔΕΝ εγγραφές σύνδεσης, μόνο αίτημα επαναϋπολογισμού', async () => {
    const user = userEvent.setup();
    const onContactCreated = renderList([noMatch]);

    await user.click(screen.getByRole('button', { name: /createContact/i }));
    await user.click(screen.getByRole('button', { name: 'save-contact' }));

    expect(onContactCreated).toHaveBeenCalledTimes(1);
    // Το binding **δεν** γράφτηκε. Η νέα επαφή δεν εγκρίνει τίποτα από μόνη της.
    expect(firestoreWrites).toEqual([]);
    expect(httpWrites).toEqual([]);
  });

  it('🔑 και ο χρήστης το ΔΙΑΒΑΖΕΙ — δεν το συμπεραίνει από την απουσία', async () => {
    const user = userEvent.setup();
    renderList([noMatch]);

    await user.click(screen.getByRole('button', { name: /createContact/i }));
    expect(
      screen.queryByText('titleBlockBinding.newContact.createdStillUnapproved'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'save-contact' }));
    expect(
      screen.getByText('titleBlockBinding.newContact.createdStillUnapproved'),
    ).toBeInTheDocument();
  });
});
