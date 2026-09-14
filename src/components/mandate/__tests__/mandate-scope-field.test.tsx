/**
 * @fileoverview ADR-832 §8 — **ΤΟ ΠΕΔΙΟ «ΓΙΑ ΠΟΙΕΣ ΠΡΑΞΕΙΣ;» ΤΗΣ ΦΟΡΜΑΣ Σ1**.
 * @related components/mandate/mandate-request-form-fields.tsx · constants/mandate-offer-kinds.ts
 *
 * 🔴 Το περιστατικό (2026-09-14): η φόρμα πρόσφερε «Βραχυχρόνια μίσθωση» ως πράξη εντολής.
 * Ο πίνακας κλειδώνεται στο `mandate-offer-kinds.test.ts`· εδώ κλειδώνεται ότι η **οθόνη
 * τον ρωτά** — προσφέρει την τομή, κλαδεύει σε αλλαγή ακινήτου και εξηγεί τι έμεινε έξω.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { ScopeField } from '@/components/mandate/mandate-request-form-fields';
import { SCREEN_KEYS } from '@/components/mandate/mandate-request-form-labels';
import { OFFER_KIND_I18N_KEYS } from '@/components/mandate/offer-kind-labels';
import {
  emptyMandateRequestForm,
  type MandateRequestFormValues,
} from '@/lib/mandate/mandate-request-form-values';
import { offerOf, validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import type { OwnerProperty } from '@/types/owner-property';
import type { OfferKind } from '@/types/property-offers';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values === undefined
        ? key
        : `${key}[${Object.entries(values)
            .map(([name, value]) => `${name}=${value}`)
            .join('|')}]`,
  }),
}));

jest.mock('@/lib/intl-formatting', () => ({
  formatList: (parts: readonly string[]) => parts.join(', '),
}));

const NOW = '2026-09-14T09:00:00.000Z';

/** Ό,τι κρατά η φόρμα **μετά** την απόδοση — το κλάδεμα είναι effect. */
let latestScope: readonly OfferKind[] = [];

function Harness({
  property,
  scope = [],
}: {
  property: OwnerProperty | null;
  scope?: readonly OfferKind[];
}): React.JSX.Element {
  const form = useForm<MandateRequestFormValues>({
    defaultValues: { ...emptyMandateRequestForm(NOW), scope },
  });
  const values = form.watch();
  latestScope = values.scope;
  return <ScopeField form={form} values={values} property={property} />;
}

function offered(): readonly string[] {
  return screen.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent ?? '');
}

const APARTMENT = validOwnerProperty({ type: 'apartment', offers: [offerOf('sell', 250_000)] });

describe('Α — οι επιλογές είναι η τομή «μεσιτεία ∧ είδος»', () => {
  it('🔑 Α0 — χωρίς ακίνητο: οι τρεις πράξεις εντολής, ποτέ η βραχυχρόνια', () => {
    render(<Harness property={null} />);
    expect(offered()).toEqual([
      OFFER_KIND_I18N_KEYS.sell,
      OFFER_KIND_I18N_KEYS.leaseOut,
      OFFER_KIND_I18N_KEYS.exchange,
    ]);
  });

  it('🔴 Α1 — διαμέρισμα: ούτε αντιπαροχή ούτε βραχυχρόνια', () => {
    render(<Harness property={APARTMENT} />);
    expect(offered()).toEqual([OFFER_KIND_I18N_KEYS.sell, OFFER_KIND_I18N_KEYS.leaseOut]);
  });
});

describe('Β — αλλαγή ακινήτου ΚΛΑΔΕΥΕΙ, δεν κρύβει', () => {
  it('🔴 Β1 — τσεκαρισμένη αντιπαροχή φεύγει από το `scope` όταν το ακίνητο είναι διαμέρισμα', () => {
    render(<Harness property={APARTMENT} scope={['sell', 'exchange']} />);
    expect(latestScope).toEqual(['sell']);
  });

  it('🔑 Β2 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ό,τι ισχύει ΜΕΝΕΙ', () => {
    render(<Harness property={null} scope={['sell', 'exchange']} />);
    expect(latestScope).toEqual(['sell', 'exchange']);
  });
});

describe('Γ — λέει τι έμεινε έξω και γιατί', () => {
  it('🔴 Γ1 — αγγελία με βραχυχρόνια: η σημείωση ονομάζει τη διάθεση', () => {
    const property = validOwnerProperty({
      type: 'apartment',
      offers: [offerOf('sell', 250_000), offerOf('leaseShort', 65)],
    });
    render(<Harness property={property} />);
    expect(
      screen.getByText(`${SCREEN_KEYS.scopeManagementNote}[kinds=${OFFER_KIND_I18N_KEYS.leaseShort}]`),
    ).toBeTruthy();
  });

  it('🔑 Γ2 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς βραχυχρόνια καμία σημείωση', () => {
    render(<Harness property={APARTMENT} />);
    expect(screen.queryByText(new RegExp(SCREEN_KEYS.scopeManagementNote))).toBeNull();
  });
});
