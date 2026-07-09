/**
 * ADR-608 — tests για τον type-7 `<object>` extractor (native σύμβολα Τέκτονα).
 * Κρίσιμο: ο `type_res` είναι το ΔΕΥΤΕΡΟ `<type>` του record (το 1ο = entity type 7).
 */

import { parseTektonXml } from '../tek-xml-reader';
import { extractObjectRecords } from '../tek-object-extract';

function root(xml: string): Element {
  return parseTektonXml(`<?xml version="1.0" encoding="UTF-8"?><tekton>${xml}</tekton>`);
}

const FLOOR_WITH_OBJECTS = `
<head><numfloors>1</numfloors></head>
<body><building><floor>
<object>
<record><type>7</type><n>1</n><taglist></taglist><type>51</type><color>A8A8A8</color><xmatrix><x00>1</x00><x01>0</x01><x10>0</x10><x11>1</x11><x20>6.19</x20><x21>-8.59</x21></xmatrix></record>
<record><type>7</type><n>2</n><taglist></taglist><type>383</type><color>A8A8A8</color><xmatrix><x00>0</x00><x01>-1</x01><x10>1</x10><x11>0</x11><x20>2</x20><x21>-3</x21></xmatrix></record>
</object>
</floor></building></body>`;

describe('extractObjectRecords', () => {
  it('διαβάζει type_res (2ο <type>) + xmatrix + color', () => {
    const { objects, warnings } = extractObjectRecords(root(FLOOR_WITH_OBJECTS));
    expect(warnings).toHaveLength(0);
    expect(objects).toHaveLength(2);
    expect(objects[0].typeRes).toBe(51); // ΟΧΙ 7 (το 1ο <type>)
    expect(objects[0].color).toBe('A8A8A8');
    expect(objects[0].matrix).toEqual({ x00: 1, x01: 0, x10: 0, x11: 1, x20: 6.19, x21: -8.59 });
    expect(objects[1].typeRes).toBe(383);
    expect(objects[1].matrix.x01).toBe(-1);
  });

  it('record χωρίς 2ο <type> → warning, παραλείπεται', () => {
    const { objects, warnings } = extractObjectRecords(root(
      '<body><building><floor><object>'
      + '<record><type>7</type><n>1</n><color>A8A8A8</color></record>'
      + '</object></floor></building></body>',
    ));
    expect(objects).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('type_res');
  });

  it('record με λάθος entity type (≠7) → warning', () => {
    const { objects, warnings } = extractObjectRecords(root(
      '<body><building><floor><object>'
      + '<record><type>4</type><type>51</type></record>'
      + '</object></floor></building></body>',
    ));
    expect(objects).toHaveLength(0);
    expect(warnings[0]).toContain('type=7');
  });

  it('απών container → κενό, χωρίς warning', () => {
    const { objects, warnings } = extractObjectRecords(root(
      '<body><building><floor></floor></building></body>',
    ));
    expect(objects).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
