/**
 * Next.js instrumentation hook (runs once per runtime at server start).
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 *
 * Guards React 19.2.1 dev-mode `describeNode` bug: indent-- → -1 → repeat(-1)
 * → RangeError. Browser-side patched in public/suppress-console.js; server
 * SSR/RSC renderer hits the same code path and needs the same guard.
 */
export function register(): void {
  const origRepeat = String.prototype.repeat;
  String.prototype.repeat = function (count: number): string {
    if (typeof count === 'number' && count < 0) return '';
    return origRepeat.call(this, count);
  };
}
