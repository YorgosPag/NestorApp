/**
 * @jest-environment jsdom
 */

/**
 * ADR-242 — **το όνομα του έργου στον πίνακα χαρτοφυλακίου οδηγεί στο έργο**, όπως στους μεγάλους (Procore Portfolio).
 * (α) πραγματικό `<a href>` από το SSoT `getProjectUrl` — η κανονική μορφή query, όχι το `/projects/[id]` που κάνει redirect·
 * (β) ΧΩΡΙΣ `target` — τη νέα καρτέλα τη διαλέγει ο άνθρωπος (Ctrl/μεσαίο κλικ)·
 * (γ) η γραμμή ΔΕΝ πατιέται ολόκληρη — ένας σύνδεσμος ανά γραμμή, όχι `router.push` χωρίς href.
 */

import { render, screen, within } from '@testing-library/react';
import React from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { getProjectTabUrl, getProjectUrl } from '@/lib/navigation/project-urls';
import type { ProjectFinancialSummary } from '@/types/interest-calculator';
import { PortfolioProjectsTable } from '../PortfolioProjectsTable';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// Περνά ΟΛΑ τα props: ένα `target` ή `onClick` που θα πρόσθετε κάποιος πρέπει να φανεί στο DOM.
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const project = (projectId: string, projectName: string): ProjectFinancialSummary => ({
  projectId, projectName, totalProperties: 0, soldProperties: 0, totalValue: 0, collected: 0,
  costOfMoney: null, avgCollectionDays: null, healthStatus: 'noData', healthDrivers: [],
});

/** Όπως στην εφαρμογή: το σήμα υγείας έχει tooltip. */
const renderTable = (projects: readonly ProjectFinancialSummary[]) =>
  render(<TooltipProvider><PortfolioProjectsTable projects={projects} /></TooltipProvider>);

const PROJECTS = [project('proj_a', 'ΕΡΓΟ Α'), project('proj b&c', 'ΕΡΓΟ ΙΩΑΝΝΙΝΩΝ — Κατοικίες Δωδώνης')];

describe('getProjectUrl / getProjectTabUrl — η ΜΙΑ διεύθυνση έργου', () => {
  it('αρχική όψη = `/projects?projectId=…`, χωρίς `tab`', () => {
    expect(getProjectUrl('proj_a')).toBe('/projects?projectId=proj_a');
  });

  it('ειδικοί χαρακτήρες κωδικοποιούνται (ποτέ χειρόγραφο template)', () => {
    expect(getProjectUrl('proj b&c')).toBe('/projects?projectId=proj+b%26c');
  });

  it('η καρτέλα προστίθεται πάνω στην ΙΔΙΑ παράμετρο έργου', () => {
    expect(getProjectTabUrl('proj_a', 'budget')).toBe('/projects?projectId=proj_a&tab=budget');
  });
});

describe('PortfolioProjectsTable — το όνομα οδηγεί στο έργο', () => {
  it('κάθε όνομα είναι σύνδεσμος προς την αρχική όψη του έργου του', () => {
    renderTable(PROJECTS);
    for (const { projectId, projectName } of PROJECTS) {
      expect(screen.getByRole('link', { name: projectName })).toHaveAttribute('href', getProjectUrl(projectId));
    }
  });

  it('ίδια καρτέλα: ΚΑΝΕΝΑ `target` — η νέα καρτέλα είναι επιλογή του ανθρώπου', () => {
    renderTable(PROJECTS);
    for (const link of screen.getAllByRole('link')) expect(link).not.toHaveAttribute('target');
  });

  it('ένας σύνδεσμος ανά γραμμή, και η γραμμή η ίδια δεν είναι «σύνδεσμος»', () => {
    renderTable(PROJECTS);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(PROJECTS.length);
    for (const row of rows) {
      expect(within(row).getAllByRole('link')).toHaveLength(1);
      expect(row).not.toHaveAttribute('role', 'link');
      expect(row).not.toHaveAttribute('tabindex');
    }
  });

  it('χωρίς έργα ⇒ κανένας πίνακας', () => {
    renderTable([]);
    expect(screen.queryByRole('table')).toBeNull();
  });
});
