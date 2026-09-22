/**
 * @file ADR-598 G11 · §3 procurement — η υποβολή του διαλόγου υλικού.
 *
 * Ίδιο συμβόλαιο με τον διάλογο συμφωνίας-πλαισίου — ΕΝΑΣ δρόμος υποβολής
 * (`useFormSubmission` + `FormActions`):
 * - Υ1: Enter χωρίς όνομα ⇒ καμία υποβολή (και από δρόμο που παρακάμπτει το κουμπί).
 * - Υ2: Enter με κωδικό + όνομα ⇒ υποβάλλει, τιμές μέσω `parseLocaleNumber` ("12,50" ⇒ 12.5).
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
  supplierContactsToOptions: () => [],
}));

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { pressEnterToSubmit } from '@/test-utils/implicit-submission';
import { MaterialFormDialog } from '../MaterialFormDialog';

type SubmitFn = React.ComponentProps<typeof MaterialFormDialog>['onSubmit'];

const submitSpy = () => jest.fn<ReturnType<SubmitFn>, Parameters<SubmitFn>>();

function renderDialog(onSubmit: SubmitFn) {
  return render(<MaterialFormDialog open onOpenChange={() => undefined} initial={null} onSubmit={onSubmit} />);
}

const codeField = (): HTMLInputElement =>
  screen.getByLabelText<HTMLInputElement>(/hub\.materialCatalog\.form\.code/);

describe('MaterialFormDialog — υποβολή', () => {
  it('Υ1: Enter χωρίς όνομα ⇒ καμία υποβολή', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onSubmit = submitSpy().mockResolvedValue();
    renderDialog(onSubmit);

    await user.type(codeField(), 'CEM-001');
    pressEnterToSubmit(codeField());
    const form = codeField().form;
    if (form) fireEvent.submit(form);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Υ2: Enter με κωδικό + όνομα ⇒ υποβάλλει', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onSubmit = submitSpy().mockResolvedValue();
    renderDialog(onSubmit);

    await user.type(codeField(), 'CEM-001');
    await user.type(screen.getByLabelText(/hub\.materialCatalog\.form\.name/), 'Τσιμέντο');
    pressEnterToSubmit(codeField());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ code: 'CEM-001', name: 'Τσιμέντο', avgPrice: null });
  });
});

describe('MaterialFormDialog — προσβασιμότητα', () => {
  it('Α1: κανένα εύρημα axe', async () => {
    renderDialog(submitSpy().mockResolvedValue());
    await expectNoA11yViolations(document.body);
  });
});
