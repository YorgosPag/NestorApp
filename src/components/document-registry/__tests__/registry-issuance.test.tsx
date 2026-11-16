/**
 * @fileoverview ADR-915 §27 — **«Ανάθεση σε επαγγελματία»** στη σελίδα «Λήξεις εγγράφων», όπως τη βλέπει ο άνθρωπος:
 *   «Ανάθεση» πριν από το «Βρες» · «Ανατέθηκε» ΜΟΝΟ με απόφαση ιδιοκτήτη · η μπάλα με όνομα · το «Βρες» φεύγει όταν
 *   δεσμευτεί επαγγελματίας · πρόταση **αισιόδοξα** · επαναφορά με λόγο · απόφαση μόνο με υπεύθυνο.
 *
 * 🔴 **Διαβάζει ΑΠΟΔΟΣΗ**: αληθινά `DocumentRegistryContent` + `useIssuanceAssignment` + ο ΑΛΗΘΙΝΟΣ συναρμολογητής των
 *    αναθέσεων (μέσα από το fixture)· ψεύτικα μόνο το δίκτυο, το δικαίωμα και τα μηνύματα.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DocumentRegistryContent } from '../DocumentRegistryContent';
import { NEXT_STEP_KEYS } from '../document-registry-labels';
import {
  BALL_IN_COURT_KEYS,
  DECISION_KEYS,
  DELIVERY_HISTORY_KEYS,
  ISSUANCE_ERROR_KEYS,
  ISSUANCE_KEYS,
  ISSUANCE_REFUSAL_CODES,
  ISSUANCE_STAGE_KEYS,
  LINK_HISTORY_KEYS,
  PROPOSE_KEYS,
  QUOTE_KEYS,
  SEND_KEYS,
} from '../issuance-labels';
import type { QuoteTerms } from '@/lib/document-validity/issuance-quote';
import { formatDate } from '@/lib/intl-formatting';
import { DELIVERY_KEYS, DELIVERY_SOURCE_KEYS, DELIVERY_TIER_KEYS } from '../issuance-delivery-labels';
import { INSPECTION_KEYS } from '../issuance-inspection-labels';
import { OWNER_VAT_KEYS } from '../issuance-owner-vat-labels';
import { INSPECTION_ROLE_LABEL_KEYS } from '../document-registry-labels';
import { LAYOUT_KEYS, REGISTRY_TAB_LABEL_KEYS } from '../registry-layout-labels';
import { reduceIssuance, type IssuanceAction, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { withIssuanceDelivery } from '@/lib/document-validity/issuance-delivery';
import { planIssuanceReminders, withIssuanceReminderSent } from '@/lib/document-validity/issuance-reminder';
import type { IssuanceRosterEntry } from '@/lib/document-validity/issuance-candidates';
import type { ObligorLead } from '@/lib/document-validity/obligor-lead';
import { FIXTURE_DOCUMENTS, FIXTURE_REQUIREMENTS, fixtureResponse } from '@/lib/document-validity/__tests__/registry-fixture';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { ObligorDesignationSave } from '@/services/document-registry/document-registry.client';

const revalidate = jest.fn(async () => undefined);
let registry: DocumentRegistryResponse;
jest.mock('@/hooks/document-registry/useDocumentRegistry', () => ({
  useDocumentRegistry: () => ({ view: { state: 'ready', registry }, reload: jest.fn(), revalidate }),
}));

const save = jest.fn(async (..._args: unknown[]): Promise<ObligorDesignationSave> => ({ kind: 'saved' }));
const preview = jest.fn();
const send = jest.fn();
const applyVat = jest.fn(async (..._args: unknown[]) => ({ kind: 'ok', data: { result: 'applied' } }));
jest.mock('@/services/document-registry/document-registry.client', () => ({
  saveObligorDesignation: jest.fn(),
  saveIssuanceAction: (...args: unknown[]) => save(...args),
  previewIssuanceMessage: (...args: unknown[]) => preview(...args),
  sendIssuanceMessage: (...args: unknown[]) => send(...args),
  applyIssuanceOwnerVat: (...args: unknown[]) => applyVat(...args),
}));
// Η αναζήτηση επαφής φέρνει υπηρεσίες Firebase — εδώ αρκεί ότι ΔΕΝ χρειάζεται όταν υπάρχει γνωστός.
jest.mock('@/components/contacts/relationships/ContactSearchManager', () => ({ ContactSearchManager: () => null }));

let verdict = 'granted-by-role';
jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ verdict }) }));

const notifyError = jest.fn();
const notifySuccess = jest.fn();
const notifyWarning = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ error: notifyError, success: notifySuccess, warning: notifyWarning }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

// ADR-915 §41.5 — η κάρτα είναι τεμπέλικη επιφάνεια· εδώ ελέγχεται το ΠΕΡΙΕΧΟΜΕΝΟ της, σύγχρονα (`registry-surfaces-sync.ts`).
jest.mock('@/components/document-registry/registry-surfaces', () => jest.requireActual('./registry-surfaces-sync'));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

const ACTOR = { kind: 'office', uid: 'uid_agent', nowIso: '2026-10-10T09:00:00.000Z' } as const;
const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: null } as const;
const MAJORITY: ObligorLead = { kind: 'designated', contactId: 'cont_alpha', basis: 'majority-share', sharePct: 60, staleContactId: null };

function recordOf(actions: readonly IssuanceAction[]): IssuanceAssignmentRecord {
  return actions.reduce<IssuanceAssignmentRecord | null>((record, action) => {
    const reduced = reduceIssuance('energy-certificate', record, null, action, ACTOR);
    if (!reduced.ok) throw new Error(reduced.refusal);
    return reduced.record;
  }, null) as IssuanceAssignmentRecord;
}

const PROPOSE: IssuanceAction = { kind: 'propose', professionalContactId: 'cont_client', credential: INSPECTOR };
const APPROVE: IssuanceAction = { kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_alpha', quoteRevision: 1, ownerAttestation: null };
const NOTIFY: IssuanceAction = { kind: 'notify', channel: 'phone', invitationId: null, note: null, verification: null };
const FIRM_TERMS: QuoteTerms = { basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31', scope: ['issuance'], note: null, deliveryBusinessDays: 5 };
const QUOTE: IssuanceAction = { kind: 'quote', terms: FIRM_TERMS };
const INDICATIVE_QUOTE: IssuanceAction = { kind: 'quote', terms: { ...FIRM_TERMS, basis: 'indicative' } };
/** §42 — πρόταση → αίτημα προσφοράς → προσφορά ⇒ `quoted` (η μπάλα στον υπεύθυνο). */
const QUOTED: IssuanceAction[] = [PROPOSE, NOTIFY, QUOTE];
/** Η έγκριση της προσφοράς ΕΙΝΑΙ η ανάθεση. */
const ACCEPTED: IssuanceAction[] = [...QUOTED, APPROVE];

