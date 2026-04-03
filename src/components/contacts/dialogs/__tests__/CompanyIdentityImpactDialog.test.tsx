import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CompanyIdentityImpactDialog } from '../CompanyIdentityImpactDialog';
import type { IdentityFieldChange } from '@/utils/contactForm/company-identity-guard';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ md: 'h-4 w-4' }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({
    text: { muted: 'text-muted' },
  }),
}));

jest.mock('@/lib/design-system', () => ({
  getStatusColor: jest.fn(() => 'bg-token'),
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

const changes: ReadonlyArray<IdentityFieldChange> = [
  {
    field: 'companyName',
    category: 'A',
    oldValue: 'Old Co',
    newValue: 'New Co',
    isCleared: false,
  },
];

describe('CompanyIdentityImpactDialog', () => {
  it('renders warn mode and confirms the change explicitly', () => {
    const onConfirm = jest.fn();

    render(
      <CompanyIdentityImpactDialog
        open
        onOpenChange={jest.fn()}
        changes={changes}
        projects={2}
        properties={1}
        obligations={0}
        invoices={3}
        apyCertificates={0}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('contacts.companyIdentityImpact.title')).toBeInTheDocument();
    expect(screen.getByText('contacts.companyIdentityImpact.depProjects')).toBeInTheDocument();
    expect(screen.getByText('contacts.companyIdentityImpact.depInvoices')).toBeInTheDocument();
    expect(screen.getByText('contacts.companyIdentityImpact.confirm')).toBeInTheDocument();

    fireEvent.click(screen.getByText('contacts.companyIdentityImpact.confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders blocked mode without allowing the mutation to continue', () => {
    const onConfirm = jest.fn();

    render(
      <CompanyIdentityImpactDialog
        open
        onOpenChange={jest.fn()}
        changes={changes}
        projects={1}
        properties={0}
        obligations={1}
        invoices={0}
        apyCertificates={0}
        onConfirm={onConfirm}
        mode="block"
        message="contacts.companyIdentityImpact.unavailableBody"
      />
    );

    expect(screen.getByText('contacts.companyIdentityImpact.unavailableTitle')).toBeInTheDocument();
    expect(screen.getByText('contacts.companyIdentityImpact.unavailableBody')).toBeInTheDocument();
    expect(screen.getByText('contacts.companyIdentityImpact.understood')).toBeInTheDocument();
    expect(screen.queryByText('contacts.companyIdentityImpact.confirm')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('contacts.companyIdentityImpact.understood'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
