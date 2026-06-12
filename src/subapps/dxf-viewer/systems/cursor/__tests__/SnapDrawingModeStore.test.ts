/**
 * Tests for SnapDrawingModeStore — the event-time drawing-mode flag read by
 * GuideSnapEngine to switch to intersection-only guide snapping (ADR-189).
 */
import { setSnapDrawingMode, isSnapDrawingMode } from '../SnapDrawingModeStore';

describe('SnapDrawingModeStore', () => {
  afterEach(() => setSnapDrawingMode(false));

  it('defaults to false (not drawing → full guide snapping)', () => {
    expect(isSnapDrawingMode()).toBe(false);
  });

  it('reflects the last published value', () => {
    setSnapDrawingMode(true);
    expect(isSnapDrawingMode()).toBe(true);
    setSnapDrawingMode(false);
    expect(isSnapDrawingMode()).toBe(false);
  });
});
