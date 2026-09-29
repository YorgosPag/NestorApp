/**
 * @jest-environment jsdom
 */
/**
 * ADR-891 §10.4 · Θ2 — **κάθε κουμπί-εικονίδιο του ΙΚΑ έχει προσβάσιμο όνομα από το i18n**.
 *
 * - **Ο** — το «Αφαίρεση» ενός εργαζομένου λέει **ποιον** αφαιρεί (πρότυπο GitHub/Gmail):
 *   δέκα κουμπιά με το ίδιο όνομα «Αφαίρεση» σε μια λίστα είναι αδιάκριτα για αναγνώστη οθόνης.
 * - **Π** — τα βέλη πλοήγησης ημέρας/μήνα παίρνουν όνομα από το `t()`, όχι αγγλικό κυριολεκτικό
 *   (ο scanner του N.11 δεν βλέπει `aria-label="…"` μέσα σε JSX).
 * - **Ε** — το εικονίδιο είναι `aria-hidden`: το όνομα το δίνει το κουμπί, όχι το SVG.
 */

import { render, screen } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/tooltip';

import type { ProjectWorker } from '../../contracts';
import { WorkerCard } from '../WorkerCard';
import { DateNavigator } from '../DateNavigator';
import { MonthYearSelector } from '../MonthYearSelector';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join('|')}` : key),
    isNamespaceReady: true,
  }),
}));

const WORKER: ProjectWorker = {
  contactId: 'cont_1', name: 'Δοκιμή Δ18', specialty: null, company: null, companyContactId: null,
  insuranceClassId: null, amka: null, afm: null, employmentStatus: 'active', employmentType: null,
  position: null, hireDate: null, terminationDate: null, linkId: 'link_1', relationship: null,
};

describe('ΙΚΑ — προσβάσιμα ονόματα κουμπιών-εικονιδίων', () => {
  it('Ο — η αφαίρεση ονομάζει τον εργαζόμενο', () => {
    render(<TooltipProvider><WorkerCard worker={WORKER} onRemove={jest.fn()} /></TooltipProvider>);
    const button = screen.getByRole('button', { name: 'ika.workersTab.removeWorkerNamed:Δοκιμή Δ18' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Π — πλοήγηση ημέρας από το i18n', () => {
    render(
      <DateNavigator date={new Date(2026, 8, 29)} viewMode="daily" onDateChange={jest.fn()} onViewModeChange={jest.fn()} />,
    );
    expect(screen.getByRole('navigation', { name: 'ika.periodNavigation.dateLabel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ika.periodNavigation.previousDay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ika.periodNavigation.nextDay' })).toBeInTheDocument();
  });

  it('Π — πλοήγηση μήνα από το i18n', () => {
    render(<MonthYearSelector month={9} year={2026} onChange={jest.fn()} />);
    expect(screen.getByRole('navigation', { name: 'ika.periodNavigation.monthYearLabel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ika.periodNavigation.previousMonth' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ika.periodNavigation.nextMonth' })).toBeInTheDocument();
  });
});