/** Το p6 (κενό ΠΕΑ) με υπεύθυνο, και ο κατάλογος του γραφείου. */
function withRoster(roster: readonly IssuanceRosterEntry[], lead: ObligorLead = MAJORITY): DocumentRegistryResponse {
  const base = fixtureResponse({}, FIXTURE_DOCUMENTS, FIXTURE_REQUIREMENTS, roster);
  return { ...base, properties: { ...base.properties, p6: { ...base.properties.p6, obligorLead: lead } } };
}

// ADR-915 §41.5 — η κάρτα του κενού p6 ζει στο πλαϊνό πάνελ, ανοιχτό από τη διεύθυνση (`?doc=`).
const article = () => screen.getByRole('article');

beforeEach(() => {
  window.history.replaceState(null, '', `/document-expiry?doc=${encodeURIComponent('missing:p6:energy-certificate')}`);
  verdict = 'granted-by-role';
  save.mockClear();
  revalidate.mockClear();
  notifyError.mockClear();
});

describe('ADR-915 §27 — η ανάθεση πάνω στη γραμμή', () => {
  it('καμία ανάθεση ⇒ «Ανάθεση σε επαγγελματία» ΠΡΙΝ από το «Βρες», και κανένα στάδιο', () => {
    registry = withRoster([]);
    render(<DocumentRegistryContent />);
    const assign = within(article()).getByRole('button', { name: ISSUANCE_KEYS.assign });
    const find = within(article()).getByRole('link', { name: NEXT_STEP_KEYS.findProfessional });
    expect(assign.compareDocumentPosition(find) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(article()).queryByText(ISSUANCE_STAGE_KEYS.proposed)).toBeNull();
  });

  it('🔴 πρόταση χωρίς προσφορά ⇒ ΠΟΤΕ «Ανατέθηκε», η μπάλα στο γραφείο, ΚΑΜΙΑ απόφαση — μόνο αίτημα προσφοράς / καταγραφή ενημέρωσης', () => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf([PROPOSE]) }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.proposed)).toBeTruthy();
    expect(within(article()).queryByText(ISSUANCE_STAGE_KEYS.accepted)).toBeNull();
    expect(within(article()).getByText(`${ISSUANCE_KEYS.ballInCourt} ${JSON.stringify({ party: BALL_IN_COURT_KEYS.office })}`)).toBeTruthy();
    expect(within(article()).queryByRole('button', { name: ISSUANCE_KEYS.recordDecision })).toBeNull();
    expect(within(article()).getByRole('button', { name: SEND_KEYS.professionalTrigger })).toBeTruthy();
    expect(within(article()).getByRole('button', { name: ISSUANCE_KEYS.markNotified })).toBeTruthy();
    expect(within(article()).getByRole('link', { name: NEXT_STEP_KEYS.findProfessional })).toBeTruthy();
  });

  it('🔴 προσφορά χωρίς έγκριση (`quoted`) ⇒ «αναμένει απόφαση», η μπάλα στον υπεύθυνο με όνομα, και το «Βρες» ΦΕΥΓΕΙ', () => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf(QUOTED) }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.quoted)).toBeTruthy();
    expect(within(article()).queryByText(ISSUANCE_STAGE_KEYS.accepted)).toBeNull();
    const ball = within(article()).getByText(`${ISSUANCE_KEYS.ballInCourt} ${JSON.stringify({ party: BALL_IN_COURT_KEYS.owner })}`);
    expect(within(ball.parentElement as HTMLElement).getByRole('link').textContent).toBe('Συνθετικός Άλφα');
    expect(within(article()).getByRole('button', { name: ISSUANCE_KEYS.recordDecision })).toBeTruthy();
    expect(within(article()).getByRole('button', { name: SEND_KEYS.ownerTrigger })).toBeTruthy();
    expect(within(article()).queryByRole('link', { name: NEXT_STEP_KEYS.findProfessional })).toBeNull();
  });

  it('🔴 «ποτέ δύο»: δεσμευμένος επαγγελματίας ⇒ «Ανατέθηκε», μπάλα στον επαγγελματία, και το «Βρες» ΦΕΥΓΕΙ', () => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf(ACCEPTED) }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.accepted)).toBeTruthy();
    expect(within(article()).getByText(`${ISSUANCE_KEYS.ballInCourt} ${JSON.stringify({ party: BALL_IN_COURT_KEYS.professional })}`)).toBeTruthy();
    expect(within(article()).queryByRole('link', { name: NEXT_STEP_KEYS.findProfessional })).toBeNull();
  });

  it('κατάλογος μη αναγνώσιμος ⇒ ΚΑΝΕΝΑΣ ισχυρισμός «καμία ανάθεση»: ούτε κουμπί, ρητό μήνυμα', () => {
    // Η ΣΗΜΑΙΑ νικά — ακόμη κι αν κάποια εγγραφή «φαίνεται» άδεια ανάθεση.
    registry = { ...withRoster([]), issuanceKnown: false };
    render(<DocumentRegistryContent />);
    expect(within(article()).queryByRole('button', { name: ISSUANCE_KEYS.assign })).toBeNull();
    expect(within(article()).getByText(ISSUANCE_KEYS.unavailable)).toBeTruthy();
  });

  it('χωρίς δικαίωμα ⇒ η κατάσταση λέγεται, τα κουμπιά ΟΧΙ', () => {
    verdict = 'denied-permission';
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf(QUOTED) }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.quoted)).toBeTruthy();
    expect(within(article()).queryByRole('button', { name: ISSUANCE_KEYS.recordDecision })).toBeNull();
  });
});

