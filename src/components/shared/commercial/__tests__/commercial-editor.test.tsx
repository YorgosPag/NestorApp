/**
 * ⚓ ADR-777 §8.60.18 — ο ΕΠΕΞΕΡΓΑΣΤΗΣ διάθεσης (κάρτα + κελί γρήγορης επεξεργασίας) και η
 * τιμή με μονάδα στις κάρτες των λιστών.
 *
 * Η ζωντανή επαλήθευση της Φάσης 4 βρήκε ότι **κανένα** χειριστήριο δεν έγραφε διάθεση χώρου.
 * Εδώ ακολουθείται η τιμή από το κλικ **μέχρι το σώμα του PATCH** — όχι μόνο ότι «ζωγραφίζεται».
 */

import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/select', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  type Ctx = { value: string; onValueChange: (v: string) => void; disabled?: boolean };
  const SelectCtx = ReactActual.createContext<Ctx | null>(null);
  return {
    Select: ({ value, onValueChange, disabled, children }: Ctx & { children: React.ReactNode }) => (
      <SelectCtx.Provider value={{ value, onValueChange, disabled }}>{children}</SelectCtx.Provider>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const ctx = ReactActual.useContext(SelectCtx);
      return (
        <select aria-label="commercial-status" value={ctx?.value} disabled={ctx?.disabled}
          onChange={(e) => ctx?.onValueChange(e.target.value)}>
          {children}
        </select>
      );
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
  };
});

import { PRICE_RANGE_ROLE_KEY, PRICE_AMOUNT_KEY } from '@/lib/listings/listing-price-keys';
import type { PriceLabelT } from '@/lib/listings/listing-price-label';
import { priceStat } from '@/domain/cards/shared/spot-card-stats';
import { useCommercialDraft, useSpaceCommercial } from '../useCommercialDraft';
import { CommercialDraftCell } from '../CommercialDraftCell';
import { SpaceCommercialCard } from '../SpaceCommercialCard';

const unlisted = { commercialStatus: 'unavailable', commercial: null };
const sold = { commercialStatus: 'sold', commercial: { askingPrice: 12000, finalPrice: 11500 } };

/** Το κελί γρήγορης επεξεργασίας + το σώμα του PATCH που θα έστελνε — ένα `renderHook`. */
function renderCell(source: typeof unlisted | typeof sold) {
  const hook = renderHook(() => useCommercialDraft(source));
  const view = render(<CommercialDraftCell commercial={hook.result.current} disabled={false} idPrefix="row" />);
  const rerender = () => view.rerender(<CommercialDraftCell commercial={hook.result.current} disabled={false} idPrefix="row" />);
  return { hook, rerender };
}

