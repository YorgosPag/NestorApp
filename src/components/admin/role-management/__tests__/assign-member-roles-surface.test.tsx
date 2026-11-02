/**
 * Ο διάλογος ανάθεσης προσφέρει ρόλους έργου, όχι καθολικούς (ADR-926).
 * @related AssignMemberDialog · getProjectRoles
 *
 * ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * 1. Γύρνα το `PROJECT_ROLE_IDS` στο `GLOBAL_ROLES` → Δ1.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { getProjectRoles } from '@/lib/auth/roles';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import { AssignMemberDialog } from '../components/AssignMemberDialog';

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({
      users: [{ uid: 'user_1', email: 'staff@example.com', displayName: 'Μέλος' }],
    }),
  },
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ text: { muted: 'muted' } }),
}));

type Kids = { children?: React.ReactNode };

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}));

jest.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }: Kids) => <section>{children}</section>;
  return {
    Dialog: Pass,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
    DialogFooter: Pass,
  };
});

jest.mock('@/components/ui/select', () => {
  const Pass = ({ children }: Kids) => <section>{children}</section>;
  return {
    Select: Pass,
    SelectContent: Pass,
    SelectTrigger: Pass,
    SelectValue: () => null,
    SelectItem: ({ value }: { value: string }) => <option data-testid="role-option" value={value} />,
  };
});

describe('AssignMemberDialog', () => {
  it('Δ1: το βήμα 2 προσφέρει ακριβώς τους ρόλους έργου', async () => {
    const user = userEvent.setup();
    render(
      <AssignMemberDialog
        open
        onOpenChange={jest.fn()}
        projectId="proj_1"
        existingMembers={[]}
        onConfirm={jest.fn()}
      />,
    );

    await user.click(await screen.findByText('staff@example.com'));
    await user.click(screen.getByText('roleManagement.projectMembers.next'));

    await waitFor(() => expect(screen.getAllByTestId('role-option').length).toBeGreaterThan(0));
    const offered = screen
      .getAllByTestId('role-option')
      .map((option) => option.getAttribute('value') ?? '');

    expect(offered).toEqual(getProjectRoles());
    expect(offered).toContain('project_manager');
    expect(offered.filter((role) => (GLOBAL_ROLES as readonly string[]).includes(role))).toEqual([]);
  });
});
