/**
 * @fileoverview ΑΓΚΥΡΑ — **η μικρογραφία της κάρτας «Τα ακίνητά μου»** (ADR-777 §8.70).
 * @related components/owner-property/OwnerPropertyCardCover.tsx
 *
 * 🔑 Με τον **πραγματικό** loader του `property-market` και **πραγματικό** ICU: ένα mock του
 * `t` που επιστρέφει το κλειδί θα ήταν πράσινο για κείμενο που ο άνθρωπος δεν βλέπει ποτέ
 * (το μάθημα του `owner-listing-completion.test.tsx`).
 *
 * ⛔ Και η απουσία **δεν γεμίζει**: χωρίς μικρογραφία δεν αποδίδεται **κανένα** `<img>`.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';

import { getNamespaceLoader } from '@/i18n/namespace-loaders';
import type { OwnerPropertyPublication } from '@/types/owner-property';

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

function publication(thumbnail: OwnerPropertyPublication['thumbnail']): OwnerPropertyPublication {
  return { outcome: 'published', at: '2026-09-23T10:00:00.000Z', thumbnail };
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

function renderCover(pub: OwnerPropertyPublication | undefined, priority = false) {
  return render(
    <I18nextProvider i18n={instance}>
      <OwnerPropertyCardCover
        property={{ id: 'ownp_1', title: 'Οικόπεδο στη Νέδουσα', publication: pub }}
        priority={priority}
      />
    </I18nextProvider>,
  );
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
