/**
 * @jest-environment jsdom
 */

/**
 * ADR-175 — τα σήματα μιας γραμμής BOQ διαβάζονται.
 * - Σ1: σήμα BIM ⇒ κείμενο **και** εικονίδιο (συνδεδεμένο ≠ αποσυνδεδεμένο χωρίς να δεις χρώμα — CHECK 3.41).
 * - Σ2: καμία κατάσταση και κανένα σήμα δεν ζωγραφίζει `text-primary` (στο σκοτεινό θέμα = χρώμα επιφάνειας ⇒ αόρατο,
 *   CHECK 3.38 — το ζωντανό σύμπτωμα: «Αυτόματο από BIM» και «Πιστοποιημένο» δεν διαβάζονταν).
 */

import { render, screen, within } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));

import { normalizeBOQItem } from '@/services/measurements/boq-document-normalize';
import type { BOQItemStatus } from '@/types/boq';
import { BOQFloorGroup } from '../BOQFloorGroup';
import { TooltipProvider } from '@/components/ui/tooltip';

const t = (key: string) => key;
const STATUSES: readonly BOQItemStatus[] = ['draft', 'submitted', 'approved', 'certified', 'locked'];

function bimLine(id: string, overrides: Record<string, unknown>) {
  return normalizeBOQItem(id, { title: `Κολώνα ${id}`, unit: 'm3', estimatedQuantity: 1, categoryCode: 'OIK-2', sourceType: 'bim-auto', ...overrides });
}

function renderGroup(items: ReturnType<typeof bimLine>[]) {
  return render(
    <BOQFloorGroup items={items} derivedCosts={new Map()} categories={[]} onEdit={jest.fn()} onDelete={jest.fn()} onDetach={jest.fn()} onStatusChange={jest.fn()} t={t} />,
    { wrapper: TooltipProvider },
  );
}

describe('BOQ — σήματα γραμμής', () => {
  it('Σ1: σήμα BIM ⇒ κείμενο + εικονίδιο, σε συνδεδεμένη και αποσυνδεδεμένη γραμμή', () => {
    renderGroup([bimLine('a', {}), bimLine('b', { detached: true })]);
    for (const key of ['tabs.measurements.badge.bimAuto', 'tabs.measurements.badge.bimDetached']) {
      const badge = screen.getByText(key);
      expect(badge.querySelector('svg')).not.toBeNull();
    }
  });

  it('Σ2: καμία κατάσταση, κανένα σήμα με μελάνι από token επιφάνειας', () => {
    const { container } = renderGroup(STATUSES.map((status, i) => bimLine(`s${i}`, { status })));
    for (const status of STATUSES) expect(within(container).getByText(`tabs.measurements.status.${status}`)).toBeTruthy();
    // Συνθετικά, όχι literal: η πύλη 3.38 σαρώνει και αυτό το αρχείο (σχήμα «Κ7β», βλ. AddressPublicShapeBadge.test Ο8).
    const FORBIDDEN_SURFACE_CLASS = ['text', 'primary'].join('-');
    expect(container.querySelectorAll(`.${FORBIDDEN_SURFACE_CLASS}`)).toHaveLength(0);
  });
});