describe('ADR-915 §27 — πράξεις από την οθόνη', () => {
  /** Ο Πελάτισσα έβγαλε ΠΕΑ στο p1 με έγκριση ⇒ γνωστή, πρώτη, με το προσόν της. */
  const KNOWN: IssuanceRosterEntry = { propertyId: 'p1', documentKind: 'energy-certificate', record: recordOf(ACCEPTED) };

  async function proposeKnown(): Promise<void> {
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: ISSUANCE_KEYS.assign }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: /Συνθετική Πελάτισσα/ }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByText((text) => text.startsWith(PROPOSE_KEYS.previously))).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: PROPOSE_KEYS.submit }));
  }

  it('αισιόδοξα: ο γνωστός προτείνεται, το στάδιο φαίνεται ΑΜΕΣΩΣ («Αποθηκεύεται…»), μετά ξαναδιαβάζεται', async () => {
    registry = withRoster([KNOWN]);
    let resolve: (value: ObligorDesignationSave) => void = () => undefined;
    save.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<DocumentRegistryContent />);
    await proposeKnown();
    expect(save).toHaveBeenCalledWith({
      action: 'propose', propertyId: 'p6', documentKind: 'energy-certificate', expectedStage: null,
      professionalContactId: 'cont_client', qualification: 'energy-inspector-registered', registryNumber: null,
    });
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.proposed)).toBeTruthy();
    expect(within(article()).getByRole('status').textContent).toBe(ISSUANCE_KEYS.saving);
    await act(async () => { resolve({ kind: 'saved' }); });
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(within(article()).queryByRole('status')).toBeNull();
  });

  it('άρνηση (`STALE`) ⇒ η γραμμή γυρίζει πίσω ΚΑΙ ο άνθρωπος μαθαίνει γιατί — και το μητρώο ξαναδιαβάζεται', async () => {
    registry = withRoster([KNOWN]);
    save.mockResolvedValueOnce({ kind: 'failed', code: 'STALE' });
    render(<DocumentRegistryContent />);
    await proposeKnown();
    expect(await within(article()).findByRole('button', { name: ISSUANCE_KEYS.assign })).toBeTruthy();
    expect(within(article()).queryByText(ISSUANCE_STAGE_KEYS.proposed)).toBeNull();
    expect(notifyError).toHaveBeenCalledWith(ISSUANCE_ERROR_KEYS.STALE);
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('🔴 χωρίς υπεύθυνο ⇒ ο διάλογος απόφασης ΔΕΝ δίνει φόρμα: «ορίστε πρώτα υπεύθυνο»', async () => {
    registry = withRoster(
      [{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf(QUOTED) }],
      { kind: 'undesignated', reason: 'no-majority', staleContactId: null },
    );
    render(<DocumentRegistryContent />);
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: ISSUANCE_KEYS.recordDecision }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(DECISION_KEYS.needsLead)).toBeTruthy();
    expect(within(dialog).queryByRole('radio')).toBeNull();
  });

  it('απόφαση ⇒ στέλνει τον υπεύθυνο που ΕΙΔΕ η οθόνη (CAS), το στάδιο και την ΑΝΑΘΕΩΡΗΣΗ προσφοράς που είδε', async () => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf(QUOTED) }]);
    render(<DocumentRegistryContent />);
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: ISSUANCE_KEYS.recordDecision }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: new RegExp(DECISION_KEYS.approved) }));
    await user.click(within(dialog).getAllByRole('radio')[3]);
    await user.click(within(dialog).getByRole('button', { name: DECISION_KEYS.submit }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      action: 'decide', expectedStage: 'quoted', outcome: 'approved', expectedOwnerContactId: 'cont_alpha', note: null, quoteRevision: 1,
    }));
  });
});

describe('ADR-915 §42 — η προσφορά πάνω στην κάρτα: μία επόμενη ενέργεια ανά στάδιο', () => {
  const renderStage = (actions: readonly IssuanceAction[]) => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf(actions) }]);
    render(<DocumentRegistryContent />);
  };
  const startsWith = (key: string) => (content: string) => content.startsWith(key);

  it('μετά το αίτημα προσφοράς (`sent`) ⇒ «Καταγραφή προσφοράς» και «Δεν δίνει προσφορά» — ΠΟΤΕ «Αναλαμβάνω»', () => {
    renderStage([PROPOSE, NOTIFY]);
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.sent)).toBeTruthy();
    expect(within(article()).getByRole('button', { name: QUOTE_KEYS.recordQuote })).toBeTruthy();
    expect(within(article()).getByRole('button', { name: QUOTE_KEYS.noQuote })).toBeTruthy();
    expect(within(article()).queryByRole('button', { name: ISSUANCE_KEYS.accepted })).toBeNull();
  });

  it('παλιά ανάθεση (§27) στο `sent` ⇒ ο παλιός δρόμος «Αναλαμβάνει / Αρνήθηκε», χωρίς καταγραφή προσφοράς', () => {
    const legacy: IssuanceAssignmentRecord = {
      ...recordOf([PROPOSE, NOTIFY]),
      decision: { basis: 'recorded-instruction', channel: 'phone', recordedByUid: 'uid_agent', outcome: 'approved', quoteRevision: null, ownerContactId: 'cont_alpha', ownerAttestation: null, note: null, at: ACTOR.nowIso },
    };
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: legacy }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.sent)).toBeTruthy();
    expect(within(article()).getByRole('button', { name: ISSUANCE_KEYS.accepted })).toBeTruthy();
    expect(within(article()).getByRole('button', { name: ISSUANCE_KEYS.declined })).toBeTruthy();
    expect(within(article()).queryByRole('button', { name: QUOTE_KEYS.recordQuote })).toBeNull();
  });

  it('η προσφορά γράφει ΜΙΑ γραμμή στο ιστορικό', () => {
    renderStage(QUOTED);
    expect(within(article()).getAllByText(startsWith(QUOTE_KEYS.line))).toHaveLength(1);
  });

  it('εγκεκριμένη δεσμευτική ⇒ «Καταγραφή παραστατικού» και απόσυρση· ΧΩΡΙΣ αναθεώρηση', () => {
    renderStage(ACCEPTED);
    expect(within(article()).getByRole('button', { name: QUOTE_KEYS.recordReceipt })).toBeTruthy();
    expect(within(article()).getByRole('button', { name: QUOTE_KEYS.withdrawn })).toBeTruthy();
    expect(within(article()).queryByRole('button', { name: QUOTE_KEYS.recordRevision })).toBeNull();
  });

  it('εγκεκριμένη ενδεικτική ⇒ και «Καταγραφή αναθεώρησης» (η μία, μετά την αυτοψία)', () => {
    renderStage([PROPOSE, NOTIFY, INDICATIVE_QUOTE, APPROVE]);
    expect(within(article()).getByRole('button', { name: QUOTE_KEYS.recordRevision })).toBeTruthy();
  });

  it('η αναθεώρηση ακυρώνει την έγκριση: στάδιο `quoted` ξανά, με την ΑΝΑΘΕΩΡΗΣΗ 2 προς απόφαση', async () => {
    renderStage([PROPOSE, NOTIFY, INDICATIVE_QUOTE, APPROVE, INDICATIVE_QUOTE]);
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.quoted)).toBeTruthy();
    expect(within(article()).getAllByText(startsWith(QUOTE_KEYS.revisedLine))).toHaveLength(1);
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: ISSUANCE_KEYS.recordDecision }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: new RegExp(DECISION_KEYS.approved) }));
    await user.click(within(dialog).getAllByRole('radio')[3]);
    await user.click(within(dialog).getByRole('button', { name: DECISION_KEYS.submit }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ action: 'decide', quoteRevision: 2 }));
  });

  it('απόσυρση από `quoted` ⇒ στέλνει `respond · declined` με το στάδιο που είδε', async () => {
    renderStage(QUOTED);
    await userEvent.setup().click(within(article()).getByRole('button', { name: QUOTE_KEYS.withdrawn }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ action: 'respond', outcome: 'declined', expectedStage: 'quoted' }));
  });

  it('οι κωδικοί άρνησης §42 (`TERMS_REFUSED`, `RECEIPT_MISMATCH`) έχουν μήνυμα στην οθόνη', () => {
    expect(ISSUANCE_REFUSAL_CODES).toEqual(expect.arrayContaining(['TERMS_REFUSED', 'RECEIPT_MISMATCH']));
    expect(ISSUANCE_ERROR_KEYS.TERMS_REFUSED).toBeTruthy();
    expect(ISSUANCE_ERROR_KEYS.RECEIPT_MISMATCH).toBeTruthy();
  });
});

