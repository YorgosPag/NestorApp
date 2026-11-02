/**
 * Άγκυρα — **Η ΕΡΓΑΣΙΑ ΤΟΥ LEAD ΔΕΝΕΤΑΙ ΣΤΟ LEAD** (ADR-089)
 *
 * Η «Νέα Εργασία» του lead έδειχνε placeholder και δεν έγραφε τίποτα. Η σελίδα του lead
 * διαβάζει με `getTasksByLead`, άρα εργασία χωρίς `leadId` θα γραφόταν και δεν θα φαινόταν.
 */

import type { ComponentProps, ReactNode } from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSuccess = jest.fn();
const mockNotifyError = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: mockSuccess, error: mockNotifyError }),
}));

const mockAddTask = jest.fn((_task: Record<string, unknown>) => Promise.resolve('task_1'));
jest.mock('@/services/tasks.service', () => ({
  addTask: (task: Record<string, unknown>) => mockAddTask(task),
}));

jest.mock('@/services/contacts-query.service', () => ({
  subscribeToContacts: () => () => undefined,
}));
jest.mock('@/hooks/useProjectsList', () => ({
  useProjectsList: () => ({ projects: [], loading: false }),
}));
jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user_1' } }),
}));
jest.mock('@/components/voice-input/VoiceMicButton', () => ({ VoiceMicButton: () => null }));
jest.mock('@/components/ui/date-picker-field', () => ({ DatePickerField: () => null }));
jest.mock('@/components/ui/enum-select', () => ({ EnumSelect: () => null }));
jest.mock('@/components/ui/searchable-combobox', () => ({
  SearchableCombobox: ({ id, value }: { id: string; value: string }) => (
    <output data-testid={id}>{value}</output>
  ),
}));
jest.mock('@/components/crm/shared/TaskDialogShell', () => ({
  TaskDialogShell: ({
    open,
    title,
    onSubmit,
    children,
  }: {
    open: boolean;
    title: string;
    onSubmit: () => void;
    children: ReactNode;
  }) =>
    open ? (
      <form
        aria-label={title}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        <button type="submit">submit</button>
      </form>
    ) : null,
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CalendarCreateDialog } from '@/components/crm/calendar/CalendarCreateDialog';

type DialogProps = ComponentProps<typeof CalendarCreateDialog>;

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const onOpenChange = jest.fn();
  const onCreated = jest.fn();
  const view = render(
    <CalendarCreateDialog open onOpenChange={onOpenChange} onCreated={onCreated} {...overrides} />,
  );
  return { ...view, onOpenChange, onCreated };
}

async function submitWithTitle(title: string) {
  fireEvent.change(screen.getByLabelText(/calendarPage\.dialog\.fields\.title/), {
    target: { value: title },
  });
  fireEvent.click(screen.getByRole('button', { name: 'submit' }));
  await waitFor(() => expect(mockAddTask).toHaveBeenCalledTimes(1));
}

beforeEach(() => {
  mockAddTask.mockClear();
  mockSuccess.mockClear();
  mockNotifyError.mockClear();
});

describe('δημιουργία από τη σελίδα του lead', () => {
  it('🔴 γράφει την εργασία με το leadId και την επαφή του lead', async () => {
    const { onCreated, onOpenChange } = renderDialog({ leadId: 'opp_1', initialContactId: 'cont_1' });

    await submitWithTitle('  Κλήση πελάτη  ');

    expect(mockAddTask.mock.calls[0][0]).toMatchObject({
      title: 'Κλήση πελάτη',
      leadId: 'opp_1',
      contactId: 'cont_1',
      assignedTo: 'user_1',
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockSuccess).toHaveBeenCalledWith('tasks.messages.created');
  });

  it('δείχνει τον τίτλο του καταναλωτή και την προεπιλεγμένη επαφή', () => {
    renderDialog({ dialogTitle: 'tasks.newTask', initialContactId: 'cont_1' });

    expect(screen.getByRole('form', { name: 'tasks.newTask' })).toBeTruthy();
    expect(screen.getByTestId('event-contact').textContent).toBe('cont_1');
  });

  it('ξαναφέρνει την επαφή του lead σε κάθε άνοιγμα', () => {
    const { rerender } = renderDialog({ initialContactId: 'cont_1' });
    const dialog = (open: boolean) => (
      <CalendarCreateDialog open={open} onOpenChange={jest.fn()} initialContactId="cont_2" />
    );

    rerender(dialog(false));
    rerender(dialog(true));

    expect(screen.getByTestId('event-contact').textContent).toBe('cont_2');
  });
});

describe('το ημερολόγιο μένει ως είχε', () => {
  it('χωρίς lead δεν γράφει καθόλου το πεδίο leadId, και κρατά τον δικό του τίτλο', async () => {
    renderDialog();

    expect(screen.getByRole('form', { name: 'calendarPage.dialog.createTitle' })).toBeTruthy();
    await submitWithTitle('Συνάντηση');

    expect(mockAddTask.mock.calls[0][0]).not.toHaveProperty('leadId');
  });
});

describe('αποτυχία εγγραφής', () => {
  it('🔴 δείχνει το σφάλμα, δεν κλείνει και δεν αναφέρει δημιουργία', async () => {
    mockAddTask.mockRejectedValueOnce(new Error('permission-denied'));
    const { onCreated, onOpenChange } = renderDialog({ leadId: 'opp_1' });

    await submitWithTitle('Κλήση');

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('permission-denied'));
    expect(onCreated).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mockSuccess).not.toHaveBeenCalled();
  });
});
