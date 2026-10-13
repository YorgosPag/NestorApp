/**
 * @fileoverview 🧭 **ΑΓΚΥΡΑ — το σήμα χωρικών μέσων** (ADR-777 §8.88).
 * @related components/listings/ListingSpatialBadge · lib/listings/listing-spatial-media (η απόφαση έχει δική της σουίτα)
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: ό,τι βλέπει ο άνθρωπος — με **πραγματικό** loader του `common-photos`, ώστε κλειδί που λείπει να
 * βγαίνει ωμό και να κοκκινίζει εδώ. Και τρεις ιδιότητες που καμία στατική πύλη δεν ρωτά: **ένα** στοιχείο ποτέ δύο,
 * **μη διαδραστικό**, με την επιφάνεια «πάνω σε φωτογραφία» και όχι token θέματος.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { i18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';

import { PHOTO_OVERLAY_SURFACE_CLASS } from '@/components/shared/gallery/photo-overlay-surface';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { createRealI18n } from '@/test-utils/real-i18n';
import type { ListingModel, PublicListing } from '@/types/public-listing';

import { ListingSpatialBadge } from '../ListingSpatialBadge';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const reactI18next = jest.requireActual('react-i18next');
  return {
    useTranslation: (ns: readonly string[]) => reactI18next.useTranslation(ns as string[]),
  };
});

const MODEL: ListingModel = {
  provenance: 'measured',
  value: { url: 'https://shelf.example/model.glb', altKey: 'listing-detail:model.alt.agency' },
  at: '2026-10-13T10:00:00.000Z',
  sourceRef: 'bim',
};

let el: i18n;
let en: i18n;

beforeAll(async () => {
  el = await createRealI18n(['common-photos']);
  en = await createRealI18n(['common-photos'], 'en');
});

function renderBadge(over: Partial<PublicListing>, instance: i18n = el) {
  return render(
    <I18nextProvider i18n={instance}>
      <ListingSpatialBadge listing={listing(over)} className="absolute left-5 top-5" />
    </I18nextProvider>,
  );
}

describe('ListingSpatialBadge — το κείμενο που βλέπει ο άνθρωπος', () => {
  it.each([
    ['μόνο περιήγηση', { tour: { visibility: 'public' } }, '3D περιήγηση'],
    ['μόνο μοντέλο', { models: [MODEL] }, '3D μοντέλο'],
    ['και τα δύο ⇒ ΜΙΑ πρόταση', { models: [MODEL], tour: { visibility: 'on-request' } }, '3D περιήγηση · μοντέλο'],
  ] as const)('%s', (_name, over, text) => {
    renderBadge(over as Partial<PublicListing>);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('και στα αγγλικά — κανένα ωμό κλειδί', async () => {
    renderBadge({ models: [MODEL], tour: { visibility: 'public' } }, en);
    expect(screen.getByText('3D tour · model')).toBeInTheDocument();
  });

  it('χωρίς χωρικά μέσα ⇒ ΤΙΠΟΤΑ, ούτε άδειο κουτί', () => {
    const { container } = renderBadge({});
    expect(container).toBeEmptyDOMElement();
  });
});

describe('🔴 ένα σήμα, μη διαδραστικό, πάνω σε φωτογραφία', () => {
  it('και τα δύο μέσα ⇒ ΕΝΑ στοιχείο με δύο εικονίδια, όχι δύο σήματα', () => {
    const { container } = renderBadge({ models: [MODEL], tour: { visibility: 'public' } });
    expect(container.children).toHaveLength(1);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('δεν είναι κουμπί ούτε σύνδεσμος, και το κλικ το διαπερνά', () => {
    const { container } = renderBadge({ tour: { visibility: 'public' } });
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.tagName).toBe('SPAN');
    expect(container.querySelector('a, button, [tabindex], [role]')).toBeNull();
    expect(badge).toHaveClass('pointer-events-none');
  });

  it('τα εικονίδια είναι διακοσμητικά — το νόημα το λέει το κείμενο', () => {
    const { container } = renderBadge({ models: [MODEL], tour: { visibility: 'public' } });
    for (const icon of container.querySelectorAll('svg')) expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('φορά τη ΜΙΑ επιφάνεια «πάνω σε φωτογραφία», και τη θέση που της έδωσε ο γονέας', () => {
    const { container } = renderBadge({ tour: { visibility: 'public' } });
    const badge = container.firstElementChild as HTMLElement;
    for (const token of PHOTO_OVERLAY_SURFACE_CLASS.split(' ')) expect(badge).toHaveClass(token);
    expect(badge).toHaveClass('absolute', 'left-5', 'top-5');
  });

  /**
   * 🔴 Μετρημένο ζωντανά 2026-10-13: με απλή συνένωση το χάπι κρατούσε **και** το δικό του `max-w-full` **και** το όριο
   * του γονέα, και ο browser εφάρμοζε το πρώτο (`max-width: 100%`) ⇒ το χάπι έφτανε ως την καρδιά. Το jsdom δεν έχει
   * διάταξη· αυτό που **μπορεί** να δει είναι ότι οι δύο κλάσεις δεν συνυπάρχουν ποτέ.
   */
  it('το όριο πλάτους του γονέα ΑΝΤΙΚΑΘΙΣΤΑ το προεπιλεγμένο — ποτέ δύο `max-w` μαζί', () => {
    const { container } = render(
      <I18nextProvider i18n={el}>
        <ListingSpatialBadge listing={listing({ models: [MODEL] })} className="max-w-[calc(100%-6.5rem)]" />
      </I18nextProvider>,
    );
    const badge = container.firstElementChild as HTMLElement;
    expect(badge).toHaveClass('max-w-[calc(100%-6.5rem)]');
    expect(badge).not.toHaveClass('max-w-full');
  });

  it('χωρίς όριο από τον γονέα μένει το προεπιλεγμένο', () => {
    const { container } = render(
      <I18nextProvider i18n={el}>
        <ListingSpatialBadge listing={listing({ models: [MODEL] })} />
      </I18nextProvider>,
    );
    expect(container.firstElementChild).toHaveClass('max-w-full');
  });
});
