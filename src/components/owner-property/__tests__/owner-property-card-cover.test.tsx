/**
 * @fileoverview ΑΓΚΥΡΑ — **η μικρογραφία της κάρτας «Τα ακίνητά μου»** (ADR-777 §8.70).
 * @related components/owner-property/OwnerPropertyCardCover.tsx
 *
 * 🔑 Με τον **πραγματικό** loader του `property-market` και **πραγματικό** ICU: ένα mock του
 * `t` που επιστρέφει το κλειδί θα ήταν πράσινο για κείμενο που ο άνθρωπος δεν βλέπει ποτέ
 * (το μάθημα του `owner-listing-completion.test.tsx`).
 *
 * ⛔ Και η απουσία **δεν γεμίζει**: χωρίς μικρογραφία δεν αποδίδεται **κανένα** `<img>`.
 *
 * 🗺️ **Φάση 2**: χωρίς φωτογραφία αλλά με σημάδι ⇒ ο χάρτης θέσης, με την απόδοση του παρόχου
 * και τη θεραπεία «Πρόσθεσε φωτογραφίες» από πάνω. Χωρίς provider ή σε αποτυχία ⇒ η απουσία.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';

import { getNamespaceLoader } from '@/i18n/namespace-loaders';
import type { OwnerPropertyPublication } from '@/types/owner-property';
import type { MapSnapshotState } from '@/lib/maps/map-snapshot-store';
import {
  ListingMapSnapshotContext,
  type ListingSnapshotStore,
} from '@/components/listing-map-snapshot/use-listing-map-snapshot';

import { OwnerPropertyCardCover } from '../OwnerPropertyCardCover';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const reactI18next = jest.requireActual('react-i18next');
  return {
    useTranslation: (ns: readonly string[]) => reactI18next.useTranslation(ns as string[]),
  };
});

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const instance = i18next.createInstance();

const THUMBNAIL = {
  url: 'https://shelf/0-2560.webp',
  width: 2560,
  height: 1700,
  sources: [
    { url: 'https://shelf/0-640.webp', width: 640 },
    { url: 'https://shelf/0-2560.webp', width: 2560 },
  ],
};

function publication(
  thumbnail: OwnerPropertyPublication['thumbnail'],
  mapMark: OwnerPropertyPublication['mapMark'] = null,
): OwnerPropertyPublication {
  return { outcome: 'published', at: '2026-09-23T10:00:00.000Z', thumbnail, mapMark };
}

const MARK = { shape: 'shaded-city', point: { lat: 40.63, lng: 22.95 } } as const;

/** Κατάστημα που απαντά την ίδια κατάσταση για κάθε κλειδί — μετράμε την ΚΑΡΤΑ, όχι την ουρά. */
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
  const loader = getNamespaceLoader('el', 'property-market' as never);
  expect(loader).not.toBeNull();
  const mod = await loader!();
  const propertyMarket = (mod as { default?: unknown }).default ?? mod;

  await instance
    .use(new ICU({ bindI18n: 'languageChanged', bindI18nStore: 'added removed' }))
    .use(initReactI18next)
    .init({
      lng: 'el',
      fallbackLng: 'el',
      resources: { el: { 'property-market': propertyMarket } as Record<string, Record<string, unknown>> },
      ns: ['property-market'],
      defaultNS: 'property-market',
      react: { useSuspense: false },
      interpolation: { escapeValue: false },
    });
});

function renderCover(pub: OwnerPropertyPublication | undefined, priority = false, store?: ListingSnapshotStore) {
  const cover = (
    <OwnerPropertyCardCover
      property={{ id: 'ownp_1', title: 'Οικόπεδο στη Νέδουσα', publication: pub }}
      priority={priority}
    />
  );
  return render(
    <I18nextProvider i18n={instance}>
      {store === undefined ? cover : (
        <ListingMapSnapshotContext.Provider value={store}>{cover}</ListingMapSnapshotContext.Provider>
      )}
    </I18nextProvider>,
  );
}

function expectAbsence(): void {
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByText('Δεν έχει δημοσιευμένη φωτογραφία')).toBeInTheDocument();
}

