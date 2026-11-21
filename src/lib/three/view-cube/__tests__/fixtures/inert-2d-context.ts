/**
 * Αδρανές 2D context για τα tests του κύβου: κάθε μέθοδος/πεδίο επιστρέφει τον εαυτό του (το jsdom δεν έχει canvas).
 * Χρήση: `jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => inert2dContext())`.
 */
export function inert2dContext(): CanvasRenderingContext2D {
  const handler: ProxyHandler<() => void> = {
    get: (_t, key) => (key === 'width' ? 0 : proxy),
    set: () => true,
    apply: () => proxy,
  };
  const proxy: unknown = new Proxy(() => undefined, handler);
  return proxy as CanvasRenderingContext2D;
}
