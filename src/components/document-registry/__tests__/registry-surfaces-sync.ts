/**
 * ADR-915 §41.5 — **σύγχρονη** εκδοχή του `registry-surfaces.tsx` για τις σουίτες της σελίδας.
 *
 * Η κάρτα της γραμμής είναι τεμπέλικη επιφάνεια (κώδικας + κείμενα, `next/dynamic`). Οι σουίτες ελέγχουν το
 * **περιεχόμενό** της (την ΑΛΗΘΙΝΗ κάρτα), όχι τον φορτωτή· το όριο φόρτωσης το κρίνει ο γεννήτορας του i18n
 * (CHECK 3.34). Ένα σημείο για όλες τις σουίτες — όχι αντίγραφο του mock σε κάθε αρχείο.
 *
 * Χρήση: `jest.mock('@/components/document-registry/registry-surfaces', () => jest.requireActual('./registry-surfaces-sync'));`
 */

import { createElement } from 'react';

import { RegistryDocCard, type RegistryDocCardProps } from '@/components/document-registry/RegistryDocCard';

function SyncRegistryDocCard(props: RegistryDocCardProps) {
  return createElement(RegistryDocCard, props);
}

export const RegistrySurfaces = {
  RegistryDocCard: Object.assign(SyncRegistryDocCard, { preload: (): Promise<void> => Promise.resolve() }),
};
