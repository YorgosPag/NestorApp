/**
 * =============================================================================
 * ΟΙ ΓΡΑΜΜΕΣ ΤΗΣ ΚΑΡΤΑΣ ΑΠΛΟΥ ΠΡΟΪΟΝΤΟΣ (ADR-923 §5.6 · §21.6)
 * =============================================================================
 *
 * «Ετικέτα: τιμή» ανά ιδιότητα της οικογένειας, με τη σειρά της οικογένειας. Κείμενο, εικόνα και η ιδιότητα-όνομα δεν
 * είναι γραμμές (ζουν αλλού στην κάρτα).
 *
 * 🔑 **Σύνθετη ένδειξη** (§21.6): μπαίνει **στη θέση του πρώτου μέρους της** και **απορροφά** τα μέρη της, όπως στα τεχνικά
 *    φυλλάδια («Τροφοδοσία: 1~ 230 V 50 Hz», όχι και τρεις γραμμές Φάσεις/Τάση/Συχνότητα). Μέρος που λείπει ⇒
 *    {@link COMPOSITE_MISSING_MARK}· λείπουν όλα ⇒ καμία γραμμή, όπως κάθε κενή τιμή.
 * 🔑 Μέρος που ανήκει σε **δύο** ενδείξεις απορροφάται και από τις δύο· η καθεμιά τυπώνεται στη θέση του δικού της πρώτου μέρους.
 * 🔑 Ο κανόνας ζει **μία** φορά, στο `absorbComposites` (κοινός με την «Πρόταση γραμμών» του πίνακα).
 * @module subapps/catalog/publishing/card-lines
 */

import type { PreviewWords, TableAttribute } from '../table/catalog-table';
import { compositeDisplaysOf, type CatalogFamilyDefinition, type CompositeDisplay } from '../types/family';
import type { AttributeValue } from '../types/product';
import { absorbComposites, COMPOSITE_MISSING_MARK, composeDisplay } from '../values/composite-display';
import { formatAttributeValue, type ValueTextContext } from '../values/value-text-codec';

interface CardLineInput {
  readonly family: Pick<CatalogFamilyDefinition, 'attributes' | 'labelAttributeId' | 'compositeDisplays'>;
  readonly attributeById: ReadonlyMap<string, TableAttribute>;
  /** Η τιμή της ιδιότητας στο κανάλι και τη γλώσσα της έκδοσης. */
  readonly valueOf: (attributeId: string) => AttributeValue | undefined;
  readonly codec: ValueTextContext;
  readonly text: PreviewWords['text'];
}

const line = (label: string, text: string): readonly string[] => (text === '' ? [] : [`${label}: ${text}`]);

function attributeLine(input: CardLineInput, attributeId: string): readonly string[] {
  const attribute = input.attributeById.get(attributeId);
  if (!attribute || attribute.type === 'richText' || attribute.type === 'asset' || attribute.id === input.family.labelAttributeId) return [];
  return line(input.text(attribute.labels, attribute.code), formatAttributeValue(attribute, input.valueOf(attribute.id), input.codec));
}

function compositeLine(input: CardLineInput, composite: CompositeDisplay): readonly string[] {
  const { text } = composeDisplay(composite, { attributeById: input.attributeById, valueOf: input.valueOf, codec: input.codec }, () => COMPOSITE_MISSING_MARK);
  return line(input.text(composite.labels, composite.id), text);
}

/** Οι γραμμές της κάρτας: ιδιότητες με τη σειρά της οικογένειας, κάθε ένδειξη στη θέση του πρώτου μέρους της. */
export function cardLines(input: CardLineInput): readonly string[] {
  const slots = absorbComposites(input.family.attributes.map((binding) => binding.attributeId), compositeDisplaysOf(input.family));
  return slots.flatMap((slot) => (slot.kind === 'composite' ? compositeLine(input, slot.composite) : attributeLine(input, slot.attributeId)));
}
