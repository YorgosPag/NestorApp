/**
 * ADR-376 Phase C.2 — Opening Tag Style service unit tests.
 *
 * Coverage:
 *   - `resolveOpeningTagStyle` defaults + partial merge + clamping + fallback
 *   - `stripUndefined` keeps defined / drops undefined
 *   - Service hydrate / mutateStyle / reset / subscribe / persister DI
 *   - Debounce semantics (single write per burst, cancel-on-project-switch)
 */

import {
  OPENING_TAG_STYLE_DEFAULTS,
  getOpeningTagStyleService,
  resolveOpeningTagStyle,
  stripUndefined,
  type OpeningTagStyle,
  type OpeningTagStylePersister,
} from '../opening-tag-style-service';

describe('opening-tag-style-service — pure resolve', () => {
  test('null → defaults', () => {
    expect(resolveOpeningTagStyle(null)).toEqual(OPENING_TAG_STYLE_DEFAULTS);
    expect(resolveOpeningTagStyle(undefined)).toEqual(OPENING_TAG_STYLE_DEFAULTS);
  });

  test('empty object → defaults', () => {
    expect(resolveOpeningTagStyle({})).toEqual(OPENING_TAG_STYLE_DEFAULTS);
  });

  test('partial override merges over defaults', () => {
    const resolved = resolveOpeningTagStyle({ fontSizePx: 12, leaderStyle: 'dashed' });
    expect(resolved.fontSizePx).toBe(12);
    expect(resolved.leaderStyle).toBe('dashed');
    expect(resolved.borderWidthPx).toBe(OPENING_TAG_STYLE_DEFAULTS.borderWidthPx);
    expect(resolved.pillBgColor).toBe(OPENING_TAG_STYLE_DEFAULTS.pillBgColor);
  });

  test('fontSizePx out of range → clamped', () => {
    expect(resolveOpeningTagStyle({ fontSizePx: 3 }).fontSizePx).toBe(7);
    expect(resolveOpeningTagStyle({ fontSizePx: 99 }).fontSizePx).toBe(16);
  });

  test('borderWidthPx out of range → clamped', () => {
    expect(resolveOpeningTagStyle({ borderWidthPx: -2 }).borderWidthPx).toBe(0);
    expect(resolveOpeningTagStyle({ borderWidthPx: 10 }).borderWidthPx).toBe(3);
  });

  test('invalid leaderStyle → default solid', () => {
    expect(
      resolveOpeningTagStyle({ leaderStyle: 'wavy' as never }).leaderStyle,
    ).toBe('solid');
  });

  test('empty / non-string pillBgColor → default', () => {
    expect(resolveOpeningTagStyle({ pillBgColor: '' }).pillBgColor).toBe(
      OPENING_TAG_STYLE_DEFAULTS.pillBgColor,
    );
    expect(
      resolveOpeningTagStyle({ pillBgColor: 42 as unknown as string }).pillBgColor,
    ).toBe(OPENING_TAG_STYLE_DEFAULTS.pillBgColor);
  });

  test('non-boolean leaderVisible → default true', () => {
    expect(
      resolveOpeningTagStyle({ leaderVisible: 'yes' as unknown as boolean }).leaderVisible,
    ).toBe(true);
  });

  test('NaN fontSizePx → default', () => {
    expect(resolveOpeningTagStyle({ fontSizePx: Number.NaN }).fontSizePx).toBe(
      OPENING_TAG_STYLE_DEFAULTS.fontSizePx,
    );
  });
});

describe('opening-tag-style-service — stripUndefined', () => {
  test('keeps every defined field', () => {
    const input: OpeningTagStyle = {
      fontSizePx: 11,
      borderWidthPx: 2,
      leaderStyle: 'dotted',
      pillBgColor: '#ff0000',
      leaderColor: '#00ff00',
      leaderVisible: false,
    };
    expect(stripUndefined(input)).toEqual(input);
  });

  test('drops undefined fields', () => {
    const result = stripUndefined({
      fontSizePx: 11,
      borderWidthPx: undefined,
      leaderStyle: undefined,
    });
    expect(result).toEqual({ fontSizePx: 11 });
    expect('borderWidthPx' in result).toBe(false);
  });

  test('empty input → empty object', () => {
    expect(stripUndefined({})).toEqual({});
  });
});

