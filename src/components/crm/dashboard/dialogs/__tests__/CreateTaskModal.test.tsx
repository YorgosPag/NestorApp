/**
 * Το «Δημιουργία» της καρτέλας lead γράφει πραγματική εργασία, δεμένη στο lead,
 * στην εταιρεία του και στην επαφή του, και μετά ξαναφορτώνει τις εργασίες.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Opportunity } from '@/types/crm';

const mockCreateTask = jest.fn(async () => 'task_1');
const mockSuccess = jest.fn();

jest.mock('@/services/crm/crm-mutation-gateway', () => ({
  createTaskWithPolicy: (input: unknown) => (mockCreateTask as jest.Mock)(input),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: mockSuccess, error: jest.fn() }),
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: jest.fn() }),
}));
jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}));
jest.mock('@/services/contacts-query.service', () => ({
  subscribeToContacts: () => () => undefined,
}));
jest.mock('@/hooks/useProjectsList', () => ({
  useProjectsList: () => ({ projects: [], loading: false }),
}));
jest.mock('@/lib/design-system', () => ({}));
jest.mock('@/components/ui/date-picker-field', () => ({ DatePickerField: () => null }));
jest.mock('@/components/ui/enum-select', () => ({ EnumSelect: () => null }));
jest.mock('@/components/ui/searchable-combobox', () => ({ SearchableCombobox: () => null }));
jest.mock('@/components/voice-input/VoiceMicButton', () => ({ VoiceMicButton: () => null }));
jest.mock('@/components/crm/shared/TaskFormField', () => ({
  TaskFormField: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
    children: React.ReactNode;
  }) =>
    open ? (
      <form
        aria-label={title}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {children}
        <button type="submit">save</button>
      </form>
    ) : null,
}));

import CreateTaskModal from '../CreateTaskModal';

const LEAD = {
  id: 'opp_1',
  companyId: 'comp_a',
  contactId: 'cont_1',
} as Opportunity;

describe('CreateTaskModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('γράφει εργασία δεμένη στο lead και ειδοποιεί την καρτέλα', async () => {
    const onClose = jest.fn();
    const onTaskCreated = jest.fn();
    const { container } = render(
      <CreateTaskModal isOpen onClose={onClose} onTaskCreated={onTaskCreated} preselectedLead={LEAD} />
    );

    fireEvent.change(container.querySelector('#event-title') as Element, {
      target: { value: '  Κλήση πελάτη ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(onTaskCreated).toHaveBeenCalledTimes(1));
    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Κλήση πελάτη',
        leadId: 'opp_1',
        companyId: 'comp_a',
        contactId: 'cont_1',
        assignedTo: 'u1',
        status: 'pending',
      }),
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('κενός τίτλος: δεν γράφει τίποτα', async () => {
    render(<CreateTaskModal isOpen onClose={jest.fn()} onTaskCreated={jest.fn()} preselectedLead={LEAD} />);

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(mockCreateTask).not.toHaveBeenCalled());
  });

  it('χωρίς companyId στο lead δεν στέλνει undefined στη Firestore', async () => {
    const { container } = render(
      <CreateTaskModal
        isOpen
        onClose={jest.fn()}
        onTaskCreated={jest.fn()}
        preselectedLead={{ ...LEAD, companyId: undefined }}
      />
    );

    fireEvent.change(container.querySelector('#event-title') as Element, { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    const { data } = (mockCreateTask as jest.Mock).mock.calls[0][0] as { data: object };
    expect(Object.keys(data)).not.toContain('companyId');
  });
});
