/**
 * @file ADR-898 §21.6 Ε11 — κάθε καρτέλα του εργοστασίου έχει ΕΤΙΚΕΤΑ, όχι την ωμή της `id`.
 *
 * 🔴 Γιατί υπάρχει: το `createTabsConfig` λύνει την ετικέτα ως `labels[id] || id`. Καρτέλα που λείπει από το
 * λεξιλόγιο της οντότητάς της **δεν σπάει τίποτα** — απλώς δείχνει `history` στον άνθρωπο. Έτσι η καρτέλα
 * ιστορικού της θέσης στάθμευσης έμεινε ωμό αγγλικό, ενώ οι αδελφές (μονάδα, αποθήκη) ήταν σωστές.
 *
 * Τι κλειδώνει:
 * - Ε1: για ΚΑΘΕ οντότητα (και κάθε τύπο επαφής) καμία καρτέλα δεν έχει `label === id`.
 * - Ε2: η ετικέτα είναι κλειδί i18n (`a.b…`), όχι ελεύθερο κείμενο.
 * - Ε3: για τις οντότητες του namespace `building-tabs`, το κλειδί ΥΠΑΡΧΕΙ σε `el` και `en`.
 */

import { createTabsConfig, type TabEntityType } from '../unified-tabs-factory';
import type { ContactType } from '@/types/contacts';
import elBuildingTabs from '@/i18n/locales/el/building-tabs.json';
import enBuildingTabs from '@/i18n/locales/en/building-tabs.json';

/**
 * `Record` ⇒ νέα οντότητα στο `TabEntityType` δεν μεταγλωττίζεται αν δεν μπει εδώ.
 * `false` = το εργοστάσιο τη **δηλώνει** αλλά δεν την υλοποιεί (πετά)· το Ε0 το επαληθεύει, ώστε όποιος
 * την υλοποιήσει να αναγκαστεί να τη γυρίσει σε `true` και να περάσει από το Ε1.
 */
const ENTITY_TYPES: Record<TabEntityType, boolean> = {
  properties: true,
  storage: true,
  building: true,
  parking: true,
  'property-dossier': true,
  contact: false,
  project: false,
  'crm-dashboard': false,
};

const CONTACT_TYPES: Record<ContactType, true> = { individual: true, company: true, service: true };

const UNIMPLEMENTED = (Object.keys(ENTITY_TYPES) as TabEntityType[]).filter((entity) => !ENTITY_TYPES[entity]);

/** Οι οντότητες που η οθόνη τους μεταφράζει με το namespace `building-tabs`. */
const BUILDING_TABS_NAMESPACE: readonly TabEntityType[] = ['properties', 'storage', 'parking'];

interface Case {
  readonly name: string;
  readonly entity: TabEntityType;
  readonly contactType?: ContactType;
}

const CASES: Case[] = (Object.keys(ENTITY_TYPES) as TabEntityType[])
  .filter((entity) => ENTITY_TYPES[entity])
  .flatMap((entity): Case[] =>
  entity === 'contact'
    ? (Object.keys(CONTACT_TYPES) as ContactType[]).map((contactType) => ({
        name: `contact/${contactType}`,
        entity,
        contactType,
      }))
    : [{ name: entity, entity }],
);

function resolveKey(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    tree,
  );
}

describe('ADR-898 Ε11 — ετικέτες καρτελών', () => {
  it('ο πίνακας περιπτώσεων δεν είναι κενός', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(5);
  });

  it.each(UNIMPLEMENTED)('Ε0: %s — δηλωμένη αλλά ανυλοποίητη (πετά)· αν υλοποιηθεί, μπαίνει στο Ε1', (entity) => {
    expect(() => createTabsConfig(entity, 'individual')).toThrow();
  });

  it.each(CASES)('Ε1+Ε2: $name — καμία καρτέλα με ωμή id ως ετικέτα', ({ entity, contactType }) => {
    const tabs = createTabsConfig(entity, contactType);
    expect(tabs.length).toBeGreaterThan(0);
    const raw = tabs.filter((tab) => tab.label === tab.id || !/^[\w-]+(?::[\w-]+)?(?:\.[\w-]+)+$/.test(tab.label));
    expect(raw.map((tab) => `${tab.id} → «${tab.label}»`)).toEqual([]);
  });

  it.each(BUILDING_TABS_NAMESPACE)('Ε3: %s — κάθε κλειδί υπάρχει σε el και en', (entity) => {
    const missing = createTabsConfig(entity).flatMap((tab) =>
      [
        ['el', elBuildingTabs],
        ['en', enBuildingTabs],
      ]
        .filter(([, tree]) => typeof resolveKey(tree, tab.label) !== 'string')
        .map(([lang]) => `${lang}: ${tab.label}`),
    );
    expect(missing).toEqual([]);
  });
});
