/**
 * Ο επεξεργαστής ιδιότητας **αποδίδεται** για κάθε έναν από τους 11 τύπους (κάθε κλάδος του dispatcher), και η
 * αλλαγή τύπου δεν κουβαλά ποτέ ρύθμιση άλλου τύπου.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import type { AttributeGroupRecord, AttributeRecord, FamilyRecord } from '@/services/catalog/catalog-api.client';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';
import { validateAttribute } from '@/subapps/catalog/schema/validate-attribute';
import { ATTRIBUTE_TYPES } from '@/subapps/catalog/vocabulary/attribute-types';
import { attributeDraftOf, emptyAttributeDraft, withAttributeType } from '../attribute-draft';
import { AttributeEditor } from '../AttributeEditor';

jest.setTimeout(60_000);

jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ pending: false, verdict: 'granted-by-role' }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

const group: AttributeGroupRecord = {
  code: 'general', labels: { el: 'Γενικά' }, orderKey: 'a0', id: 'g1', companyId: 'c', revision: 1, isDeleted: false,
  createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: null, deletedBy: null,
};

const ops: CatalogOptimistic<AttributeRecord> = { view: [], settled: [], pendingKeys: new Set(), submit: jest.fn() };

describe('AttributeEditor — κάθε τύπος αποδίδεται', () => {
  it.each(ATTRIBUTE_TYPES)('%s', (type) => {
    const blank = withAttributeType(emptyAttributeDraft('g1', 'a0', PLATFORM_MEASUREMENT_REGISTRY), type, PLATFORM_MEASUREMENT_REGISTRY);
    render(
      <AttributeEditor record={null} blank={blank} groups={[group]} families={[]} registry={PLATFORM_MEASUREMENT_REGISTRY}
        ops={ops} canManage orderKeyAtEnd={() => 'a1'} onCreated={jest.fn()} />,
    );
    expect(screen.getByText('attributes.fields.settings')).toBeInTheDocument();
  });

  it('η προεπιλογή κάθε τύπου περνά τον επικυρωτή — εκτός από ό,τι ΠΡΕΠΕΙ να αποφασίσει ο άνθρωπος', () => {
    const base = { ...emptyAttributeDraft('g1', 'a0', PLATFORM_MEASUREMENT_REGISTRY), code: 'x', labels: { el: 'X' } };
    const failing = ATTRIBUTE_TYPES.filter((type) => validateAttribute(withAttributeType(base, type, PLATFORM_MEASUREMENT_REGISTRY), PLATFORM_MEASUREMENT_REGISTRY).length > 0);
    // Επιλογές (select/multiSelect) και ετικέτες στηλών πίνακα: αποφάσεις του ανθρώπου, όχι προεπιλογές.
    expect(failing.sort()).toEqual(['multiSelect', 'select', 'table']);
  });
});

describe('AttributeEditor — αναζητήσιμη από πελάτες (ADR-923 §5.12)', () => {
  const blank = emptyAttributeDraft('g1', 'a0', PLATFORM_MEASUREMENT_REGISTRY);
  const stored = { ...group, ...blank, code: 'note', labels: { el: 'Σημείωση' }, groupId: 'g1', measurementFamilyCodes: [] } as unknown as AttributeRecord;
  const { searchable: _flag, ...oldRecord } = stored;
  const family = { id: 'f1', code: 'fan', labels: { el: 'Fan' }, attributes: [{ attributeId: 'g1', requiredChannels: [] }], attributeIds: ['g1'] } as unknown as FamilyRecord;
  const editor = (record: AttributeRecord | null, draft = blank, families: readonly FamilyRecord[] = [], submit = jest.fn()) => render(
    <AttributeEditor record={record} blank={draft} groups={[group]} families={families} registry={PLATFORM_MEASUREMENT_REGISTRY}
      ops={{ ...ops, submit }} canManage orderKeyAtEnd={() => 'a1'} onCreated={jest.fn()} />,
  );
  const toggle = (name: string) => screen.getByRole('switch', { name: new RegExp(name) });

  it('🔴 κλειστή προεπιλογή, και παλιά εγγραφή χωρίς το πεδίο δεν δίνει ποτέ `undefined`', () => {
    expect(blank.searchable).toBe(false);
    expect(attributeDraftOf(oldRecord as AttributeRecord).searchable).toBe(false);
    expect(attributeDraftOf({ ...stored, searchable: true }).searchable).toBe(true);
  });

  it('🔴 αλλαγή τύπου σβήνει τη σημαία', () => {
    const on = { ...blank, searchable: true };
    expect(withAttributeType(on, 'richText', PLATFORM_MEASUREMENT_REGISTRY).searchable).toBe(false);
  });

  it('ο διακόπτης εμφανίζεται μόνο σε κείμενο', () => {
    editor(null, withAttributeType(blank, 'richText', PLATFORM_MEASUREMENT_REGISTRY));
    expect(screen.queryByText('attributes.fields.searchable')).toBeNull();
  });

  it('🔴 το άναμμα του «ανά κανάλι» κρύβει και σβήνει τη σημαία', () => {
    const submit = jest.fn();
    editor(null, { ...blank, code: 'note', labels: { el: 'Σ' }, searchable: true }, [], submit);
    expect(toggle('attributes.fields.searchable').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle('attributes.fields.scopable'));
    expect(screen.queryByText('attributes.fields.searchable')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /editor\.|common\.save/ }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0].optimistic).toEqual(expect.objectContaining({ scopable: true, searchable: false }));
  });

  it('🔴 αλλαγή σημαίας σε ιδιότητα που χρησιμοποιείται ⇒ η πρόταση επανυπολογισμού εμφανίζεται μετά την αποθήκευση', () => {
    const submit = jest.fn();
    editor(stored, blank, [{ ...family, attributeIds: [stored.id], attributes: [{ attributeId: stored.id, requiredChannels: [] }] }], submit);
    expect(screen.queryByText('recompute.searchIndexPrompt')).toBeNull();
    fireEvent.click(toggle('attributes.fields.searchable'));
    fireEvent.click(screen.getByRole('button', { name: /editor\.|common\.save/ }));
    act(() => submit.mock.calls[0][0].onSettled({ ok: true, record: { ...stored, searchable: true } }));
    expect(screen.getByText('recompute.searchIndexPrompt')).toBeInTheDocument();
  });

  it('🔴 ιδιότητα χωρίς οικογένεια δεν ζητά επανυπολογισμό', () => {
    const submit = jest.fn();
    editor(stored, blank, [], submit);
    fireEvent.click(toggle('attributes.fields.searchable'));
    fireEvent.click(screen.getByRole('button', { name: /editor\.|common\.save/ }));
    act(() => submit.mock.calls[0][0].onSettled({ ok: true, record: { ...stored, searchable: true } }));
    expect(screen.queryByText('recompute.searchIndexPrompt')).toBeNull();
  });
});