describe('opening-tag-style-service — singleton', () => {
  let service: ReturnType<typeof getOpeningTagStyleService>;

  beforeEach(() => {
    jest.useFakeTimers();
    service = getOpeningTagStyleService();
    service.__resetForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initial state is defaults', () => {
    expect(service.getCurrentStyle()).toEqual(OPENING_TAG_STYLE_DEFAULTS);
  });

  test('hydrate populates state + notifies subscribers', () => {
    const listener = jest.fn();
    service.subscribe(listener);
    service.hydrate('proj-1', { openingTagStyle: { fontSizePx: 11 } });
    expect(service.getCurrentStyle().fontSizePx).toBe(11);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('mutateStyle merges patch + notifies immediately', () => {
    const listener = jest.fn();
    service.subscribe(listener);
    service.hydrate('proj-1', { openingTagStyle: {} });
    listener.mockClear();
    service.mutateStyle({ leaderColor: '#abcdef' });
    expect(service.getCurrentStyle().leaderColor).toBe('#abcdef');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('debounced persister fires once per burst', () => {
    const persister: jest.MockedFunction<OpeningTagStylePersister> = jest.fn<Promise<void>, [string, OpeningTagStyle]>(
      async () => undefined,
    );
    service.setPersister(persister);
    service.hydrate('proj-1', { openingTagStyle: {} });

    service.mutateStyle({ fontSizePx: 10 });
    service.mutateStyle({ fontSizePx: 11 });
    service.mutateStyle({ fontSizePx: 12 });

    // No write before debounce window expires.
    jest.advanceTimersByTime(150);
    expect(persister).not.toHaveBeenCalled();

    // After 200 ms total → single write with latest payload.
    jest.advanceTimersByTime(60);
    expect(persister).toHaveBeenCalledTimes(1);
    expect(persister).toHaveBeenCalledWith('proj-1', { fontSizePx: 12 });
  });

  test('subscribe returns unsubscribe', () => {
    const listener = jest.fn();
    const unsub = service.subscribe(listener);
    service.hydrate('proj-1', { openingTagStyle: {} });
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    service.mutateStyle({ fontSizePx: 13 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('reset clears state + flushes empty payload', () => {
    const persister: jest.MockedFunction<OpeningTagStylePersister> = jest.fn<Promise<void>, [string, OpeningTagStyle]>(
      async () => undefined,
    );
    service.setPersister(persister);
    service.hydrate('proj-1', { openingTagStyle: { fontSizePx: 14 } });
    expect(service.getCurrentStyle().fontSizePx).toBe(14);

    service.reset();
    expect(service.getCurrentStyle()).toEqual(OPENING_TAG_STYLE_DEFAULTS);

    jest.advanceTimersByTime(250);
    expect(persister).toHaveBeenCalledTimes(1);
    expect(persister).toHaveBeenCalledWith('proj-1', {});
  });

  test('project switch cancels pending write', () => {
    const persister: jest.MockedFunction<OpeningTagStylePersister> = jest.fn<Promise<void>, [string, OpeningTagStyle]>(
      async () => undefined,
    );
    service.setPersister(persister);
    service.hydrate('proj-1', { openingTagStyle: {} });
    service.mutateStyle({ fontSizePx: 10 });

    // Switch to a new project mid-debounce → previous write is cancelled.
    service.hydrate('proj-2', { openingTagStyle: { fontSizePx: 13 } });
    jest.advanceTimersByTime(250);
    expect(persister).not.toHaveBeenCalled();
    expect(service.getCurrentStyle().fontSizePx).toBe(13);
  });

  test('mutateStyle without persister still updates state', () => {
    service.setPersister(null);
    service.hydrate('proj-1', { openingTagStyle: {} });
    service.mutateStyle({ leaderStyle: 'dashed' });
    expect(service.getCurrentStyle().leaderStyle).toBe('dashed');
    jest.advanceTimersByTime(250);
    // No throw, no persister.
  });

  test('persister rejection does not crash the service', () => {
    const persister: jest.MockedFunction<OpeningTagStylePersister> = jest.fn<Promise<void>, [string, OpeningTagStyle]>(
      async () => {
        throw new Error('firestore down');
      },
    );
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service.setPersister(persister);
    service.hydrate('proj-1', { openingTagStyle: {} });
    service.mutateStyle({ fontSizePx: 9 });
    jest.advanceTimersByTime(250);
    // The promise rejection is logged on the next microtask — let it settle.
    return Promise.resolve().then(() => {
      expect(service.getCurrentStyle().fontSizePx).toBe(9);
      errorSpy.mockRestore();
    });
  });

  test('partial Firestore-loaded data resolves with defaults gaps', () => {
    service.hydrate('proj-1', {
      openingTagStyle: { leaderColor: '#111111', leaderVisible: false },
    });
    const current = service.getCurrentStyle();
    expect(current.leaderColor).toBe('#111111');
    expect(current.leaderVisible).toBe(false);
    expect(current.fontSizePx).toBe(OPENING_TAG_STYLE_DEFAULTS.fontSizePx);
    expect(current.pillBgColor).toBe(OPENING_TAG_STYLE_DEFAULTS.pillBgColor);
  });
});