describe('ADR-915 §28 — αποστολή με σύνδεσμο: πρόχειρο → προεπισκόπηση → ΕΝΑ πάτημα', () => {
  const REQUEST: IssuanceAction = { kind: 'request-approval', invitationId: 'diin_1', ownerContactId: 'cont_alpha', note: null, verification: 'link' };
  const PREVIEW = {
    audience: 'owner', recipient: { contactId: 'cont_alpha', name: 'Άλφα', email: 'alfa@example.test' },
    subject: 'Θέμα προεπισκόπησης', text: 'Κείμενο προεπισκόπησης',
    coOwners: [{ contactId: 'cont_beta', name: 'Βήτα', reachable: true }, { contactId: 'cont_gamma', name: 'Γάμμα', reachable: false }],
    coOwnerMessage: null,
  };

  beforeEach(() => {
    preview.mockReset().mockResolvedValue({ kind: 'ok', data: { preview: PREVIEW } });
    send.mockReset().mockResolvedValue({ kind: 'ok', data: { stage: 'proposed', delivery: { recipient: 'accepted', coOwners: {} }, accessCode: null } });
    notifySuccess.mockClear();
    notifyWarning.mockClear();
  });

  async function openSend(): Promise<HTMLElement> {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf(QUOTED) }]);
    render(<DocumentRegistryContent />);
    await userEvent.setup().click(within(article()).getByRole('button', { name: SEND_KEYS.ownerTrigger }));
    return screen.findByRole('dialog');
  }

  it('🔴 ΤΙΠΟΤΑ δεν φεύγει πριν το πάτημα: ο διάλογος δείχνει την προεπισκόπηση του διακομιστή, όχι αποστολή', async () => {
    const dialog = await openSend();
    expect(await within(dialog).findByText('Θέμα προεπισκόπησης', {}, { timeout: 2000 })).toBeTruthy();
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({ audience: 'owner', expectedStage: 'quoted', expectedOwnerContactId: 'cont_alpha' }));
    expect(send).not.toHaveBeenCalled();
    expect(within(dialog).getByText(SEND_KEYS.never)).toBeTruthy();
  });

  it('συνιδιοκτήτες: προεπιλογή ΝΑΙ μόνο όσοι έχουν email· ένα πάτημα ⇒ ΜΙΑ αποστολή με ό,τι προεπισκοπήθηκε', async () => {
    const dialog = await openSend();
    await within(dialog).findByText('Θέμα προεπισκόπησης', {}, { timeout: 2000 });
    const [beta, gamma] = within(dialog).getAllByRole('checkbox');
    expect(gamma?.hasAttribute('disabled')).toBe(true);
    expect(beta?.getAttribute('aria-checked')).toBe('true');
    // Η προεπιλογή άλλαξε το πρόχειρο ⇒ νέα προεπισκόπηση· το κουμπί ανοίγει ΜΟΝΟ όταν είναι για το τρέχον πρόχειρο.
    const submit = within(dialog).getByRole('button', { name: SEND_KEYS.submit });
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false), { timeout: 2000 });
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ informContactIds: ['cont_beta'] }));
    await userEvent.setup().click(submit);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ audience: 'owner', informContactIds: ['cont_beta'] }));
    expect(notifySuccess).toHaveBeenCalledWith(SEND_KEYS.sent);
  });

  it('το email δεν έφυγε ⇒ η γραμμή το ΛΕΕΙ («δεν έφυγε — ξαναστείλτε»), και το κουμπί γίνεται «Ξαναστείλτε»', () => {
    const requested = recordOf([...QUOTED, REQUEST]);
    const failed = withIssuanceDelivery(requested, 'diin_1', { recipient: 'failed', coOwners: {} });
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: failed ?? requested }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(LINK_HISTORY_KEYS.notDelivered)).toBeTruthy();
    expect(within(article()).getByRole('button', { name: SEND_KEYS.ownerResend })).toBeTruthy();
  });

  it('§30 — γεγονότα του παρόχου: «παραδόθηκε» ήσυχα · «επέστρεψε» / «ανεπιθύμητο» ως συναγερμός · επιστροφή συνιδιοκτήτη ΔΕΝ μετρά', () => {
    const requested = recordOf([...QUOTED, REQUEST]);
    const cases = [
      [{ recipient: 'delivered', coOwners: { cont_beta: 'delivered' } }, DELIVERY_HISTORY_KEYS.delivered, false],
      [{ recipient: 'bounced', coOwners: { cont_beta: 'bounced' } }, DELIVERY_HISTORY_KEYS.bounced, true],
      [{ recipient: 'complained', coOwners: {} }, DELIVERY_HISTORY_KEYS.complained, true],
    ] as const;
    for (const [delivery, key, alarm] of cases) {
      const record = withIssuanceDelivery(requested, 'diin_1', delivery) ?? requested;
      registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record }]);
      const { unmount } = render(<DocumentRegistryContent />);
      expect(within(article()).getByText(key).className.includes('text-destructive')).toBe(alarm);
      expect(within(article()).queryByText(LINK_HISTORY_KEYS.notDelivered)).toBeNull();
      // «Ενημερώθηκαν Ν»: όποιος έλαβε το μήνυμα μετρά· όποιου επέστρεψε, όχι.
      const informed = within(article()).queryByText(`${LINK_HISTORY_KEYS.informed} ${JSON.stringify({ count: '1' })}`);
      expect(informed !== null).toBe(delivery.coOwners.cont_beta === 'delivered');
      unmount();
    }
  });
});

