/**
 * ChoiceCards — το κοινό πλέγμα καρτών επιλογής (ADR-914).
 *
 * Κλειδώνει ό,τι υπόσχεται το component στους τρεις καταναλωτές του: κάθε κάρτα είναι
 * πραγματικό κουμπί, η ανενεργή δεν επιλέγεται ΚΑΙ λέει γιατί.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChoiceCards, type ChoiceCardOption } from '../choice-cards';

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ lg: 'h-6 w-6', xl2: 'h-12 w-12' }),
}));
jest.mock('@/hooks/useBorderTokens', () => ({
  useBorderTokens: () => ({ quick: { card: 'rounded-lg border' } }),
}));

function TestIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg data-testid="icon" {...props} />;
}

const OPTIONS: ChoiceCardOption<'draft' | 'bound' | 'load'>[] = [
  { id: 'draft', icon: TestIcon, title: 'Πρόχειρο', description: 'Χωρίς δέσμευση' },
  { id: 'bound', icon: TestIcon, title: 'Κάτοψη για…', tone: { hoverBorder: 'hover:border-border' } },
  {
    id: 'load',
    icon: TestIcon,
    title: 'Από την αποθήκη',
    description: 'Φόρτωσε αποθηκευμένο σχέδιο',
    disabled: true,
    disabledReason: 'Άνοιξε πρώτα επίπεδο',
  },
];

describe('ChoiceCards', () => {
  it('αποδίδει μία κάρτα-κουμπί ανά επιλογή, με τίτλο και περιγραφή', () => {
    render(<ChoiceCards options={OPTIONS} onSelect={jest.fn()} ariaLabel="Ενέργειες" />);

    expect(screen.getByRole('list', { name: 'Ενέργειες' })).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const button of buttons) expect(button).toHaveAttribute('type', 'button');
    expect(screen.getByText('Χωρίς δέσμευση')).toBeInTheDocument();
  });

  it('το κλικ επιστρέφει το id της κάρτας', () => {
    const onSelect = jest.fn();
    render(<ChoiceCards options={OPTIONS} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Κάτοψη για/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('bound');
  });

  it('ο τόνος hover μπαίνει μόνο σε ενεργή κάρτα', () => {
    render(<ChoiceCards options={OPTIONS} onSelect={jest.fn()} />);

    expect(screen.getByRole('button', { name: /Κάτοψη για/ })).toHaveClass('hover:border-border');
  });

  it('η ανενεργή κάρτα δεν επιλέγεται και δείχνει τον λόγο αντί για την περιγραφή', () => {
    const onSelect = jest.fn();
    render(<ChoiceCards options={OPTIONS} onSelect={onSelect} />);

    const disabled = screen.getByRole('button', { name: /Από την αποθήκη/ });
    expect(disabled).toBeDisabled();
    fireEvent.click(disabled);

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('Άνοιξε πρώτα επίπεδο')).toBeInTheDocument();
    expect(screen.queryByText('Φόρτωσε αποθηκευμένο σχέδιο')).not.toBeInTheDocument();
  });

  it('`size="lg"` ⇒ ψηλή κάρτα με μεγάλο εικονίδιο· προεπιλογή η συμπαγής', () => {
    const { rerender } = render(<ChoiceCards options={OPTIONS.slice(0, 1)} onSelect={jest.fn()} />);
    expect(screen.getByTestId('icon')).toHaveClass('h-6');
    expect(screen.getByRole('button')).toHaveClass('p-2');

    rerender(<ChoiceCards options={OPTIONS.slice(0, 1)} onSelect={jest.fn()} size="lg" />);
    expect(screen.getByTestId('icon')).toHaveClass('h-12');
    expect(screen.getByRole('button')).toHaveClass('py-6');
  });
});
