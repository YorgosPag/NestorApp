/**
 * ADR-923 §21.6 — οι γραμμές της κάρτας απλού προϊόντος: η σύνθετη ένδειξη μπαίνει στη θέση του πρώτου μέρους και
 * **απορροφά** τα μέρη της (όπως τα τεχνικά φυλλάδια), χωρίς σιωπηλή σύμπτυξη μέρους που λείπει.
 */
import { FULL_SUPPLY, SUPPLY, SUPPLY_ATTRIBUTES, supplyCodec } from '../../__tests__/fixtures/power-supply.fixture';
import type { CompositeDisplay } from '../../types/family';
import type { AttributeValue } from '../../types/product';
import { cardLines } from '../card-lines';

const WEIGHT: AttributeValue = { type: 'measurement', amount: '15.4', unitCode: 'kg' };

const lines = (values: Readonly<Record<string, AttributeValue>>, composites: readonly CompositeDisplay[] = [SUPPLY]) => cardLines({
  family: {
    attributes: ['weight', 'phases', 'voltage', 'frequency'].map((attributeId) => ({ attributeId, requiredChannels: [] })),
    labelAttributeId: null,
    compositeDisplays: composites,
  },
  attributeById: SUPPLY_ATTRIBUTES,
  valueOf: (id) => values[id],
  codec: supplyCodec(),
  text: (value, fallback) => value?.el ?? fallback ?? '',
});

const weightLine = (all: readonly string[]) => all.filter((line) => !line.startsWith('Ηλεκτρική'));

describe('§21.6 κάρτα: η σύνθετη ένδειξη απορροφά τα μέρη της', () => {
  it('μία γραμμή «Ηλεκτρική παροχή», στη θέση του πρώτου μέρους — όχι Φάσεις/Τάση/Συχνότητα χωριστά', () => {
    const all = lines({ weight: WEIGHT, ...FULL_SUPPLY });
    expect(all).toHaveLength(2);
    expect(all[1]).toBe('Ηλεκτρική παροχή: 1~ 230 V 50 Hz');
    expect(weightLine(all)).toHaveLength(1);
  });

  it('🔑 μέρος που λείπει ⇒ «—», ποτέ σιωπηλή σύμπτυξη («1~ 230 V»)', () => {
    const { frequency: _omit, ...partial } = FULL_SUPPLY;
    expect(lines(partial)).toEqual(['Ηλεκτρική παροχή: 1~ 230 V —']);
  });

  it('λείπουν όλα ⇒ καμία γραμμή, όπως κάθε κενή τιμή', () => {
    expect(lines({ weight: WEIGHT })).toHaveLength(1);
  });

  it('χωρίς σύνθετη ένδειξη: κάθε ιδιότητα η δική της γραμμή (όπως πριν)', () => {
    expect(lines({ ...FULL_SUPPLY }, [])).toEqual(['Φάσεις: 1', 'Τάση: 230 V', 'Συχνότητα: 50 Hz']);
  });
});
