/**
 * ΑΓΚΥΡΑ — **η συνεδρία δείχνει πρώτα την καθαρή αλλαγή και κρατά τις αποθηκεύσεις της κλειστές, όχι
 * κρυμμένες** (ADR-195 · ADR-332 D29).
 *
 * Η λογική της σύμπτυξης έχει δική της άγκυρα (`coalesce-edit-sessions.test.ts`)· εδώ κρίνεται ότι η
 * οθόνη **λέει** ό,τι υπολογίστηκε: μία γραμμή, πόσες αποθηκεύσεις, και «χωρίς καθαρή αλλαγή» αντί για
 * σιωπή όταν οι τιμές γύρισαν στις αρχικές.
 */

/* global describe, it, expect, jest */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { coalesceEditSessions } from '@/services/audit/coalesce-edit-sessions';
import type { AuditFieldChange, EntityAuditEntry } from '@/types/audit-trail';
import { AuditSessionEntry } from '../AuditSessionEntry';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => (options?.count ? `${key}#${options.count}` : key),
  }),
}));
jest.mock('@/hooks/useFloorLabel', () => ({ useFloorLabel: () => (value: unknown) => String(value) }));

const T0 = Date.parse('2026-10-05T09:00:00.000Z');

const nameChange = (oldValue: string, newValue: string): AuditFieldChange => ({ field: 'name', oldValue, newValue, label: 'name' });

function entry(id: string, offsetMs: number, changes: AuditFieldChange[]): EntityAuditEntry {
  return {
    id,
    entityType: 'building',
    entityId: 'bld_1',
    entityName: 'Κτίριο Α',
    action: 'updated',
    changes,
    performedBy: 'user_1',
    performedByName: 'Γιώργος',
    timestamp: new Date(T0 + offsetMs).toISOString(),
    companyId: 'comp_1',
  } as EntityAuditEntry;
}

function renderSession(entries: EntityAuditEntry[]) {
  const [session] = coalesceEditSessions(entries);
  render(
    <TooltipProvider>
      <ol>
        <AuditSessionEntry session={session} showEntityLink={false} />
      </ol>
    </TooltipProvider>,
  );
}

const SAVES = /^audit\.session\.saves/;

describe('AuditSessionEntry', () => {
  it('Π1 — μία αποθήκευση ⇒ η εγγραφή όπως πάντα, χωρίς ανάπτυγμα', () => {
    renderSession([entry('e1', 0, [nameChange('Α', 'Β')])]);

    expect(screen.getAllByRole('listitem')).toHaveLength(2); // η γραμμή + η μία αλλαγή της
    expect(screen.queryByText(SAVES)).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('Π2 — τρεις αποθηκεύσεις ⇒ ΜΙΑ γραμμή με την καθαρή αλλαγή, και ανάπτυγμα που τις μετρά', () => {
    renderSession([
      entry('e3', 4_000, [nameChange('Κτίρ', 'Κτίριο Α')]),
      entry('e2', 2_000, [nameChange('Κτ', 'Κτίρ')]),
      entry('e1', 0, [nameChange('Παλιό', 'Κτ')]),
    ]);

    const details = screen.getByRole('group');
    expect(within(details).getByText('audit.session.saves#3')).toBeInTheDocument();
    expect(details).not.toHaveAttribute('open');

    // Η καθαρή αλλαγή είναι ΕΞΩ από το ανάπτυγμα: «Παλιό → Κτίριο Α», χωρίς τα ενδιάμεσα.
    const summaryRow = screen.getAllByText('Παλιό').find((node) => !details.contains(node));
    expect(summaryRow?.closest('li')).toHaveTextContent('Κτίριο Α');
    // Οι ωμές εγγραφές υπάρχουν αυτούσιες μέσα στο ανάπτυγμα — τίποτα δεν χάθηκε.
    expect(within(details).getAllByText('Κτίρ').length).toBeGreaterThan(0);
  });

  it('Π3 — οι τιμές γύρισαν στις αρχικές ⇒ το ΛΕΕΙ, και οι αποθηκεύσεις μένουν διαθέσιμες', () => {
    renderSession([
      entry('e2', 56_000, [nameChange('Β', 'Α')]),
      entry('e1', 0, [nameChange('Α', 'Β')]),
    ]);

    expect(screen.getByText('audit.session.noNetChange')).toBeInTheDocument();
    expect(within(screen.getByRole('group')).getByText('audit.session.saves#2')).toBeInTheDocument();
  });
});