describe('ADR-915 §29 — κωδικός πρόσβασης: ο διακόπτης, η ΜΙΑ εμφάνιση, οι γραμμές ιστορικού', () => {
  const PREVIEW = {
    audience: 'owner', recipient: { contactId: 'cont_alpha', name: 'Άλφα', email: 'alfa@example.test' },
    subject: 'Θέμα προεπισκόπησης', text: 'Κείμενο προεπισκόπησης', coOwners: [], coOwnerMessage: null,
  };

  beforeEach(() => {
    preview.mockReset().mockResolvedValue({ kind: 'ok', data: { preview: PREVIEW } });
    send.mockReset().mockResolvedValue({ kind: 'ok', data: { stage: 'proposed', delivery: { recipient: 'accepted', coOwners: {} }, accessCode: '042917' } });
  });

  async function openSend(): Promise<HTMLElement> {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf(QUOTED) }]);
    render(<DocumentRegistryContent />);
    await userEvent.setup().click(within(article()).getByRole('button', { name: SEND_KEYS.ownerTrigger }));
    return screen.findByRole('dialog');
  }

  async function submitWhenReady(dialog: HTMLElement): Promise<void> {
    await within(dialog).findByText('Θέμα προεπισκόπησης', {}, { timeout: 2000 });
    const submit = within(dialog).getByRole('button', { name: SEND_KEYS.submit });
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false), { timeout: 2000 });
    await userEvent.setup().click(submit);
  }

  it('🔴 ενεργός από προεπιλογή: η προεπισκόπηση και η αποστολή ζητούν κωδικό', async () => {
    const dialog = await openSend();
    expect(within(dialog).getByRole('switch', { name: SEND_KEYS.accessCodeLabel }).getAttribute('aria-checked')).toBe('true');
    await submitWhenReady(dialog);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ requireAccessCode: true }));
  });

  it('μετά την αποστολή ο κωδικός φαίνεται ΜΙΑ φορά, σε ομάδες υπαγόρευσης — ο διάλογος ΔΕΝ κλείνει μόνος του', async () => {
    const dialog = await openSend();
    await submitWhenReady(dialog);
    expect(await within(dialog).findByText('042 917')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: SEND_KEYS.codeCopy })).toBeTruthy();
    await userEvent.setup().click(within(dialog).getByRole('button', { name: SEND_KEYS.codeDone }));
    await waitFor(() => expect(screen.queryByText('042 917')).toBeNull());
  });

  it('διακόπτης κλειστός ⇒ αποστολή χωρίς κωδικό', async () => {
    send.mockResolvedValue({ kind: 'ok', data: { stage: 'proposed', delivery: { recipient: 'accepted', coOwners: {} }, accessCode: null } });
    const dialog = await openSend();
    await userEvent.setup().click(within(dialog).getByRole('switch', { name: SEND_KEYS.accessCodeLabel }));
    await waitFor(() => expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ requireAccessCode: false })), { timeout: 2000 });
    await submitWhenReady(dialog);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ requireAccessCode: false }));
  });

  it('ιστορικό: «με κωδικό πρόσβασης» στο αίτημα· «επιβεβαιώθηκε με τον κωδικό» στην απόφαση', () => {
    const requested = recordOf([...QUOTED, { kind: 'request-approval', invitationId: 'diin_1', ownerContactId: 'cont_alpha', note: null, verification: 'access-code' }]);
    const decided: IssuanceAssignmentRecord = {
      ...requested,
      decision: { basis: 'owner-link-approval', invitationId: 'diin_1', verifiedBy: 'access-code', outcome: 'approved', quoteRevision: 1, ownerContactId: 'cont_alpha', ownerAttestation: null, note: null, at: '2026-10-11T09:00:00.000Z' },
    };
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: decided }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(LINK_HISTORY_KEYS.withAccessCode)).toBeTruthy();
    expect(within(article()).getByText(LINK_HISTORY_KEYS.verifiedByCode)).toBeTruthy();
  });
});