describe('Α. ΚΕΛΙ ΓΡΗΓΟΡΗΣ ΕΠΕΞΕΡΓΑΣΙΑΣ — ΑΠΟ ΤΟ ΚΛΙΚ ΣΤΟ ΣΩΜΑ ΤΟΥ PATCH', () => {
  it('🔴 Α1 — το περιστατικό: «προς ενοικίαση» + «60» ⇒ `{ commercialStatus, commercial: { rentPrice: 60 } }`', () => {
    const { hook, rerender } = renderCell(unlisted);
    act(() => { fireEvent.change(screen.getByLabelText('commercial-status'), { target: { value: 'for-rent' } }); });
    rerender();
    // Η διάθεση ΟΔΗΓΕΙ τα πεδία: ενοίκιο «(€/μήνα)», ΚΑΜΙΑ τιμή πώλησης.
    expect(screen.queryByLabelText(PRICE_RANGE_ROLE_KEY.sale)).toBeNull();
    act(() => { fireEvent.change(screen.getByLabelText(PRICE_RANGE_ROLE_KEY.rent), { target: { value: '60' } }); });
    expect(hook.result.current.patchAgainst(unlisted))
      .toEqual({ commercialStatus: 'for-rent', commercial: { rentPrice: 60 } });
  });

  it('Α2 — ο επιλογέας προσφέρει ΜΟΝΟ τις καταστάσεις αγοράς (κράτηση/πώληση = συναλλαγή)', () => {
    renderCell(unlisted);
    const options = [...(screen.getByLabelText('commercial-status') as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toEqual(['unavailable', 'for-sale', 'for-rent', 'for-sale-and-rent']);
  });

  it('🔴 Α3 — πωλημένη θέση: κατάσταση ΚΑΙ τιμή κλειδωμένες (η συναλλαγή την κατέχει)', () => {
    renderCell(sold);
    expect((screen.getByLabelText('commercial-status') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText(PRICE_RANGE_ROLE_KEY.sale) as HTMLInputElement).disabled).toBe(true);
  });
});

describe('Β. ΚΑΡΤΑ «ΔΙΑΘΕΣΗ & ΤΙΜΗ»', () => {
  it('Β1 — «πώληση και ενοικίαση» ⇒ δύο πεδία, το καθένα με τη μονάδα του', () => {
    const { result } = renderHook(() => useCommercialDraft({ commercialStatus: 'for-sale-and-rent' }));
    render(<SpaceCommercialCard commercial={result.current} area={12} pricingType="parking" isEditing idPrefix="p" />);
    expect(screen.getByLabelText(PRICE_RANGE_ROLE_KEY.sale)).toBeTruthy();
    expect(screen.getByLabelText(PRICE_RANGE_ROLE_KEY.rent)).toBeTruthy();
  });

  it('Β2 — κατάσταση συναλλαγής ⇒ λέει ΓΙΑΤΙ είναι κλειδωμένη', () => {
    const { result } = renderHook(() => useCommercialDraft(sold));
    render(<SpaceCommercialCard commercial={result.current} area={12} pricingType="parking" isEditing idPrefix="p" />);
    expect(screen.getByText('commercialCard.transactionLocked')).toBeTruthy();
  });

  it('Β3 — εκτός επεξεργασίας: τίποτα δεν αλλάζει', () => {
    const { result } = renderHook(() => useCommercialDraft({ commercialStatus: 'for-rent', commercial: { rentPrice: 60 } }));
    render(<SpaceCommercialCard commercial={result.current} area={12} pricingType="parking" isEditing={false} idPrefix="p" />);
    expect((screen.getByLabelText(PRICE_RANGE_ROLE_KEY.rent) as HTMLInputElement).disabled).toBe(true);
  });
});

describe('Δ. Η ΣΕΛΙΔΑ ΤΟΥ ΧΩΡΟΥ — ΤΟ ΠΡΟΧΕΙΡΟ ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΕΠΙΛΟΓΗ, ΟΧΙ ΤΟ REFETCH', () => {
  type Space = { id: string; commercialStatus: string; commercial: { rentPrice: number } | null };
  const theta: Space = { id: 'park_theta', commercialStatus: 'for-rent', commercial: { rentPrice: 60 } };
  const iota: Space = { id: 'park_iota', commercialStatus: 'unavailable', commercial: null };

  it('Δ1 — επιλογή ΑΛΛΟΥ χώρου ⇒ το πρόχειρο ξαναγεμίζει από εκείνον', () => {
    const { result, rerender } = renderHook(({ space }) => useSpaceCommercial(space), { initialProps: { space: theta } });
    rerender({ space: iota });
    expect(result.current.draft).toEqual({ commercialStatus: 'unavailable', askingPrice: '', rentPrice: '' });
  });

  it('Δ2 — ανανέωση του ΙΔΙΟΥ χώρου (refetch) ⇒ η πληκτρολόγηση του ανθρώπου ΔΕΝ σβήνεται', () => {
    const { result, rerender } = renderHook(({ space }) => useSpaceCommercial(space), { initialProps: { space: theta } });
    act(() => result.current.setPrice('rentPrice', '75'));
    rerender({ space: { ...theta } });
    expect(result.current.draft.rentPrice).toBe('75');
  });
});

describe('Γ. Η ΤΙΜΗ ΣΤΗΝ ΚΑΡΤΑ ΤΗΣ ΛΙΣΤΑΣ — ΜΕ ΜΟΝΑΔΑ', () => {
  const t: PriceLabelT = (key, options) => (options?.price === undefined ? key : `${key}|${String(options.price)}`);

  it('🔴 Γ1 — ΔΟΚΙΜΗ Θ (60 €/μήνα) ⇒ το κλειδί του ΕΝΟΙΚΙΟΥ (ήταν: καμία τιμή — διάβαζε το `price`)', () => {
    const stat = priceStat({ commercialStatus: 'for-rent', commercial: { rentPrice: 60 } }, 'Τιμή', t);
    expect(String(stat?.value).split('|')[0]).toBe(PRICE_AMOUNT_KEY.rent);
  });

  it('Γ2 — πώληση ⇒ το κλειδί της πώλησης· καμία τιμή ⇒ καμία γραμμή', () => {
    expect(String(priceStat({ commercialStatus: 'for-sale', commercial: { askingPrice: 12000 } }, 'Τιμή', t)?.value).split('|')[0])
      .toBe(PRICE_AMOUNT_KEY.sale);
    expect(priceStat({ commercialStatus: 'for-rent' }, 'Τιμή', t)).toBeNull();
  });
});
