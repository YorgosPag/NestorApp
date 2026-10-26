'use client';
/**
 * **Ο επεξεργαστής τιμής για κάθε `AttributeType`** — εξαντλητικός dispatcher (ADR-923 §5.10.4 Β3).
 *
 * `{ [K in AttributeType]: … }`: νέος τύπος ιδιότητας **χωρίς** επεξεργαστή σπάει τη μεταγλώττιση — το ίδιο ιδίωμα με
 * το `AttributeConfigByType` / `AttributeValueByType` του πυρήνα.
 *
 * @module components/catalog/values/AttributeValueEditor
 */

import type { ComponentType } from 'react';

import type { AttributeType } from '@/subapps/catalog/vocabulary/attribute-types';

import { AssetValueEditor } from './AssetValueEditor';
import { BooleanValueEditor, MultiSelectValueEditor, SelectValueEditor } from './ChoiceValueEditors';
import { ReferenceValueEditor } from './ReferenceValueEditor';
import { TableValueEditor } from './TableValueEditor';
import { TextValueEditor } from './TextValueEditor';
import type { ValueEditorProps } from './value-editor-types';

export const VALUE_EDITORS: { readonly [K in AttributeType]: ComponentType<ValueEditorProps<K>> } = {
  text: TextValueEditor,
  richText: TextValueEditor,
  number: TextValueEditor,
  measurement: TextValueEditor,
  date: TextValueEditor,
  boolean: BooleanValueEditor,
  select: SelectValueEditor,
  multiSelect: MultiSelectValueEditor,
  asset: AssetValueEditor,
  reference: ReferenceValueEditor,
  table: TableValueEditor,
};

export function AttributeValueEditor(props: ValueEditorProps<AttributeType>) {
  // Ο συσχετισμός «τύπος ιδιότητας ↔ επεξεργαστής» ισχύει από κατασκευής του πίνακα· η TS δεν συσχετίζει ενώσεις.
  const Editor = VALUE_EDITORS[props.attribute.type] as ComponentType<ValueEditorProps<AttributeType>>;
  return <Editor {...props} />;
}
