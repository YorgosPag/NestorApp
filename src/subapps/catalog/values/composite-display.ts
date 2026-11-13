/**
 * =============================================================================
 * Η ΣΥΝΘΕΤΗ ΕΝΔΕΙΞΗ — η ΜΙΑ συνάρτηση σύνθεσης (ADR-923 §21.6)
 * =============================================================================
 *
 * «Ηλεκτρική παροχή» = «1~ 230 V 50 Hz» από τρεις **δομημένες** ιδιότητες (φάσεις · τάση · συχνότητα), με τη σειρά και τα σύμβολα
 * που **δηλώνει** η οικογένεια (IEC 61293 §4.2.5: πρώτα το σύστημα παροχής, μετά οι τιμές· §4.3.1: αριθμός ␣ σύμβολο μονάδας).
 *
 * 🔑 Κάθε μέρος περνά από τον **κωδικοποιητή** της ιδιότητας (`formatAttributeValue`): γλώσσα, υποδιαστολή, ετικέτα επιλογής,
 *    σύμβολο μονάδας — όπως σε κάθε άλλο σημείο. Η μέτρηση πρώτα στη μονάδα προβολής (`measurementInUnit`, ο κανόνας της γραμμής πίνακα).
 * 🔑 **Δεν αποθηκεύεται**: υπολογίζεται σε κάθε προβολή (Revit «Electrical Data»), άρα δεν υπάρχει μπαγιάτικη ένδειξη.
 * 🔑 **Μέρος που λείπει δεν συμπτύσσεται σιωπηλά** — τα εργαλεία που το κάνουν αφήνουν «230 V  Hz» ή «null». Ο καλών αποφασίζει
 *    **τι** δείχνει στη θέση του (`missingText`): ο επεξεργαστής ονομάζει την ιδιότητα (ο άνθρωπος ξέρει τι να συμπληρώσει), ο
 *    πίνακας και η εκτύπωση βάζουν {@link COMPOSITE_MISSING_MARK}. Λείπουν **όλα** ⇒ κενή ένδειξη (`''`), όπως κάθε κενό κελί.
 * @module subapps/catalog/values/composite-display
 */

import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CompositeDisplay, CompositeDisplayPart } from '../types/family';
import type { AttributeValue } from '../types/product';
import { measurementInUnit } from './measurement-in-unit';
import { formatAttributeValue, type ValueTextContext } from './value-text-codec';

/** Η θέση μέρους που λείπει, στον πίνακα και στην εκτύπωση. */
export const COMPOSITE_MISSING_MARK = '—';

export interface ComposedDisplay {
  readonly text: string;
  /** Οι ιδιότητες των μερών που λείπουν, με τη σειρά τους (για ανάδραση: «συμπλήρωσε τη Συχνότητα»). */
  readonly missingAttributeIds: readonly string[];
}

export interface CompositeSource {
  readonly attributeById: ReadonlyMap<string, CatalogAttributeDefinition>;
  /** Η τιμή της ιδιότητας στο πλαίσιο της προβολής (κανάλι · γλώσσα · κληρονομημένη από τον πρόγονο). */
  readonly valueOf: (attributeId: string) => AttributeValue | undefined;
  readonly codec: ValueTextContext;
}

/** Το κείμενο ενός μέρους χωρίς τα σύμβολά του, ή `''` όταν δεν υπάρχει τιμή (ή ιδιότητα). */
function partValueText(part: CompositeDisplayPart, source: CompositeSource): string {
  const attribute = source.attributeById.get(part.attributeId);
  const value = source.valueOf(part.attributeId);
  if (!attribute || !value) return '';
  if (attribute.type === 'measurement' && value.type === 'measurement') {
    return formatAttributeValue(attribute, measurementInUnit(attribute, value, part.displayUnitCode, source.codec.registry), source.codec);
  }
  return formatAttributeValue(attribute, value, source.codec);
}

export function composeDisplay(
  composite: CompositeDisplay,
  source: CompositeSource,
  missingText: (attributeId: string) => string,
): ComposedDisplay {
  const texts = composite.parts.map((part) => partValueText(part, source));
  const missingAttributeIds = composite.parts.filter((_, index) => texts[index] === '').map((part) => part.attributeId);
  if (missingAttributeIds.length === composite.parts.length) return { text: '', missingAttributeIds };
  const pieces = composite.parts.map((part, index) =>
    texts[index] === '' ? missingText(part.attributeId) : `${part.affix.before}${texts[index]}${part.affix.after}`);
  return { text: pieces.join(composite.separator), missingAttributeIds };
}
