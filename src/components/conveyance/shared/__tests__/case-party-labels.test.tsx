/**
 * ⚓ ADR-915 §23.10 — η ΜΙΑ απόδοση ετικέτας γραμμής: «έγγραφο · πρόσωπο» όταν χρειάζεται «ποιος», όπως πριν όταν όχι,
 * «Πωλητής N» όταν λείπει το όνομα. Ο οικοδεσπότης ξαναμετρά πάνω στα **τρέχοντα** πρόσωπα (optimistic).
 * Συνθετικά ονόματα — κανένα πραγματικό.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import { parseRowKey, rowKeyOf } from '@/config/conveyance-checklist/row-key';
import { sellerParty } from '@/lib/conveyance/case-parties';
import type { CasePartyLabel, ConveyanceSellerParty } from '@/types/conveyance-case';
import {
  CasePartyLabelsProvider,
  HostCasePartyLabelsProvider,
  useChecklistRowLabel,
  usePartyName,
  useRowKeyLabel,
} from '../CasePartyLabels';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      (params === undefined ? key : `${key}{${Object.entries(params).map(([name, value]) => `${name}=${value}`).join(',')}}`),
  }),
}));

const co = sellerParty('cont_co', 'legal_entity', 'principal');
const lo = sellerParty('cont_lo', 'person', 'landowner');

function itemOf(id: string) {
  const item = getChecklistItem(id);
  if (item === undefined) throw new Error(id);
  return item;
}

function Probe({ rowKey }: { readonly rowKey: string }) {
  const rowLabel = useChecklistRowLabel();
  const keyLabel = useRowKeyLabel();
  const partyName = usePartyName();
  const parsed = parseRowKey(rowKey);
  const item = itemOf(parsed.itemId);
  return (
    <ul>
      <li data-testid="row">{rowLabel({ itemId: rowKey, item })}</li>
      <li data-testid="key">{keyLabel(rowKey) ?? 'null'}</li>
      <li data-testid="party">{partyName(parsed.partyKey) ?? 'null'}</li>
    </ul>
  );
}

const TAX = itemOf('seller_tax_clearance').labelKey;

function renderAs(labels: readonly CasePartyLabel[], rowKey: string) {
  render(<CasePartyLabelsProvider labels={labels}><Probe rowKey={rowKey} /></CasePartyLabelsProvider>);
}

describe('useChecklistRowLabel · useRowKeyLabel · usePartyName', () => {
  const labels = [{ key: 'cont_co', ordinal: 1, name: '' }, { key: 'cont_lo', ordinal: 2, name: 'Test Landowner' }];

  it('γραμμή προσώπου με όνομα ⇒ «έγγραφο · όνομα», ίδιο από γραμμή και από σκέτο κλειδί', () => {
    renderAs(labels, rowKeyOf('seller_tax_clearance', 'cont_lo'));
    expect(screen.getByTestId('row')).toHaveTextContent(`parties.rowLabel{item=${TAX},party=Test Landowner}`);
    expect(screen.getByTestId('key')).toHaveTextContent(`parties.rowLabel{item=${TAX},party=Test Landowner}`);
    expect(screen.getByTestId('party')).toHaveTextContent('Test Landowner');
  });

  it('όνομα που λείπει ⇒ «Πωλητής N» με τη σειρά του server', () => {
    renderAs(labels, rowKeyOf('seller_tax_clearance', 'cont_co'));
    expect(screen.getByTestId('party')).toHaveTextContent('parties.sellerOrdinal{index=1}');
  });

  it('χωρίς ετικέτες (ένας πωλητής · πρόσωπο που ο θεατής δεν βλέπει) ⇒ η ετικέτα όπως πριν', () => {
    renderAs([], rowKeyOf('seller_tax_clearance', 'cont_lo'));
    expect(screen.getByTestId('row')).toHaveTextContent(new RegExp(`^${TAX}$`));
    expect(screen.getByTestId('party')).toHaveTextContent('null');
  });

  it('κλειδί που δεν είναι γραμμή του καταλόγου ⇒ null (ο καλών λέει «χωρίς όνομα»)', () => {
    function Unknown() {
      return <p>{useRowKeyLabel()(rowKeyOf('no_such_item', 'cont_lo')) ?? 'null'}</p>;
    }
    render(<CasePartyLabelsProvider labels={labels}><Unknown /></CasePartyLabelsProvider>);
    expect(screen.getByText('null')).toBeInTheDocument();
  });
});

describe('HostCasePartyLabelsProvider — optimistic', () => {
  function renderHost(sellers: readonly ConveyanceSellerParty[], labels: readonly CasePartyLabel[]) {
    render(<HostCasePartyLabelsProvider sellers={sellers} labels={labels}><Probe rowKey={rowKeyOf('seller_tax_clearance', 'cont_lo')} /></HostCasePartyLabelsProvider>);
  }

  it('πρόσωπο που μόλις μπήκε (όψη με έναν) ⇒ «Πωλητής 2» ώσπου να έρθει το όνομα', () => {
    renderHost([co, lo], []);
    expect(screen.getByTestId('party')).toHaveTextContent('parties.sellerOrdinal{index=2}');
  });

  it('το όνομα της τελευταίας όψης κρατιέται πάνω στη νεότερη λίστα', () => {
    renderHost([co, lo], [{ key: 'cont_co', ordinal: 1, name: 'Test Builder' }, { key: 'cont_lo', ordinal: 2, name: 'Test Landowner' }]);
    expect(screen.getByTestId('party')).toHaveTextContent('Test Landowner');
  });

  it('αφαίρεση ⇒ ένας πωλητής ⇒ καμία ετικέτα, ακόμη κι αν η παλιά όψη είχε ονόματα', () => {
    renderHost([lo], [{ key: 'cont_co', ordinal: 1, name: 'Test Builder' }, { key: 'cont_lo', ordinal: 2, name: 'Test Landowner' }]);
    expect(screen.getByTestId('party')).toHaveTextContent('null');
  });
});
