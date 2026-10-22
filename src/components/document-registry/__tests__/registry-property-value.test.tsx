/**
 * @fileoverview ADR-915 §37.6 — **το ακίνητο μιας γραμμής του μητρώου πατιέται σε κινητό** (WCAG 2.2 SC 2.5.8).
 *
 * 🔴 Μετρημένο στις 390 px (2026-10-21): όνομα ακινήτου σε δύο γραμμές + «Έγγραφα ακινήτου» από κάτω, στόχοι 20 px
 *    που **εφάπτονται**. Το jsdom δεν έχει διάταξη — η μέτρηση ζει στον browser· εδώ αγκυρώνεται ότι **κάθε** σύνδεσμος
 *    ζητά τον ΕΝΑ ελάχιστο στόχο (`TOUCH_TARGET_MIN`), σε **όλα** τα είδη ακινήτου, όχι στο δείγμα που μετρήθηκε.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import { RegistryPropertyValue } from '../RegistryPropertyValue';
import { TOUCH_TARGET_MIN } from '@/design-system/touch-target';
import {
  REGISTRY_PROPERTY_SCOPES,
  type RegistryPropertyLabel,
  type RegistryPropertyScope,
} from '@/services/document-registry/document-registry.types';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const TARGET_CLASSES = TOUCH_TARGET_MIN.split(' ');

function labelOf(scope: RegistryPropertyScope): RegistryPropertyLabel {
  return {
    name: 'Στούντιο 35 τ.μ.',
    scope,
    areaId: null,
    ownerContactIds: null,
    obligorLead: null,
    ownerShares: {},
    propertyClass: null,
    phase: null,
  };
}

function renderValue(scope: RegistryPropertyScope): HTMLAnchorElement[] {
  render(
    <dl>
      <RegistryPropertyValue propertyId="p1" names={{ properties: { p1: labelOf(scope) } }} />
    </dl>,
  );
  return screen.getAllByRole('link') as HTMLAnchorElement[];
}

describe('RegistryPropertyValue — στόχος αφής (WCAG 2.5.8)', () => {
  it.each(REGISTRY_PROPERTY_SCOPES)('%s: κάθε σύνδεσμος ζητά τον ελάχιστο στόχο', (scope) => {
    const links = renderValue(scope);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.className.split(' ')).toEqual(expect.arrayContaining(TARGET_CLASSES));
  });

  it('ακίνητο εταιρείας: δύο σύνδεσμοι (όνομα + έγγραφα) — ο παρονομαστής του ελέγχου', () => {
    expect(renderValue('property')).toHaveLength(2);
  });
});
