/**
 * Το όνομα στην καρτέλα ευκαιρίας οδηγεί στην εγγραφή του ΣΥΓΚΕΚΡΙΜΕΝΟΥ προσώπου,
 * και ΜΟΝΟ όταν το πρόσωπο υπάρχει ως επαφή — αλλιώς μένει απλό κείμενο.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { Opportunity } from '@/types/crm';
import { ContactCard } from '../ContactCard';

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useIconSizes', () => ({ useIconSizes: () => ({ md: '' }) }));
jest.mock('@/hooks/useBorderTokens', () => ({ useBorderTokens: () => ({ quick: { card: '' } }) }));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ bg: { primary: '' }, text: { muted: '', foreground: '' } }),
}));
jest.mock('@/hooks/useSpacingTokens', () => ({
  useSpacingTokens: () => ({
    padding: { lg: '' },
    margin: { bottom: { md: '' }, top: { xs: '' } },
    spaceBetween: { md: '' },
    gap: { md: '' },
  }),
}));

const leadWith = (contactId: string, fullName: string): Opportunity => ({
  title: 'Πρόταση', contactId, fullName, stage: 'proposal', assignedTo: 'u1', status: 'active',
  createdAt: '2026-10-29T08:00:00.000Z', updatedAt: '2026-10-29T08:00:00.000Z',
});

describe('ContactCard — σύνδεσμος ονόματος', () => {
  it('κάθε πρόσωπο οδηγεί στη ΔΙΚΗ του επαφή', () => {
    const { unmount } = render(<ContactCard lead={leadWith('cont_a', 'Άλφα')} person={{ fullName: 'Άλφα' }} />);
    expect(screen.getByRole('link', { name: 'Άλφα' })).toHaveAttribute('href', '/contacts?contactId=cont_a');
    unmount();

    render(<ContactCard lead={leadWith('cont_b', 'Βήτα')} person={{ fullName: 'Βήτα' }} />);
    expect(screen.getByRole('link', { name: 'Βήτα' })).toHaveAttribute('href', '/contacts?contactId=cont_b');
  });

  it('χωρίς συνδεδεμένη επαφή το όνομα μένει κείμενο, όχι νεκρός σύνδεσμος', () => {
    render(<ContactCard lead={leadWith('', 'Γάμμα')} person={{ fullName: 'Γάμμα' }} onPreview={jest.fn()} />);
    expect(screen.getByText('Γάμμα')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'contactCard.preview.open' })).not.toBeInTheDocument();
  });

  it('δείχνει τα στοιχεία του προσώπου, όχι τα αντίγραφα της ευκαιρίας', () => {
    const lead = { ...leadWith('cont_a', 'Άλφα'), email: 'old@example.test', phone: '6900000004' };
    render(<ContactCard lead={lead} person={{ fullName: 'Άλφα', email: 'real@example.test' }} onPreview={jest.fn()} />);
    expect(screen.getByText('real@example.test')).toBeInTheDocument();
    expect(screen.queryByText('old@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('6900000004')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'contactCard.preview.open' })).toBeInTheDocument();
  });
});
