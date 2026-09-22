/**
 * @file ADR-598 G11 · §3 procurement — η υποβολή του διαλόγου συμφωνίας-πλαισίου.
 *
 * Πριν (21/09): το κουμπί υποβολής ζούσε ΕΞΩ από το `<form>` χωρίς να ανήκει σε αυτό ⇒
 * κατά την προδιαγραφή HTML (implicit submission) μια φόρμα με πολλά πεδία και **κανένα**
 * κουμπί υποβολής **δεν** υποβάλλεται με Enter: το Enter δεν έκανε τίποτα. Με το `form=`
 * το κουμπί ανήκει ΞΑΝΑ στη φόρμα ⇒ το Enter υποβάλλει ⇒ ο φύλακας `canSubmit` και το
 * κλείδωμα πρέπει να ζουν ΜΕΣΑ στην υποβολή, όχι μόνο στο `disabled` του κουμπιού.
 *
 * - Υ1: Enter χωρίς προμηθευτή ⇒ το `onSubmit` ΔΕΝ καλείται.
 * - Υ2: δύο υποβολές στο ίδιο tick ⇒ **ΜΙΑ** κλήση (κλείδωμα `ref`, όχι state).
 * - Υ3: το κουμπί (στο `DialogFooter`, έξω από το `<form>`) υποβάλλει μέσω `form=`.
 * - Υ4: Enter με όλα τα υποχρεωτικά ⇒ υποβάλλει (HTML implicit submission μέσω `form=` —
 *   βλ. `test-utils/implicit-submission` για το γιατί ΟΧΙ `user.keyboard('{Enter}')`).
 * - Α1: κανένα εύρημα axe.
 */

import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));
jest.mock('@/hooks/procurement/usePOSupplierContacts', () => ({
  usePOSupplierContacts: () => ({ suppliers: [], loading: false, error: null }),
  supplierContactsToOptions: () => [{ value: 'sup-1', label: 'ACME' }],
}));

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { pressEnterToSubmit } from '@/test-utils/implicit-submission';
import { FrameworkAgreementFormDialog } from '../FrameworkAgreementFormDialog';

type SubmitFn = React.ComponentProps<typeof FrameworkAgreementFormDialog>['onSubmit'];
type User = ReturnType<typeof userEvent.setup>;

/** Το modal του Radix βάζει `pointer-events: none` στο body· το jsdom δεν ξέρει το portal. */
const setupUser = (): User => userEvent.setup({ pointerEventsCheck: 0 });

const submitSpy = () => jest.fn<ReturnType<SubmitFn>, Parameters<SubmitFn>>();

function renderDialog(onSubmit: SubmitFn) {
  return render(
    <FrameworkAgreementFormDialog open onOpenChange={() => undefined} initial={null} onSubmit={onSubmit} />,
  );
}

async function fillRequiredTextFields(user: User): Promise<void> {
  await user.type(screen.getByLabelText(/hub\.frameworkAgreements\.form\.agreementNumber/), 'FWA-1');
  await user.type(screen.getByLabelText(/hub\.frameworkAgreements\.form\.title/), 'Τσιμέντο');
}

const titleField = (): HTMLInputElement =>
  screen.getByLabelText<HTMLInputElement>(/hub\.frameworkAgreements\.form\.title/);

const formOf = (): HTMLFormElement => {
  const form = titleField().form;
  if (!form) throw new Error('το πεδίο τίτλου δεν ανήκει σε φόρμα');
  return form;
};

async function pickVendor(user: User): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: /hub\.frameworkAgreements\.form\.vendor/ }));
  await user.click(await screen.findByRole('option', { name: /ACME/ }));
}

describe('FrameworkAgreementFormDialog — υποβολή', () => {
  it('Υ1: Enter χωρίς προμηθευτή ⇒ καμία υποβολή', async () => {
    const user = setupUser();
    const onSubmit = submitSpy().mockResolvedValue();
    renderDialog(onSubmit);

    await fillRequiredTextFields(user);
    pressEnterToSubmit(titleField());
    // Κι ένας δρόμος που ΠΑΡΑΚΑΜΠΤΕΙ το κουμπί (π.χ. `requestSubmit()`): ο φύλακας ζει στην υποβολή.
    fireEvent.submit(formOf());

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Υ2: δύο υποβολές στο ίδιο tick ⇒ ΜΙΑ κλήση', async () => {
    const user = setupUser();
    let release: () => void = () => undefined;
    const onSubmit = submitSpy().mockImplementation(
      () => new Promise<void>((resolve) => { release = resolve; }),
    );
    renderDialog(onSubmit);

    await pickVendor(user);
    await fillRequiredTextFields(user);
    // Δύο υποβολές στο ΙΔΙΟ tick — πριν προλάβει το render να απενεργοποιήσει το κουμπί.
    fireEvent.submit(formOf());
    fireEvent.submit(formOf());
    release();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('Υ3: το κουμπί υποβάλλει μέσω `form=` (ζει έξω από το <form>)', async () => {
    const user = setupUser();
    const onSubmit = submitSpy().mockResolvedValue();
    renderDialog(onSubmit);

    await pickVendor(user);
    await fillRequiredTextFields(user);
    await user.click(screen.getByRole('button', { name: 'hub.frameworkAgreements.form.create' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ vendorContactId: 'sup-1', title: 'Τσιμέντο' });
  });

  it('Υ4: Enter με όλα τα υποχρεωτικά ⇒ υποβάλλει', async () => {
    const user = setupUser();
    const onSubmit = submitSpy().mockResolvedValue();
    renderDialog(onSubmit);

    await pickVendor(user);
    await fillRequiredTextFields(user);
    pressEnterToSubmit(titleField());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});

describe('FrameworkAgreementFormDialog — προσβασιμότητα', () => {
  it('Α1: κανένα εύρημα axe', async () => {
    renderDialog(submitSpy().mockResolvedValue());
    await expectNoA11yViolations(document.body);
  });
});