describe('ADR-915 §31 — αυτόματες υπενθυμίσεις: ο διακόπτης και οι γραμμές ιστορικού', () => {
  const PREVIEW = {
    audience: 'owner', recipient: { contactId: 'cont_alpha', name: 'Άλφα', email: 'alfa@example.test' },
    subject: 'Θέμα προεπισκόπησης', text: 'Κείμενο προεπισκόπησης', coOwners: [], coOwnerMessage: null,
  };
  /** Το αίτημα στάλθηκε `ACTOR.nowIso` (10/10) ⇒ ο σύνδεσμος λήγει 7 ημέρες μετά. */
  const EXPIRES = '2026-10-17T09:00:00.000Z';
  const REQUEST: IssuanceAction = { kind: 'request-approval', invitationId: 'diin_1', ownerContactId: 'cont_alpha', note: null, verification: 'link' };

  beforeEach(() => {
    preview.mockReset().mockResolvedValue({ kind: 'ok', data: { preview: PREVIEW } });
    send.mockReset().mockResolvedValue({ kind: 'ok', data: { stage: 'proposed', delivery: { recipient: 'accepted', coOwners: {} }, accessCode: null } });
  });

  async function openSend(): Promise<HTMLElement> {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf(QUOTED) }]);
    render(<DocumentRegistryContent />);
    await userEvent.setup().click(within(article()).getByRole('button', { name: SEND_KEYS.ownerTrigger }));
    return screen.findByRole('dialog');
  }

  async function submitWhenReady(dialog: HTMLElement): Promise<void> {
    await within(dialog).findByText('Θέμα προεπισκόπησης', {}, { timeout: 2000 });
    const submit = within(dialog).getByRole('button', { name: SEND_KEYS.submit });
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false), { timeout: 2000 });
    await userEvent.setup().click(submit);
  }

  /** Αίτημα που έφυγε, με πρόγραμμα, και (προαιρετικά) μία υπενθύμιση που ήδη στάλθηκε. */
  function requestWithReminders(sentOne: boolean): IssuanceAssignmentRecord {
    const requested = recordOf([...QUOTED, REQUEST]);
    const delivered = withIssuanceDelivery(requested, 'diin_1', { recipient: 'accepted', coOwners: {} }) ?? requested;
    const planned = planIssuanceReminders(delivered, 'diin_1', EXPIRES) ?? delivered;
    const dueAt = planned.approvalRequest?.reminders?.dueAt ?? '';
    return sentOne ? withIssuanceReminderSent(planned, 'diin_1', { dueAt, sentAt: dueAt, expiresAt: EXPIRES }) ?? planned : planned;
  }

  const startsWith = (key: string) => (content: string) => content.startsWith(key);

  it('🔴 ενεργές από προεπιλογή, οι ημέρες από την ΠΟΛΙΤΙΚΗ — η αποστολή τις ζητά', async () => {
    const dialog = await openSend();
    expect(within(dialog).getByRole('switch', { name: SEND_KEYS.remindersLabel }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByText(`${SEND_KEYS.remindersHint} ${JSON.stringify({ days: 3 })}`)).toBeTruthy();
    await submitWhenReady(dialog);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ sendReminders: true }));
  });

  it('διακόπτης κλειστός ⇒ αποστολή χωρίς υπενθυμίσεις', async () => {
    const dialog = await openSend();
    await userEvent.setup().click(within(dialog).getByRole('switch', { name: SEND_KEYS.remindersLabel }));
    await waitFor(() => expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ sendReminders: false })), { timeout: 2000 });
    await submitWhenReady(dialog);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ sendReminders: false }));
  });

  it('ιστορικό: «στάλθηκε υπενθύμιση» για όσες έφυγαν + «επόμενη» ΜΟΝΟ όσο περιμένουμε απάντηση', () => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: requestWithReminders(true) }]);
    const { unmount } = render(<DocumentRegistryContent />);
    expect(within(article()).getAllByText(startsWith(LINK_HISTORY_KEYS.reminderSent))).toHaveLength(1);
    expect(within(article()).getAllByText(startsWith(LINK_HISTORY_KEYS.reminderNext))).toHaveLength(1);
    unmount();

    const answered: IssuanceAssignmentRecord = {
      ...requestWithReminders(true),
      decision: { basis: 'owner-link-approval', invitationId: 'diin_1', verifiedBy: 'link', outcome: 'approved', quoteRevision: 1, ownerContactId: 'cont_alpha', ownerAttestation: null, note: null, at: '2026-10-11T09:00:00.000Z' },
    };
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: answered }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getAllByText(startsWith(LINK_HISTORY_KEYS.reminderSent))).toHaveLength(1);
    expect(within(article()).queryByText(startsWith(LINK_HISTORY_KEYS.reminderNext))).toBeNull();
  });
});

/**
 * ADR-915 §45 Φ2 — η ΠΡΟΘΕΣΜΙΑ ΠΑΡΑΔΟΣΗΣ όπως τη βλέπει ο άνθρωπος. Ημερολόγιο του fixture: έγκριση το Σάββατο 10/10
 * (`ACTOR`), «σήμερα» του μητρώου 15/10 (`asOf`), και το κενό p6 μπλοκάρει μεταβίβαση **σήμερα** (ημέρα υπογραφής 15/10).
 *  - 5 εργάσιμες ⇒ έως Παρ. 16/10 ⇒ «λήγει σε 1 ημέρα» **και** μετά την υπογραφή
 *  - 1 εργάσιμη ⇒ έως Δευ. 12/10 ⇒ «καθυστερεί 3 ημέρες»
 */