describe('με μικρογραφία — ό,τι βλέπει ο κόσμος', () => {
  it('αποδίδει την εικόνα με srcset, διαστάσεις και ελληνικό alt με τον τίτλο', () => {
    renderCover(publication(THUMBNAIL));

    const image = screen.getByRole('img', { name: 'Φωτογραφία: Οικόπεδο στη Νέδουσα' });
    expect(image).toHaveAttribute('src', THUMBNAIL.url);
    expect(image).toHaveAttribute('srcset', 'https://shelf/0-640.webp 640w, https://shelf/0-2560.webp 2560w');
    expect(image).toHaveAttribute('width', '2560');
    expect(image).toHaveAttribute('height', '1700');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('η πρώτη κάρτα φορτώνει με υψηλή προτεραιότητα', () => {
    renderCover(publication(THUMBNAIL), true);

    expect(screen.getByRole('img')).toHaveAttribute('loading', 'eager');
  });
});

describe('⛔ χωρίς μικρογραφία — η απουσία ΔΕΝ γεμίζει', () => {
  it.each([
    ['δεν δημοσιεύτηκε φωτογραφία', publication(null)],
    ['έγγραφο πριν το πεδίο', undefined],
  ])('%s ⇒ κανένα <img>, κείμενο κατάστασης και σύνδεσμος θεραπείας', (_label, pub) => {
    renderCover(pub);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Δεν έχει δημοσιευμένη φωτογραφία')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Πρόσθεσε φωτογραφίες' })).toHaveAttribute(
      'href',
      expect.stringContaining('ownp_1'),
    );
  });
});

describe('🗺️ χωρίς φωτογραφία, με σημάδι — ο χάρτης θέσης (Φάση 2)', () => {
  const originalObserver = global.IntersectionObserver;

  /** Παρατηρητής που δηλώνει την κάρτα ορατή μόλις παρατηρηθεί — το `jest.setup` δεν πυροδοτεί ποτέ. */
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

  it('🔑 πριν φανεί η κάρτα ⇒ ΚΑΝΕΝΑ αίτημα (η MapLibre δεν φορτώνεται για κρυμμένες κάρτες)', () => {
    global.IntersectionObserver = originalObserver;
    const store = fixedStore(undefined);
    renderCover(publication(null, MARK), false, store);

    expect(store.requests).toHaveLength(0);
  });

  it('🔑 έτοιμο στιγμιότυπο ⇒ εικόνα χάρτη, απόδοση με σύνδεσμο OSM, και η θεραπεία από πάνω', () => {
    const ready: MapSnapshotState = {
      status: 'ready',
      url: 'blob:snapshot-0',
      attribution: [
        { text: '© ' },
        { text: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
        { text: ' contributors' },
      ],
    };
    const store = fixedStore(ready);
    renderCover(publication(null, MARK), false, store);

    const image = screen.getByRole('img', {
      name: 'Η θέση στον χάρτη όπως τη βλέπει ο κόσμος: Οικόπεδο στη Νέδουσα',
    });
    expect(image).toHaveAttribute('src', 'blob:snapshot-0');
    expect(screen.getByRole('link', { name: 'OpenStreetMap' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    );
    expect(screen.getByRole('link', { name: 'Πρόσθεσε φωτογραφίες' })).toBeInTheDocument();
    expect(store.requests).toHaveLength(1);
  });

  it('σε αναμονή ⇒ κανένα <img>, δηλωμένη φόρτωση για αναγνώστη οθόνης', () => {
    renderCover(publication(null, MARK), false, fixedStore(undefined));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Φόρτωση χάρτη θέσης')).toBeInTheDocument();
    expect(screen.getByRole('figure')).toHaveAttribute('aria-busy', 'true');
  });

  it('🔴 αποτυχία απόδοσης ⇒ η δηλωμένη απουσία, ποτέ σπασμένη εικόνα', () => {
    renderCover(publication(null, MARK), false, fixedStore({ status: 'failed' }));
    expectAbsence();
  });

  it('χωρίς provider ⇒ η δηλωμένη απουσία', () => {
    renderCover(publication(null, MARK));
    expectAbsence();
  });

  it('🔴 σημάδι-σκουπίδι από τον δίσκο ⇒ η απουσία, και ΚΑΝΕΝΑ αίτημα χάρτη', () => {
    const store = fixedStore(undefined);
    const garbage = { shape: 'pin', point: { lat: 'x', lng: 0 } } as unknown as OwnerPropertyPublication['mapMark'];
    renderCover(publication(null, garbage), false, store);

    expectAbsence();
    expect(store.requests).toHaveLength(0);
  });

  it('φωτογραφία ΚΑΙ σημάδι ⇒ κερδίζει η φωτογραφία, κανένα αίτημα χάρτη', () => {
    const store = fixedStore(undefined);
    renderCover(publication(THUMBNAIL, MARK), false, store);

    expect(screen.getByRole('img', { name: 'Φωτογραφία: Οικόπεδο στη Νέδουσα' })).toBeInTheDocument();
    expect(store.requests).toHaveLength(0);
  });
});
