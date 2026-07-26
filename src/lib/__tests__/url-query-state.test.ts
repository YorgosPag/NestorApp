/**
 * ============================================================================
 * url-query-state — Unit tests (ADR-332 D21 / ADR-400)
 * ============================================================================
 *
 * Καρφώνει τα τέσσερα πράγματα που ένα χειροποίητο `replaceState` χάνει, και που
 * είναι ακριβώς ο λόγος ύπαρξης του module:
 *
 *   1. τα **άσχετα** query keys επιβιώνουν (`?filter=` δεν πέφτει επειδή γράφτηκε
 *      το `?contactId=`),
 *   2. το `hash` επιβιώνει,
 *   3. το `history.state` περνά αυτούσιο — ο App Router κρατά εκεί τη δική του
 *      κατάσταση δρομολόγησης και ένα `replaceState(null, …)` τη σβήνει σιωπηλά,
 *   4. άδειο query ⇒ καθαρό URL, χωρίς ορφανό `?`.
 *
 * @see src/lib/url-query-state.ts
 */

import {
  currentSearchParams,
  replaceUrlQueryString,
  replaceUrlSearchParams,
} from '../url-query-state';

/** Φέρνει το jsdom σε γνωστή αφετηρία πριν από κάθε test. */
function startAt(url: string, state: unknown = null): void {
  window.history.replaceState(state, '', url);
}

describe('url-query-state', () => {
  beforeEach(() => {
    startAt('/contacts');
  });

  describe('currentSearchParams', () => {
    it('reads the live query string', () => {
      startAt('/contacts?contactId=cont_1&filter=%CE%94%CE%BF%CE%BA');

      const params = currentSearchParams();

      expect(params.get('contactId')).toBe('cont_1');
      expect(params.get('filter')).toBe('Δοκ');
    });

    it('is empty when there is no query string', () => {
      expect(currentSearchParams().toString()).toBe('');
    });
  });

  describe('replaceUrlSearchParams', () => {
    it('adds a key without touching unrelated ones', () => {
      startAt('/contacts?filter=%CE%91&tab=basic');

      replaceUrlSearchParams(params => params.set('contactId', 'cont_1'));

      const params = currentSearchParams();
      expect(params.get('contactId')).toBe('cont_1');
      expect(params.get('filter')).toBe('Α');
      expect(params.get('tab')).toBe('basic');
    });

    it('deletes a key without touching unrelated ones', () => {
      startAt('/contacts?contactId=cont_1&filter=%CE%91');

      replaceUrlSearchParams(params => params.delete('contactId'));

      expect(currentSearchParams().get('contactId')).toBeNull();
      expect(currentSearchParams().get('filter')).toBe('Α');
    });

    it('leaves no orphan "?" when the last key is removed', () => {
      startAt('/contacts?contactId=cont_1');

      replaceUrlSearchParams(params => params.delete('contactId'));

      expect(window.location.search).toBe('');
      expect(window.location.href).toMatch(/\/contacts$/);
    });

    it('preserves the pathname', () => {
      startAt('/deep/nested/page?a=1');

      replaceUrlSearchParams(params => params.set('b', '2'));

      expect(window.location.pathname).toBe('/deep/nested/page');
    });

    it('preserves the hash', () => {
      startAt('/contacts#section-3');

      replaceUrlSearchParams(params => params.set('contactId', 'cont_1'));

      expect(window.location.hash).toBe('#section-3');
      expect(currentSearchParams().get('contactId')).toBe('cont_1');
    });

    it('carries history.state through untouched — the App Router keeps its own routing state there', () => {
      startAt('/contacts', { __NA: 'router-state' });

      replaceUrlSearchParams(params => params.set('contactId', 'cont_1'));

      expect(window.history.state).toEqual({ __NA: 'router-state' });
    });

    it('is idempotent — writing the same value twice yields the same URL', () => {
      replaceUrlSearchParams(params => params.set('contactId', 'cont_1'));
      const first = window.location.href;

      replaceUrlSearchParams(params => params.set('contactId', 'cont_1'));

      expect(window.location.href).toBe(first);
    });
  });

  describe('replaceUrlQueryString', () => {
    it('replaces the WHOLE query string — that is the point of this variant', () => {
      startAt('/reports?domain=old&filter=keep-me');

      replaceUrlQueryString('domain=new');

      expect(currentSearchParams().get('domain')).toBe('new');
      expect(currentSearchParams().get('filter')).toBeNull();
    });

    it('accepts the query with or without a leading "?"', () => {
      replaceUrlQueryString('?a=1');
      expect(currentSearchParams().get('a')).toBe('1');

      replaceUrlQueryString('a=2');
      expect(currentSearchParams().get('a')).toBe('2');
    });

    it('clears the query when given an empty string', () => {
      startAt('/reports?domain=old');

      replaceUrlQueryString('');

      expect(window.location.search).toBe('');
    });

    it('preserves pathname, hash and history.state', () => {
      startAt('/reports#chart', { __NA: 'router-state' });

      replaceUrlQueryString('domain=new');

      expect(window.location.pathname).toBe('/reports');
      expect(window.location.hash).toBe('#chart');
      expect(window.history.state).toEqual({ __NA: 'router-state' });
    });
  });
});