describe('ADR-915 §45 Φ2 — προθεσμία παράδοσης: κελί · πάνελ · «Καθυστερούν» · έγκριση', () => {
  const ROW = 'missing:p6:energy-certificate';
  const tableRow = () => window.document.querySelector(`tbody tr[data-row-id="${ROW}"]`) as HTMLElement;
  const startsWith = (key: string) => (content: string) => content.startsWith(key);
  const OVERDUE: IssuanceAction[] = [PROPOSE, NOTIFY, { kind: 'quote', terms: { ...FIRM_TERMS, deliveryBusinessDays: 1 } }, APPROVE];

  const renderWith = (record: IssuanceAssignmentRecord, url = `/document-expiry?doc=${encodeURIComponent(ROW)}`) => {
    window.history.replaceState(null, '', url);
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record }]);
    render(<DocumentRegistryContent />);
  };

  /** Προσφορά πριν από τη Φ2 (χωρίς χρόνο), όπως τη διαβάζει ο δίσκος. */
  const legacyAccepted = (): IssuanceAssignmentRecord => {
    const record = recordOf(ACCEPTED);
    return { ...record, quote: record.quote === null ? null : { ...record.quote, deliveryBusinessDays: null } };
  };

  it('κελί: «· έως 16/10» + «λήγει σε 1 ημέρα» + «μετά την υπογραφή» — σχήμα και λέξη, όχι μόνο χρώμα', () => {
    renderWith(recordOf(ACCEPTED));
    const row = tableRow();
    expect(within(row).getByText(`${DELIVERY_KEYS.until} ${JSON.stringify({ date: formatDate('2026-10-16') })}`)).toBeTruthy();
    expect(within(row).getByText(`${DELIVERY_TIER_KEYS['due-soon']} ${JSON.stringify({ count: 1 })}`)).toBeTruthy();
    expect(within(row).getByText(DELIVERY_KEYS.missesSigningShort)).toBeTruthy();
  });

  it('κελί: πέρασε η προθεσμία ⇒ «καθυστερεί 3 ημέρες»', () => {
    renderWith(recordOf(OVERDUE));
    expect(within(tableRow()).getByText(`${DELIVERY_TIER_KEYS.overdue} ${JSON.stringify({ count: 3 })}`)).toBeTruthy();
  });

  it('πριν από την έγκριση (`quoted`) ⇒ ΚΑΜΙΑ προθεσμία στο κελί (υπόσχεση, όχι δέσμευση)', () => {
    renderWith(recordOf(QUOTED));
    expect(within(tableRow()).queryByText(startsWith(DELIVERY_KEYS.until))).toBeNull();
    expect(within(tableRow()).queryByText(startsWith(DELIVERY_TIER_KEYS['no-due-date']))).toBeNull();
  });

  it('πάνελ: προθεσμία + «από την προσφορά (5 εργάσιμες)» + η σύγκρουση με ΤΙΣ ΔΥΟ ημερομηνίες + «Αλλαγή προθεσμίας»', () => {
    renderWith(recordOf(ACCEPTED));
    const card = article();
    expect(within(card).getByText(`${DELIVERY_KEYS.line} ${JSON.stringify({ date: formatDate('2026-10-16') })}`)).toBeTruthy();
    expect(within(card).getByText(`${DELIVERY_SOURCE_KEYS.quote} ${JSON.stringify({ count: 5 })}`)).toBeTruthy();
    expect(within(card).getByText(
      `${DELIVERY_KEYS.missesSigning} ${JSON.stringify({ due: formatDate('2026-10-16'), signing: formatDate('2026-10-15') })}`,
    )).toBeTruthy();
    expect(within(card).getByRole('button', { name: DELIVERY_KEYS.changeTrigger })).toBeTruthy();
  });

  it('🔴 αλλαγή προθεσμίας: νέα ημερομηνία ΧΩΡΙΣ αιτιολογία ⇒ το κουμπί μένει ανενεργό · με αιτιολογία ⇒ `schedule-delivery`', async () => {
    renderWith(recordOf(ACCEPTED));
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: DELIVERY_KEYS.changeTrigger }));
    const dialog = await screen.findByRole('dialog');
    const date = await within(dialog).findByLabelText(DELIVERY_KEYS.dateLabel);
    const submit = within(dialog).getByRole('button', { name: DELIVERY_KEYS.submit });
    expect(submit.hasAttribute('disabled')).toBe(true); // ίδια ημερομηνία ⇒ τίποτα να σταλεί
    fireEvent.change(date, { target: { value: '2026-10-30' } });
    expect(submit.hasAttribute('disabled')).toBe(true); // αλλαγή χωρίς αιτιολογία ⇒ όχι
    await user.type(within(dialog).getByLabelText(DELIVERY_KEYS.reasonLabel), 'αυτοψία μετατέθηκε');
    expect(submit.hasAttribute('disabled')).toBe(false);
    await user.click(submit);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      action: 'schedule-delivery', propertyId: 'p6', documentKind: 'energy-certificate', expectedStage: 'accepted',
      dueOn: '2026-10-30', reason: 'αυτοψία μετατέθηκε',
    }));
  });

  it('προσφορά πριν από τη Φ2 ⇒ «χωρίς προθεσμία» + «Ορισμός προθεσμίας», που ΔΕΝ ζητά αιτιολογία', async () => {
    renderWith(legacyAccepted());
    expect(within(tableRow()).getByText(DELIVERY_TIER_KEYS['no-due-date'])).toBeTruthy();
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: DELIVERY_KEYS.setTrigger }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(await within(dialog).findByLabelText(DELIVERY_KEYS.dateLabel), { target: { value: '2026-10-30' } });
    await user.click(within(dialog).getByRole('button', { name: DELIVERY_KEYS.submit }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ action: 'schedule-delivery', dueOn: '2026-10-30', reason: null }));
  });

  it('χωρίς δικαίωμα ⇒ η προθεσμία φαίνεται, το κουμπί αλλαγής ΟΧΙ', () => {
    verdict = 'denied-permission';
    renderWith(recordOf(ACCEPTED));
    expect(within(article()).getByText(startsWith(DELIVERY_KEYS.line))).toBeTruthy();
    expect(within(article()).queryByRole('button', { name: DELIVERY_KEYS.changeTrigger })).toBeNull();
  });

  it('«Καθυστερούν»: ΜΟΝΟ η καθυστερημένη γραμμή, με μετρητή στην καρτέλα', () => {
    renderWith(recordOf(OVERDUE), '/document-expiry?tab=late');
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain(REGISTRY_TAB_LABEL_KEYS.late);
    const shown = Array.from(window.document.querySelectorAll('tbody tr[data-row-id]')).map((row) => row.getAttribute('data-row-id'));
    expect(shown).toEqual([ROW]);
  });

  it('«Καθυστερούν» χωρίς καθυστέρηση ⇒ ρητή κενή κατάσταση (εντός προθεσμίας ≠ καθυστερεί)', () => {
    renderWith(recordOf(ACCEPTED), '/document-expiry?tab=late');
    expect(screen.getByText(LAYOUT_KEYS.lateEmpty)).toBeTruthy();
  });

  it('🏆 Α4 — στην έγκριση: «έως <ημ.>, αν εγκριθεί σήμερα» ΚΑΙ η προειδοποίηση «μετά την υπογραφή», πριν δεσμευτεί κανείς', async () => {
    renderWith(recordOf(QUOTED));
    await userEvent.setup().click(within(article()).getByRole('button', { name: ISSUANCE_KEYS.recordDecision }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(startsWith(DELIVERY_KEYS.ifApprovedToday))).toBeTruthy();
    // Η υπογραφή του p6 είναι «σήμερα» του μητρώου (15/10)· κάθε έγκριση από σήμερα και μετά πέφτει αργότερα.
    expect(within(dialog).getByRole('alert').textContent?.startsWith(DELIVERY_KEYS.missesSigning)).toBe(true);
  });
});

