/**
 * ADR-860 §Ε3γ — ο ΕΝΑΣ `beforeunload`, οδηγούμενος από το μητρώο.
 *
 * Καρφώνει: (α) προειδοποίηση όσο υπάρχει δουλειά, (β) **κανένας** listener όσο δεν υπάρχει
 * (bfcache στο Firefox), (γ) ιδιοκτήτες, όχι μετρητής — καθαρό μόνο όταν καθαρίσουν ΟΛΟΙ.
 */

type Registry = typeof import('../unsaved-work-registry');
type Guard = typeof import('../unsaved-work-guard');

function load(): { registry: Registry; guard: Guard } {
  let registry!: Registry;
  let guard!: Guard;
  jest.isolateModules(() => {
    registry = require('../unsaved-work-registry') as Registry;
    guard = require('../unsaved-work-guard') as Guard;
  });
  return { registry, guard };
}

function fireBeforeUnload(): Event {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('installUnsavedWorkGuard', () => {
  let addSpy: jest.SpyInstance;
  let removeSpy: jest.SpyInstance;

  beforeEach(() => {
    addSpy = jest.spyOn(window, 'addEventListener');
    removeSpy = jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  const beforeUnloadAdds = () => addSpy.mock.calls.filter(([type]) => type === 'beforeunload');

  it('χωρίς δουλειά → ΚΑΝΕΝΑΣ listener (bfcache)', () => {
    const { guard } = load();
    guard.installUnsavedWorkGuard();
    expect(beforeUnloadAdds()).toHaveLength(0);
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('με δουλειά → προειδοποιεί· μόλις καθαρίσει → αφαιρείται', () => {
    const { registry, guard } = load();
    guard.installUnsavedWorkGuard();

    registry.markUnsavedWork('firestore:pending-writes');
    expect(fireBeforeUnload().defaultPrevented).toBe(true);

    registry.clearUnsavedWork('firestore:pending-writes');
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('δύο ιδιοκτήτες → προειδοποιεί μέχρι να καθαρίσουν ΚΑΙ οι δύο', () => {
    const { registry, guard } = load();
    guard.installUnsavedWorkGuard();

    registry.markUnsavedWork('a');
    registry.markUnsavedWork('b');
    registry.clearUnsavedWork('a');
    expect(fireBeforeUnload().defaultPrevented).toBe(true);

    registry.clearUnsavedWork('b');
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('idempotent: διπλή εγκατάσταση = ένας listener', () => {
    const { registry, guard } = load();
    guard.installUnsavedWorkGuard();
    guard.installUnsavedWorkGuard();
    registry.markUnsavedWork('a');
    expect(beforeUnloadAdds()).toHaveLength(1);
    registry.clearUnsavedWork('a');
    expect(removeSpy.mock.calls.filter(([type]) => type === 'beforeunload')).toHaveLength(1);
  });
});
