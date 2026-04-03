import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContactIdentityImpactDialog } from '../ContactIdentityImpactDialog';
import type { ContactIdentityImpactPreview } from '@/types/contact-identity-impact';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ md: 'h-4 w-4' }),
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  AlertDialogAction: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => <button type="button" className={className} onClick={onClick}>{children}</button>,
}));

function makePreview(overrides: Partial<ContactIdentityImpactPreview> = {}): ContactIdentityImpactPreview {
  return {
    mode: 'warn',
    changes: [
      {
        field: 'firstName',
        category: 'display',
        oldValue: 'Maria',
        newValue: 'Marina',
        isCleared: false,
      },
    ],
    dependencies: [
      { id: 'attendanceEvents', count: 2, mode: 'block' },
    ],
    affectedDomains: ['ikaAttendance'],
    messageKey: 'identityImpact.messages.warn',
    blockingCount: 1,
    warningCount: 0,
    ...overrides,
  };
}

describe('ContactIdentityImpactDialog', () => {
  it('renders warn mode content and confirms through the canonical action', () => {
    const onConfirm = jest.fn();

    render(
      <ContactIdentityImpactDialog
        open
        preview={makePreview()}
        onOpenChange={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('identityImpact.titles.warn')).toBeInTheDocument();
    expect(screen.getByText('identityImpact.messages.warn')).toBeInTheDocument();
    expect(screen.getByText('identityImpact.dependencies.attendanceEvents.label')).toBeInTheDocument();
    expect(screen.getByText('identityImpact.affectedDomains.ikaAttendance.label')).toBeInTheDocument();

    fireEvent.click(screen.getByText('identityImpact.actions.confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders blocked mode without exposing the destructive confirm action', () => {
    const onConfirm = jest.fn();

    render(
      <ContactIdentityImpactDialog
        open
        preview={makePreview({ mode: 'block', messageKey: 'identityImpact.messages.block' })}
        onOpenChange={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('identityImpact.titles.block')).toBeInTheDocument();
    expect(screen.getByText('identityImpact.actions.understood')).toBeInTheDocument();
    expect(screen.queryByText('identityImpact.actions.confirm')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('identityImpact.actions.understood'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
