/**
 * 🔴 ΑΓΚΥΡΑ Ζ9 — **Η ΓΚΑΛΕΡΙ ΤΗΣ ΚΑΡΤΕΛΑΣ «ΠΑΡΑΔΟΣΗ» ΔΕΙΧΝΕΙ ΚΑΘΕ ΛΟΓΟ, ΜΕ ΤΑ ΔΙΚΑ ΤΟΥ ΛΟΓΙΑ** (ADR-916 §5.15 Φ-Δ).
 * @related components/property-handover-office/testing/* · πρότυπο `handover-protocol-verify-gallery.test.tsx`
 *
 * Ρωτά **μόνο** όσα δεν ρωτούν οι άλλες άγκυρες (η κρίση = Ζ1–Ζ7, η πόρτα = Ζ8):
 *   Α — κάθε πάνελ αποδίδει τον λόγο του σεναρίου του, με τίτλο **και** οδηγία (ποτέ ωμή κατάσταση);
 *   Β — η κάρτα Πρωτοκόλλου εμφανίζεται **μόνο** όπου σφραγίστηκε, με το αντίτυπο **εταιρείας** και παραπομπή στη Σ6·
 *       καμία λέξη «επαληθευμένο» πουθενά;
 *   Γ — η σειρά «κίνηση γραφείου πρώτα», η σημείωση σφραγίδας, και κανένα αίτημα δεν φεύγει από τη σελίδα.
 */

jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }) }));
jest.mock('@/lib/intl-formatting', () => ({
  formatDate: (iso: string) => `date(${iso})`,
  formatDateTime: (iso: string) => `abs(${iso})`,
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
jest.mock('@/components/shared/files/hooks/useFileDownload', () => ({ useFileDownload: () => ({ handleDownload: jest.fn() }) }));

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import el from '@/i18n/locales/el/properties-detail.json';
import en from '@/i18n/locales/en/properties-detail.json';
import { apiClient } from '@/lib/api/enterprise-api-client';
import {
  HANDOVER_INVITATION_RENEWAL_REFUSALS,
  HANDOVER_OFFICE_MOVES,
  HANDOVER_OFFICE_REASONS,
  HANDOVER_OFFICE_SIGNALS,
  HANDOVER_OFFICE_STEP_STATES,
  HANDOVER_OFFICE_STEPS,
  HANDOVER_WITHDRAWAL_REFUSALS,
  PROPERTY_HANDOVER_WITHDRAWAL_NOTICE_DELIVERIES,
} from '@/types/property-handover';
import {
  HANDOVER_DISPOSITION_BASES,
  HANDOVER_FILE_DECISION_CHOICES,
  HANDOVER_FILE_DECISION_DISPOSITIONS,
  HANDOVER_FILE_DECISION_REFUSALS,
} from '@/types/property-handover-file-decision';

import { HANDOVER_FILE_SCENARIOS, scenarioPreviewFileOf } from '../testing/handover-file-decision-scenarios';
import { HANDOVER_OFFICE_SCENARIOS } from '../testing/handover-office-scenarios';
import { PANEL_COUNT, PropertyHandoverOfficeHarness } from '../testing/PropertyHandoverOfficeHarness';

const K = 'properties-detail:handover';
const panel = (id: string) => screen.getByTestId(`harness-panel-${id}`);

beforeEach(() => render(<PropertyHandoverOfficeHarness />));

describe('Ζ9 Α — ένα πάνελ ανά λόγο, με τα δικά του λόγια', () => {
  it.each(HANDOVER_OFFICE_SCENARIOS.map((s) => [s.id, s.expected.reason] as const))('%s ⇒ %s', (id, reason) => {
    const scoped = within(panel(id));
    expect(panel(id).querySelector('[data-reason]')).toHaveAttribute('data-reason', reason);
    expect(scoped.getByText(`${K}.reason.${reason}.title`)).toBeInTheDocument();
    expect(scoped.getByText(`${K}.reason.${reason}.hint`)).toBeInTheDocument();
  });

  it('τα πάνελ είναι όσα δηλώνει η γκαλερί', () => {
    expect(screen.getAllByTestId(/^harness-panel-/)).toHaveLength(PANEL_COUNT);
  });

  it('το σήμα «λήγει σύντομα» και τα αρχεία που περιμένουν απόφαση φαίνονται στα πάνελ τους', () => {
    expect(panel('awaiting-buyer-expiring').querySelector('[data-signal="invitation-expiring"]')).not.toBeNull();
    expect(panel('files-awaiting-review').querySelector('[data-signal="files-awaiting-review"]')).not.toBeNull();
  });
});

describe('Ζ9 Β — Πρωτόκολλο: μόνο όπου σφραγίστηκε, αντίτυπο εταιρείας, ποτέ «επαληθευμένο»', () => {
  it('η κάρτα Πρωτοκόλλου και η παραπομπή επαλήθευσης ζουν ΜΟΝΟ όπου σφραγίστηκε — και ΜΕΝΟΥΝ μετά την ανάκληση (Φ-Δ.5 · Ε2)', () => {
    const withVerifyLink = HANDOVER_OFFICE_SCENARIOS.filter((s) => within(panel(s.id)).queryByText(`${K}.verify`) !== null).map((s) => s.id);
    expect(withVerifyLink).toEqual(HANDOVER_OFFICE_SCENARIOS.filter((s) => s.handover.protocol !== null).map((s) => s.id));
    expect(withVerifyLink).toEqual(expect.arrayContaining(['sealed', 'withdrawn']));
    expect(within(panel('sealed')).getByText(`${K}.verify`).closest('a')).toHaveAttribute('href', expect.stringMatching(/\/verify\/phpr_/));
  });

  it('καμία λέξη «verified» / «επαληθευμένο» σε όλη τη γκαλερί', () => {
    expect(document.body.textContent ?? '').not.toMatch(/verified|επαληθευμ/i);
  });
});

describe('Ζ9 Δ — κάθε λέξη του λεξιλογίου έχει κείμενο ΚΑΙ στις δύο γλώσσες (τα δυναμικά κλειδιά δεν τα βλέπει το CHECK 3.8)', () => {
  const vocabularyKeys = [
    ...HANDOVER_OFFICE_REASONS.flatMap((reason) => [`reason.${reason}.title`, `reason.${reason}.hint`]),
    ...HANDOVER_OFFICE_MOVES.flatMap((move) => [`move.${move}`, `summary.${move}`]),
    ...HANDOVER_OFFICE_SIGNALS.map((signal) => `signal.${signal}`),
    ...HANDOVER_OFFICE_STEPS.map((step) => `step.${step}`),
    ...HANDOVER_OFFICE_STEP_STATES.map((state) => `stepState.${state}`),
    ...HANDOVER_INVITATION_RENEWAL_REFUSALS.map((reason) => `renewal.refusal.${reason}`),
    ...['action', 'busy', 'confirmTitle', 'confirmDescription', 'confirmAction', 'success', 'failed'].map((key) => `renewal.${key}`),
    // Φ-Δ.4 — η απόφαση ανά αρχείο.
    ...HANDOVER_DISPOSITION_BASES.map((basis) => `files.basis.${basis}`),
    ...HANDOVER_FILE_DECISION_CHOICES.map((choice) => `fileDecision.choice.${choice}`),
    ...HANDOVER_FILE_DECISION_DISPOSITIONS.map((disposition) => `fileDecision.decided.${disposition}`),
    ...['deliver', 'review', 'internal'].map((automatic) => `fileDecision.automaticMeans.${automatic}`),
    ...HANDOVER_FILE_DECISION_REFUSALS.map((reason) => `fileDecision.refusal.${reason}`),
    ...['action', 'busy', 'title', 'description', 'choiceLabel', 'reasonLabel', 'confirmConfidential', 'confirmAction', 'success', 'failed']
      .map((key) => `fileDecision.${key}`),
    'fileDecision.blocked.already-delivered', 'files.confidential', 'files.delivered',
    // Φ-Δ.5 — η ανάκληση.
    ...HANDOVER_WITHDRAWAL_REFUSALS.map((reason) => `withdrawal.refusal.${reason}`),
    ...['action', 'title', 'description', 'means.kept', 'means.stops', 'means.notice', 'reasonLabel', 'confirmIrreversible', 'confirmAction', 'success', 'failed']
      .map((key) => `withdrawal.${key}`),
    ...PROPERTY_HANDOVER_WITHDRAWAL_NOTICE_DELIVERIES.map((delivery) => `facts.withdrawalNoticeValue.${delivery}`),
    'facts.withdrawnAt', 'facts.withdrawalReason', 'facts.withdrawalNotice',
  ];
  const lookup = (bundle: unknown, path: string): unknown =>
    path.split('.').reduce<unknown>((node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined), bundle);

  it.each([['el', el], ['en', en]] as const)('%s', (_, bundle) => {
    const missing = vocabularyKeys.filter((key) => typeof lookup(bundle, `handover.${key}`) !== 'string');
    expect(missing).toEqual([]);
  });
});

describe('Ζ17γ — «Νέα πρόσκληση» (Φ-Δ.3): το κουμπί ζει ΜΟΝΟ όπου η κρίση το προσφέρει', () => {
  it('μόνο στα πάνελ «έληξε» και «αρνήθηκε»', () => {
    const withButton = HANDOVER_OFFICE_SCENARIOS.filter((s) => within(panel(s.id)).queryByText(`${K}.renewal.action`) !== null).map((s) => s.id);
    expect(withButton.sort()).toEqual(['declined', 'invitation-expired']);
  });

  it('σε εξέλιξη ⇒ «Αποστολή…», και κανένα δεύτερο κλικ', () => {
    const button = within(panel('renewal-in-flight')).getByRole('button', { name: `${K}.renewal.busy` });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Ζ29β — «Απόφαση για αρχείο» (Φ-Δ.4): η γραμμή λέει ΓΙΑΤΙ, και το κουμπί ζει ΜΟΝΟ όπου η κρίση το προσφέρει', () => {
  const rows = () => [...panel('whole-tab-mixed').querySelectorAll<HTMLElement>('li[data-file]')];
  const row = (scenarioId: string) => panel('whole-tab-mixed').querySelector<HTMLElement>(`li[data-file="f_${scenarioId}"]`);

  it('μία γραμμή ανά σενάριο, με τον λόγο κατάταξης από την κρίση', () => {
    expect(rows()).toHaveLength(HANDOVER_FILE_SCENARIOS.length);
    for (const scenario of HANDOVER_FILE_SCENARIOS) {
      const expected = scenarioPreviewFileOf(scenario);
      expect(row(scenario.id)).toHaveAttribute('data-basis', expected.basis);
      expect(within(row(scenario.id) as HTMLElement).getByText(`${K}.files.basis.${expected.basis}`)).toBeInTheDocument();
    }
  });

  it('το κουμπί «Απόφαση…» ⇔ ανοιχτή προσφορά · το «παραδόθηκε, μένει» φαίνεται όπου κλειδώνει', () => {
    const withButton = HANDOVER_FILE_SCENARIOS.filter((s) => within(row(s.id) as HTMLElement).queryByText(`${K}.fileDecision.action`) !== null);
    expect(withButton.map((s) => s.id).sort()).toEqual(HANDOVER_FILE_SCENARIOS.filter((s) => scenarioPreviewFileOf(s).offer.kind === 'open').map((s) => s.id).sort());
    expect(within(row('decision-deliver-delivered') as HTMLElement).getByText(`${K}.fileDecision.blocked.already-delivered`)).toBeInTheDocument();
  });

  it('ο διάλογος: μόνο οι προσφερόμενες επιλογές · αιτιολογία ΚΑΙ επιβεβαίωση εμπιστευτικού πριν ενεργοποιηθεί η αποθήκευση', () => {
    fireEvent.click(within(row('review-confidential') as HTMLElement).getByText(`${K}.fileDecision.action`));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(`${K}.fileDecision.choice.deliver`)).toBeInTheDocument();
    expect(within(dialog).queryByText(`${K}.fileDecision.choice.automatic`)).toBeNull();
    const save = within(dialog).getByRole('button', { name: `${K}.fileDecision.confirmAction` });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Ελέγχθηκε από τον νομικό σύμβουλο' } });
    expect(save).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('checkbox'));
    expect(save).toBeEnabled();
  });
});

describe('Ζ44 — «Ανάκληση παράδοσης» (Φ-Δ.5): ΜΟΝΟ στο Ο4, με αιτιολογία ΚΑΙ επιβεβαίωση, η αιτιολογία μόνο στο γραφείο', () => {
  it('το κουμπί ζει ΜΟΝΟ στο πάνελ «η πώληση άλλαξε μετά την ολοκλήρωση»', () => {
    const withButton = HANDOVER_OFFICE_SCENARIOS.filter((s) => within(panel(s.id)).queryByText(`${K}.withdrawal.action`) !== null).map((s) => s.id);
    expect(withButton).toEqual(['sale-reverted']);
  });

  it('ο διάλογος λέει τι μένει και τι σταματά· «Ανάκληση» ανενεργό ώσπου να υπάρξουν αιτιολογία ΚΑΙ επιβεβαίωση', () => {
    fireEvent.click(within(panel('sale-reverted')).getByRole('button', { name: `${K}.withdrawal.action` }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(`${K}.withdrawal.means.kept`)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: `${K}.withdrawal.confirmAction` });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Η πώληση ακυρώθηκε δικαστικά.' } });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('checkbox'));
    expect(confirm).toBeEnabled();
  });

  it('ανακλημένη: γεγονός «Ανάκληση» + η αιτιολογία + η έκβαση της ειδοποίησης — και ΚΑΝΕΝΑ κουμπί πράξης', () => {
    const card = panel('withdrawn');
    expect(within(card).getByText(`${K}.facts.withdrawnAt`)).toBeInTheDocument();
    expect(within(card).getByText('Η πώληση ακυρώθηκε με δικαστική απόφαση.')).toBeInTheDocument();
    expect(within(card).getByText(`${K}.facts.withdrawalNoticeValue.accepted`)).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: `${K}.withdrawal.action` })).toBeNull();
    expect(within(card).queryByText(`${K}.renewal.action`)).toBeNull();
  });
});

describe('Ζ9 Γ — ολόκληρη η καρτέλα', () => {
  it('«κίνηση γραφείου» πρώτα · η σημείωση σφραγίδας όταν λείπει ο πάροχος', () => {
    const whole = panel('whole-tab-mixed');
    const reasons = [...whole.querySelectorAll('[data-reason]')].map((node) => node.getAttribute('data-reason'));
    expect(reasons[0]).toBe('declined');
    expect(reasons.slice(-2).sort()).toEqual(['cancelled', 'sealed']);
    expect(within(whole).getByText(`${K}.sealNotConfigured`)).toBeInTheDocument();
    expect(whole.querySelector('details[data-group="review"]')).toHaveAttribute('open');
  });

  it('χωρίς παραδόσεις ⇒ ο λόγος που λείπουν, όχι κενό', () => {
    expect(within(panel('whole-tab-empty')).getByText(`${K}.empty`)).toBeInTheDocument();
    expect(within(panel('whole-tab-empty')).queryByText(`${K}.sealNotConfigured`)).toBeNull();
  });

  it('κανένα αίτημα δεν φεύγει από τη σελίδα', () => {
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
