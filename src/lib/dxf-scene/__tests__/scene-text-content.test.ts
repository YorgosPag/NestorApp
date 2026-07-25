/**
 * Regression anchors for the DXF text-content SSoT.
 *
 * Two entity shapes coexist in a persisted scene — flat `text` (DXF-imported)
 * and the `textNode` AST (T-tool authored). Every text pass must read both.
 */

import { readSceneTextContent } from '../scene-text-content';

describe('readSceneTextContent', () => {
  it('prefers the flat text field', () => {
    expect(readSceneTextContent({ text: 'ΙΣΟΓΕΙΟ' })).toBe('ΙΣΟΓΕΙΟ');
  });

  it('flattens a textNode AST across runs and paragraphs', () => {
    const e = {
      textNode: {
        paragraphs: [
          { runs: [{ text: 'ΥΠΝΟ' }, { text: 'ΔΩΜΑΤΙΟ' }] },
          { runs: [{ text: '3.20 m²' }] },
        ],
      },
    };

    expect(readSceneTextContent(e)).toBe('ΥΠΝΟΔΩΜΑΤΙΟ\n3.20 m²');
  });

  it('tolerates paragraphs with missing runs and runs with missing text', () => {
    const e = { textNode: { paragraphs: [{}, { runs: [{}, { text: 'Α' }] }] } };

    expect(readSceneTextContent(e)).toBe('Α');
  });

  it('returns undefined when there is nothing renderable', () => {
    expect(readSceneTextContent({})).toBeUndefined();
    expect(readSceneTextContent({ text: '' })).toBeUndefined();
    expect(readSceneTextContent({ textNode: { paragraphs: [{ runs: [{ text: '  ' }] }] } }))
      .toBeUndefined();
  });
});
