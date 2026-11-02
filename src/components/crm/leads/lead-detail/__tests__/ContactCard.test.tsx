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
    const { unmount } = render(<ContactCard lead={leadWith('cont_a', 'Άλφα')} />);
    expect(screen.getByRole('link', { name: 'Άλφα' })).toHaveAttribute('href', '/contacts?contactId=cont_a');
    unmount();

    render(<ContactCard lead={leadWith('cont_b', 'Βήτα')} />);
    expect(screen.getByRole('link', { name: 'Βήτα' })).toHaveAttribute('href', '/contacts?contactId=cont_b');
  });

  it('χωρίς συνδεδεμένη επαφή το όνομα μένει κείμενο, όχι νεκρός σύνδεσμος', () => {
    render(<ContactCard lead={leadWith('', 'Γάμμα')} />);
    expect(screen.getByText('Γάμμα')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
