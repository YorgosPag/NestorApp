/**
 * @jest-environment jsdom
 */

/**
 * ADR-242 Βήμα 2 — **κάθε σύνδεσμος προς έργο περνά από το SSoT `getProjectUrl`**, και καμία γραμμή πίνακα δεν
 * «πατιέται ολόκληρη» με `router.push` χωρίς href (Roselli 2023 · GOV.UK · GitHub).
 * (α) Υγεία Έργων (εκτελεστική αναφορά): το όνομα είναι πραγματικό `<a href>`· η γραμμή ΔΕΝ έχει `onClick`/`cursor-pointer`·
 * (β) «Πίσω στο έργο» των προμηθειών: ίδια διεύθυνση με το SSoT, όχι χειρόγραφο query·
 * (γ) ιστορικό αλλαγών: κάθε τύπος οντότητας πάει στην ΚΑΝΟΝΙΚΗ διεύθυνση του κεντρικού μητρώου — ποτέ στις
 *     διευθύνσεις-redirect `/projects/:id` · `/contacts/:id` · `/buildings/:id` · `/parking/:id` · `/storage/:id`.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { BackToProjectLink } from '@/components/projects/procurement/BackToProjectLink';
import { ProjectHealthTable } from '@/components/reports/sections/executive/ProjectHealthTable';
import type { ProjectHealthRow } from '@/components/reports/sections/executive/types';
import { buildEntityHref } from '@/components/shared/audit/audit-timeline-entry';
import { getProjectUrl } from '@/lib/navigation/project-urls';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import type { AuditEntityType } from '@/types/audit-trail';

const mockPush = jest.fn();

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// Περνά ΟΛΑ τα props: ένα `target` ή `onClick` που θα πρόσθετε κάποιος πρέπει να φανεί στο DOM.
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>{children}</a>
  ),
  useRouter: () => ({ push: mockPush, replace: mockPush, back: jest.fn(), prefetch: jest.fn() }),
}));

const healthRow = (id: string, name: string): ProjectHealthRow => ({
  id, name, progress: 40, cpi: 1, spi: 1, cpiHealth: 'green', spiHealth: 'green', overallHealth: 'green', budget: 0,
});

beforeEach(() => mockPush.mockClear());

describe('ProjectHealthTable — το όνομα είναι ο ΕΝΑΣ σύνδεσμος της γραμμής', () => {
  const ROWS = [healthRow('proj_a', 'ΕΡΓΟ Α'), healthRow('proj b&c', 'ΕΡΓΟ Β')];

  it('κάθε όνομα δείχνει στην αρχική όψη του έργου (κανονική μορφή, όχι redirect)', () => {
    render(<ProjectHealthTable data={ROWS} />);
    for (const { id, name } of ROWS) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', getProjectUrl(id));
      expect(link).not.toHaveAttribute('target');
    }
  });

  it('κλικ στη γραμμή (εκτός ονόματος) ΔΕΝ πλοηγεί — καμία `router.push` χωρίς href', () => {
    render(<ProjectHealthTable data={ROWS} />);
    const row = screen.getByRole('link', { name: 'ΕΡΓΟ Α' }).closest('tr');
    expect(row).not.toBeNull();
    expect(row).not.toHaveClass('cursor-pointer');
    fireEvent.click(row as HTMLElement);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('BackToProjectLink — η επιστροφή στο έργο από το SSoT', () => {
  it('href = getProjectUrl (κωδικοποιημένο, όχι χειρόγραφο query)', () => {
    render(<BackToProjectLink projectId="proj b&c" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', getProjectUrl('proj b&c'));
  });
});

describe('buildEntityHref — ζητά από το κεντρικό μητρώο, δεν γράφει διευθύνσεις', () => {
  const ID = 'ent_1';
  const EXPECTED: ReadonlyArray<readonly [AuditEntityType, string | null]> = [
    ['contact', ENTITY_ROUTES.contacts.withId(ID)],
    ['company', ENTITY_ROUTES.contacts.withId(ID)],
    ['project', getProjectUrl(ID)],
    ['building', ENTITY_ROUTES.buildings.withId(ID)],
    ['property', ENTITY_ROUTES.properties.withId(ID)],
    ['parking', ENTITY_ROUTES.spaces.parking(ID)],
    ['storage', ENTITY_ROUTES.spaces.storage(ID)],
    ['purchase_order', ENTITY_ROUTES.procurement.purchaseOrder(ID)],
    ['floor', null],
    ['quote', null],
  ];

  it.each(EXPECTED)('%s → η διεύθυνση του SSoT', (type, expected) => {
    expect(buildEntityHref(type, ID)).toBe(expected);
  });

  it.each(['/projects/', '/contacts/', '/buildings/', '/parking/', '/storage/'])(
    'κανένας τύπος δεν δείχνει σε διεύθυνση-redirect `%s:id`',
    (redirectPrefix) => {
      for (const [type] of EXPECTED) {
        expect(buildEntityHref(type, ID) ?? '').not.toContain(`${redirectPrefix}${ID}`);
      }
    },
  );
});
