/**
 * Κλείδωμα της ελεγχόμενης καρτέλας του FormTabsShell (ADR-332 D19).
 *
 * ΤΙ ΠΡΟΣΤΑΤΕΥΕΙ: το `initialTab` κατέληγε στο `defaultTab` του `StateTabs`, το
 * οποίο διαβάζεται **μία φορά** στον αρχικοποιητή του `useState`. Κάθε
 * μεταγενέστερη αλλαγή αγνοούνταν σιωπηλά — άρα το `setActiveTab(errorTab)` μετά
 * από αποτυχία επικύρωσης ήταν **νεκρός κώδικας**: ο χρήστης έμενε στην ίδια
 * καρτέλα, χωρίς να δει ποτέ το άκυρο πεδίο, με μόνο σήμα ένα toast.
 *
 * Κλειδώνεται επίσης η δικλείδα «άγνωστο id»: ελεγχόμενη τιμή που δεν αντιστοιχεί
 * σε υπαρκτή καρτέλα θα άφηνε τον πάνακα **κενό** (το Radix δεν αποδίδει άγνωστο
 * value) — συμβαίνει όταν το αποθηκευμένο id ανήκει σε άλλον τύπο επαφής
 * (`addresses` εταιρείας vs `address` φυσικού προσώπου).
 *
 * @module components/generic/__tests__/form-tabs-shell-controlled-tab
 */

import React from 'react';
import { render } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const stateTabsProps: Array<{ value?: string; defaultTab?: string }> = [];

jest.mock('@/components/ui/navigation/state-tabs', () => ({
  StateTabs: (props: { value?: string; defaultTab?: string; children?: React.ReactNode }) => {
    stateTabsProps.push({ value: props.value, defaultTab: props.defaultTab });
    return <div data-testid="state-tabs">{props.children}</div>;
  },
}));

jest.mock('@/components/ui/tabs', () => ({
  TabsContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Το SSoT module εξάγει και components· τα βαριά leaf εξαρτήματα (uploader,
// tabs) δεν αφορούν αυτόν τον έλεγχο καλωδίωσης — ίδιο μοτίβο με το
// `resolve-i18n-key-label.test.ts`.
jest.mock('@/components/ui/MultiplePhotosUpload', () => ({ MultiplePhotosUpload: () => null }));
jest.mock('@/components/ui/navigation/TabsComponents', () => ({ TabsOnlyTriggers: () => null }));

import { FormTabsShell } from '../form-tabs-shell';

const TABS = [
  { id: 'basicInfo', label: 'Βασικά', content: <p>basic</p> },
  { id: 'address', label: 'Διεύθυνση', content: <p>address</p> },
];

/** Η τελευταία τιμή που έφτασε στο StateTabs. */
function lastProps() {
  return stateTabsProps[stateTabsProps.length - 1];
}

describe('FormTabsShell — ελεγχόμενη ενεργή καρτέλα', () => {
  beforeEach(() => {
    stateTabsProps.length = 0;
  });

  it('χωρίς activeTab παραμένει μη ελεγχόμενο (value undefined)', () => {
    render(<FormTabsShell tabs={TABS} initialTab="address" />);

    expect(lastProps().value).toBeUndefined();
    expect(lastProps().defaultTab).toBe('address');
  });

  it('περνά το activeTab ως controlled value', () => {
    render(<FormTabsShell tabs={TABS} initialTab="address" activeTab="address" />);

    expect(lastProps().value).toBe('address');
  });

  it('τιμά αλλαγή του activeTab ΜΕΤΑ το mount — αυτό ήταν ο νεκρός κώδικας', () => {
    const { rerender } = render(
      <FormTabsShell tabs={TABS} initialTab="address" activeTab="address" />,
    );
    expect(lastProps().value).toBe('address');

    rerender(<FormTabsShell tabs={TABS} initialTab="address" activeTab="basicInfo" />);

    expect(lastProps().value).toBe('basicInfo');
  });

  it('αγνοεί activeTab που δεν αντιστοιχεί σε υπαρκτή καρτέλα (αλλιώς κενός πάνακας)', () => {
    render(<FormTabsShell tabs={TABS} initialTab="basicInfo" activeTab="addresses" />);

    expect(lastProps().value).toBeUndefined();
    expect(lastProps().defaultTab).toBe('basicInfo');
  });
});