describe('ADR-915 §45.15 — υπεύθυνος αυτοψίας στο πάνελ του γραφείου', () => {
  const renderWith = (record: IssuanceAssignmentRecord) => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record }]);
    render(<DocumentRegistryContent />);
  };

  it('χωρίς ορισμό ⇒ «δεν έχει οριστεί»· η φόρμα προτείνει τον υπεύθυνο του ακινήτου ως «Ιδιοκτήτη» ⇒ ΕΝΑ πάτημα', async () => {
    renderWith(recordOf(QUOTED));
    expect(within(article()).getByText(INSPECTION_KEYS.none)).toBeTruthy();
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: INSPECTION_KEYS.setTrigger }));
    const dialog = await screen.findByRole('dialog');
    expect((await within(dialog).findByRole('radio', { name: new RegExp(INSPECTION_KEYS.whoLead) })).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByRole('radio', { name: INSPECTION_ROLE_LABEL_KEYS.owner }).getAttribute('aria-checked')).toBe('true');
    await user.click(within(dialog).getByRole('button', { name: INSPECTION_KEYS.submit }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      action: 'set-inspection-contact', propertyId: 'p6', documentKind: 'energy-certificate', expectedStage: 'quoted',
      contactId: 'cont_alpha', role: 'owner', roleOther: null,
    }));
  });

  it('🔴 «Άλλο» χωρίς κείμενο ⇒ ανενεργό· με κείμενο ⇒ στέλνεται κομμένο', async () => {
    renderWith(recordOf(QUOTED));
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: INSPECTION_KEYS.setTrigger }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('radio', { name: INSPECTION_ROLE_LABEL_KEYS.other }));
    const submit = within(dialog).getByRole('button', { name: INSPECTION_KEYS.submit });
    expect(submit.hasAttribute('disabled')).toBe(true);
    await user.type(within(dialog).getByLabelText(INSPECTION_KEYS.roleOtherLabel), '  Θυρωρός ');
    await user.click(submit);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ action: 'set-inspection-contact', role: 'other', roleOther: 'Θυρωρός' }));
  });

  it('με ορισμό ⇒ η γραμμή δείχνει ιδιότητα · ίδιος ορισμός ⇒ τίποτα να σταλεί', async () => {
    renderWith(recordOf([...QUOTED, { kind: 'set-inspection-contact', contactId: 'cont_alpha', role: 'tenant', roleOther: null }]));
    expect(within(article()).getByText(new RegExp(`\\(${INSPECTION_ROLE_LABEL_KEYS.tenant}\\)`))).toBeTruthy();
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: INSPECTION_KEYS.changeTrigger }));
    const dialog = await screen.findByRole('dialog');
    const submit = await within(dialog).findByRole('button', { name: INSPECTION_KEYS.submit });
    expect(submit.hasAttribute('disabled')).toBe(true);
  });

  it('χωρίς δικαίωμα ⇒ η γραμμή φαίνεται, το κουμπί ΟΧΙ', () => {
    verdict = 'denied-permission';
    renderWith(recordOf(QUOTED));
    expect(within(article()).getByText(INSPECTION_KEYS.none)).toBeTruthy();
    expect(within(article()).queryByRole('button', { name: INSPECTION_KEYS.setTrigger })).toBeNull();
  });
});

describe('ADR-915 §45.15 (1β-γ-2) — ό,τι δήλωσε ο ιδιοκτήτης στην έγκριση, στο πάνελ του γραφείου', () => {
  /** Αναληφθείσα ανάθεση με τεκμήριο: άλφα διορθώθηκε (η επαφή έχει άλλο) · γάμμα διορθώθηκε (η επαφή δεν έχει) ·
   *  δέλτα διορθώθηκε στο ΙΔΙΟ που ήδη έχει ⇒ καμία εκκρεμότητα. */
  function renderAttested(missingNote: string | null) {
    const accepted = recordOf(ACCEPTED);
    if (accepted.decision === null) throw new Error('no decision');
    const record: IssuanceAssignmentRecord = {
      ...accepted,
      decision: {
        ...accepted.decision,
        ownerAttestation: {
          owners: [
            { contactId: 'cont_alpha', verdict: 'corrected', vatNumber: '998877666' },
            { contactId: 'cont_gamma', verdict: 'corrected', vatNumber: '123456783' },
            { contactId: 'cont_delta', verdict: 'corrected', vatNumber: '090000045' },
          ],
          missingNote,
        },
      },
    };
    const base = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record }]);
    registry = {
      ...base,
      people: {
        ...base.people,
        cont_alpha: { ...base.people.cont_alpha, vatNumber: '111111111' },
        cont_delta: { ...base.people.cont_delta, vatNumber: '090 000 045' },
      },
    };
    render(<DocumentRegistryContent />);
  }

  it('εκκρεμεί ΜΟΝΟ ό,τι η επαφή δεν έχει· «Εφαρμογή στην επαφή» στέλνει ΤΟ ΤΕΚΜΗΡΙΟ και ξαναφορτώνει', async () => {
    renderAttested(null);
    const section = within(article()).getByRole('region', { name: OWNER_VAT_KEYS.heading });
    expect(within(section).getByText(`${OWNER_VAT_KEYS.pending} ${JSON.stringify({ name: 'Συνθετικός Άλφα', vat: '998877666', current: '111111111' })}`)).toBeTruthy();
    expect(within(section).getByText(`${OWNER_VAT_KEYS.pendingNoCurrent} ${JSON.stringify({ name: 'Συνθετικός Γάμμα', vat: '123456783' })}`)).toBeTruthy();
    expect(within(section).queryByText(/Συνθετικός Δέλτα/)).toBeNull();
    const buttons = within(section).getAllByRole('button', { name: OWNER_VAT_KEYS.apply });
    expect(buttons).toHaveLength(2);
    await userEvent.setup().click(buttons[0]);
    await waitFor(() => expect(revalidate).toHaveBeenCalled());
    expect(applyVat).toHaveBeenCalledWith({ propertyId: 'p6', documentKind: 'energy-certificate', contactId: 'cont_alpha', vatNumber: '998877666' });
    expect(notifySuccess).toHaveBeenCalledWith(OWNER_VAT_KEYS.applied);
  });

  it('χωρίς δικαίωμα ⇒ η εκκρεμότητα φαίνεται, κανένα κουμπί· η σημείωση «λείπει κάποιος» φαίνεται', () => {
    verdict = 'denied-permission';
    renderAttested('Δέλτα Συνθετικός');
    const section = within(article()).getByRole('region', { name: OWNER_VAT_KEYS.heading });
    expect(within(section).queryByRole('button', { name: OWNER_VAT_KEYS.apply })).toBeNull();
    expect(within(section).getByText(`${OWNER_VAT_KEYS.missingNote} ${JSON.stringify({ note: 'Δέλτα Συνθετικός' })}`)).toBeTruthy();
  });

  it('καμία εκκρεμότητα και καμία σημείωση ⇒ καμία ενότητα', () => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf(ACCEPTED) }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).queryByRole('region', { name: OWNER_VAT_KEYS.heading })).toBeNull();
  });
});
