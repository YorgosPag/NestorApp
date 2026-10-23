/**
 * ADR-242 Βήμα 5 — ο σύνδεσμος οντότητας στον πίνακα αναφορών.
 *
 * Τρία ερωτήματα, τρεις ομάδες:
 *  1. `resolveReportRowHref` — η γραμμή ανοίγει την οντότητα που ΔΗΛΩΝΕΙ το domain, με το id που πρόβαλε ο server.
 *  2. `resolveReportRefHref` — το κελί αναφοράς ανοίγει την ΔΙΚΗ του οντότητα· ποτέ με id άλλου τύπου.
 *  3. `ReportTable` — σύνδεσμος = πραγματικό `<a href>` στο ΠΡΩΤΟ κελί· η γραμμή ΔΕΝ είναι χειριστήριο.
 */

import * as React from 'react';
import { render, screen, within } from '@testing-library/react';

import { ReportTable, type ReportColumnDef } from '@/components/reports/core/ReportTable';
import { resolveReportRefHref, resolveReportRowHref } from '../report-row-links';
import { getDomainDefinition } from '@/config/report-builder/domain-definitions';
import { REPORT_ROW_LINK_ID_KEY } from '@/config/report-builder/report-builder-types';
import { getEntityHref } from '@/lib/navigation/entity-href';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('resolveReportRowHref — η γραμμή ανοίγει ό,τι δηλώνει το domain', () => {
  it('owner link: ο όροφος ανοίγει το κτίριο του `_linkId`', () => {
    const row = { id: 'flr_1', [REPORT_ROW_LINK_ID_KEY]: 'bld_9' };
    expect(resolveReportRowHref(getDomainDefinition('floors'), row)).toBe(getEntityHref('building', 'bld_9'));
  });

  it('self link: το έργο ανοίγει τον εαυτό του, στην κανονική διεύθυνση', () => {
    const row = { id: 'prj_1', [REPORT_ROW_LINK_ID_KEY]: 'prj_1' };
    expect(resolveReportRowHref(getDomainDefinition('projects'), row)).toBe(getEntityHref('project', 'prj_1'));
  });

  it('χωρίς `_linkId` ⇒ κανένας σύνδεσμος (ποτέ σπασμένη διεύθυνση)', () => {
    expect(resolveReportRowHref(getDomainDefinition('floors'), { id: 'flr_1' })).toBeNull();
  });

  it('unlinked domain ⇒ κανένας σύνδεσμος, ακόμα κι αν υπάρχει id', () => {
    const row = { id: 'chq_1', [REPORT_ROW_LINK_ID_KEY]: 'chq_1' };
    expect(resolveReportRowHref(getDomainDefinition('cheques'), row)).toBeNull();
  });
});

describe('resolveReportRefHref — το κελί αναφοράς ανοίγει τη ΔΙΚΗ του οντότητα', () => {
  it('Κτίριο → η καρτέλα του κτιρίου', () => {
    expect(resolveReportRefHref('buildings', 'bld_9')).toBe(getEntityHref('building', 'bld_9'));
  });

  it('αναφορά σε domain που δείχνει σε ΓΟΝΙΟ (όροφος) ⇒ κανένας σύνδεσμος: το id ορόφου δεν είναι id κτιρίου', () => {
    expect(resolveReportRefHref('floors', 'flr_1')).toBeNull();
  });

  it('αναφορά σε unlinked domain ή κενό id ⇒ κανένας σύνδεσμος', () => {
    expect(resolveReportRefHref('cheques', 'chq_1')).toBeNull();
    expect(resolveReportRefHref('buildings', '')).toBeNull();
  });
});

describe('ReportTable — σύνδεσμος στο κελί, ποτέ στη γραμμή', () => {
  const COLUMNS: ReportColumnDef[] = [
    { key: 'name', header: 'Όνομα' },
    { key: 'status', header: 'Κατάσταση' },
  ];
  const DATA = [
    { id: 'a', name: 'Άλφα', status: 'ok' },
    { id: 'b', name: 'Βήτα', status: 'ok' },
  ];
  const HREF = getEntityHref('project', 'a');

  it('το πρώτο κελί είναι `<a href>` όταν υπάρχει διεύθυνση, και μόνο αυτό', () => {
    render(
      <ReportTable columns={COLUMNS} data={DATA} getRowHref={(row) => (row.id === 'a' ? HREF : null)} />,
    );
    const link = screen.getByRole('link', { name: 'Άλφα' });
    expect(link).toHaveAttribute('href', HREF);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Βήτα' })).toBeNull();
  });

  it('η γραμμή δεν είναι χειριστήριο: χωρίς onClick, tabIndex, cursor-pointer', () => {
    render(<ReportTable columns={COLUMNS} data={DATA} getRowHref={() => HREF} />);
    const row = screen.getByRole('link', { name: 'Άλφα' }).closest('tr');
    expect(row).not.toBeNull();
    expect(row).not.toHaveAttribute('tabindex');
    expect(row?.className ?? '').not.toContain('cursor-pointer');
    expect(within(row as HTMLElement).getAllByRole('link')).toHaveLength(1);
  });

  it('χωρίς `getRowHref` ⇒ κανένας σύνδεσμος', () => {
    render(<ReportTable columns={COLUMNS} data={DATA} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
