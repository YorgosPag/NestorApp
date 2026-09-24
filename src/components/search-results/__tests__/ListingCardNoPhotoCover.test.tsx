/**
 * @fileoverview 🗺️ **ΑΓΚΥΡΑ — κάρτα αγγελίας χωρίς φωτογραφία** (ADR-777 §8.80).
 * @related components/search-results/ListingCardNoPhotoCover.tsx · listing-map-snapshot/MapOrAbsenceCover
 *
 * Τρεις καταστάσεις, **ένα πλαίσιο** (3:2): χάρτης θέσης όταν υπάρχει δημόσιο σημάδι και provider,
 * δηλωμένη απουσία όταν όχι — και **ποτέ** εικονίδιο σπιτιού ή ξένη φωτογραφία (§25.5.2).
 * Με **πραγματικό** loader του `search-results` και πραγματικό ICU: κείμενο που βλέπει ο άνθρωπος.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { i18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';

import { createRealI18n } from '@/test-utils/real-i18n';
import type { MapSnapshotState } from '@/lib/maps/map-snapshot-store';
import type { ListingPosition } from '@/types/public-listing';
import {
  ListingMapSnapshotContext,
  type ListingSnapshotStore,
} from '@/components/listing-map-snapshot/use-listing-map-snapshot';

import { ListingCardNoPhotoCover } from '../ListingCardNoPhotoCover';
import { LISTING_CARD_ASPECT_CLASS } from '../listing-card-frame';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const reactI18next = jest.requireActual('react-i18next');
  return {
    useTranslation: (ns: readonly string[]) => reactI18next.useTranslation(ns as string[]),
  };
});

let instance: i18n;

const KNOWN: ListingPosition = {
  kind: 'known',
  provenance: 'manual',
  point: { lat: 40.64, lng: 22.94 },
  locatedAt: '2026-09-06T00:00:00.000Z',
};

const UNKNOWN: ListingPosition = { kind: 'unknown', reason: 'never-asked' };

function fixedStore(state: MapSnapshotState | undefined): ListingSnapshotStore & { readonly requests: string[] } {
  const requests: string[] = [];
  return {
    requests,
    request: (key) => {
      requests.push(key);
    },
    get: () => state,
    size: () => requests.length,
    takeNext: () => null,
    settle: () => undefined,
    subscribe: () => () => undefined,
    dispose: () => undefined,
  };
}

beforeAll(async () => {
  instance = await createRealI18n(['common-photos', 'common']);
});

const originalObserver = global.IntersectionObserver;
beforeEach(() => {
  global.IntersectionObserver = class {
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element): void {
      this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  global.IntersectionObserver = originalObserver;
});

function renderCover(position: ListingPosition, store?: ListingSnapshotStore) {
  const cover = <ListingCardNoPhotoCover listing={{ title: 'Στούντιο 35 τ.μ.', position }} />;
  return render(
    <I18nextProvider i18n={instance}>
      {store === undefined ? cover : (
        <ListingMapSnapshotContext.Provider value={store}>{cover}</ListingMapSnapshotContext.Provider>
      )}
    </I18nextProvider>,
  );
}

describe('ListingCardNoPhotoCover', () => {
  it('🗺️ έτοιμο στιγμιότυπο ⇒ ο χάρτης της θέσης, με alt που λέει ότι είναι ΧΑΡΤΗΣ και τίνος', () => {
    const store = fixedStore({ status: 'ready', url: 'blob:snap', attribution: [] });
    renderCover(KNOWN, store);

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('src', 'blob:snap');
    expect(image).toHaveAttribute('alt', 'Θέση στον χάρτη: Στούντιο 35 τ.μ.');
    expect(store.requests).toHaveLength(1);
  });

  it('🔑 το πλαίσιο είναι ΤΟ ΙΔΙΟ με της φωτογραφίας — ίδιο ύψος, όχι σκαλοπάτια', () => {
    renderCover(KNOWN, fixedStore(undefined));
    expect(screen.getByRole('figure').className).toContain(LISTING_CARD_ASPECT_CLASS);
  });

  it('χωρίς provider ⇒ δηλωμένη απουσία ΣΤΟ ΙΔΙΟ πλαίσιο, κανένα <img>', () => {
    renderCover(KNOWN);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Χωρίς φωτογραφία')).toBeInTheDocument();
    expect(screen.getByRole('figure').className).toContain(LISTING_CARD_ASPECT_CLASS);
  });

  it('🔴 χωρίς δημόσια θέση ⇒ απουσία, και ΚΑΝΕΝΑ αίτημα χάρτη', () => {
    const store = fixedStore(undefined);
    renderCover(UNKNOWN, store);
    expect(screen.getByText('Χωρίς φωτογραφία')).toBeInTheDocument();
    expect(store.requests).toHaveLength(0);
  });

  it('🔴 αποτυχία απόδοσης ⇒ απουσία, ποτέ σπασμένη εικόνα', () => {
    renderCover(KNOWN, fixedStore({ status: 'failed' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Χωρίς φωτογραφία')).toBeInTheDocument();
  });
});
