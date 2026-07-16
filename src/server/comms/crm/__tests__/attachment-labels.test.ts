/**
 * =============================================================================
 * ATTACHMENT LABELS TESTS
 * =============================================================================
 *
 * @enterprise No network required - pure function tests
 */

import { resolveAttachmentLabel } from '../attachment-labels';

describe('resolveAttachmentLabel', () => {
  it.each([
    ['image', '[Image]'],
    ['audio', '[Audio]'],
    ['video', '[Video]'],
    ['file', '[File]'],
  ])('labels the shared %s media type', (type, expected) => {
    expect(resolveAttachmentLabel(type)).toBe(expected);
  });

  it('degrades unknown types to a bracketed type name rather than empty text', () => {
    expect(resolveAttachmentLabel('story_mention')).toBe('[story_mention]');
    expect(resolveAttachmentLabel('carousel')).toBe('[carousel]');
  });

  it('never returns an empty preview', () => {
    for (const type of ['image', 'audio', 'video', 'file', 'anything-new']) {
      expect(resolveAttachmentLabel(type).length).toBeGreaterThan(0);
    }
  });
});
