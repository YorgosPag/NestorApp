/**
 * @/lib/xml/xml-dom — κοινοί XML DOM helpers (ADR-678 Φ4). SSoT για Tekton + COLLADA readers.
 */

import {
  parseXml,
  directChildren,
  firstChild,
  childText,
  childNumber,
  XmlParseError,
} from '../xml-dom';

describe('parseXml', () => {
  it('parses valid XML → root element', () => {
    expect(parseXml('<root><a>1</a></root>').tagName).toBe('root');
  });

  it('throws XmlParseError on malformed XML', () => {
    expect(() => parseXml('<<<not xml')).toThrow(XmlParseError);
  });

  it('expectedRoot match → επιστρέφει root', () => {
    expect(parseXml('<COLLADA/>', 'COLLADA').tagName).toBe('COLLADA');
  });

  it('expectedRoot mismatch → throw', () => {
    expect(() => parseXml('<other/>', 'COLLADA')).toThrow(XmlParseError);
  });
});

describe('traversal helpers', () => {
  const root = parseXml('<r><a>x</a><a>y</a><b> 3.5 </b><c></c></r>');

  it('directChildren επιστρέφει μόνο άμεσα παιδιά με το tag', () => {
    expect(directChildren(root, 'a')).toHaveLength(2);
    expect(directChildren(root, 'z')).toHaveLength(0);
  });

  it('firstChild → πρώτο ή null', () => {
    expect(firstChild(root, 'a')?.textContent).toBe('x');
    expect(firstChild(root, 'z')).toBeNull();
  });

  it('childText trimmed ή null', () => {
    expect(childText(root, 'b')).toBe('3.5');
    expect(childText(root, 'z')).toBeNull();
  });

  it('childNumber parses, fallback σε missing/empty/άκυρο', () => {
    expect(childNumber(root, 'b', 0)).toBe(3.5);
    expect(childNumber(root, 'z', 9)).toBe(9);
    expect(childNumber(root, 'c', 7)).toBe(7);
  });
});
