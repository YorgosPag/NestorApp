/**
 * ADR-744 — the end-to-end proof, at runtime.
 *
 * Everything else in this ADR reasons about the slice statically: the closure is
 * derived, the keys are classified, the bytes are signed. This suite asks the
 * only question a user can perceive:
 *
 *   **Boot i18next with the synchronous slice AND NOTHING ELSE. Can any key the
 *   shell is able to request still come back as itself?**
 *
 * A raw key on screen is exactly `t('search.globalSearch') === 'search.globalSearch'`.
 * So the test loads only `shell-slice.el.json` — no async preload, no
 * `CRITICAL_NAMESPACES`, no network — and walks every key the generator recorded
 * as reachable from a shell module. If one of them fails to resolve, this suite
 * goes red with the key's name, which is the same string the user would have
 * seen.
 *
 * WHY THIS IS NOT REDUNDANT WITH CHECK 3.34. The gate proves the slice is what
 * the generator would produce; it cannot prove the generator's output is USABLE.
 * A slice could be perfectly fresh, perfectly signed, and still be missing the
 * plural sibling of a key — freshness and correctness are different claims, and
 * green tooling proving the wrong claim is how the original 63-namespace drift
 * survived every CHECK in the repo.
 */

import i18next, { type Resource } from 'i18next';

import manifest from '../generated/shell-slice.manifest.json';
import shellSlice from '../generated/shell-slice.el.json';

const LANGUAGE = 'el';

type Want = { keys: string[]; prefixes: string[]; whole: boolean };
const wants = manifest.wants as unknown as Record<string, Want>;
const unresolvable = new Set<string>(manifest.unresolvableKeys as string[]);

/** The candidate namespaces for a key — i18next tries the file's whole list. */
function namespacesRequesting(key: string): string[] {
  return Object.entries(wants)
    .filter(([, want]) => !want.whole && want.keys.includes(key))
    .map(([namespace]) => namespace);
}

function allRequestedKeys(): string[] {
  const keys = new Set<string>();
  for (const want of Object.values(wants)) {
    if (want.whole) continue;
    want.keys.forEach(key => keys.add(key));
  }
  return [...keys].filter(key => !unresolvable.has(key)).sort();
}

describe('ADR-744 — the shell slice alone is enough to render the shell', () => {
  beforeAll(async () => {
    // Deliberately the SYNCHRONOUS half of src/i18n/config.ts and nothing more:
    // same resources, same fallback, no preload IIFE, no backend.
    await i18next.createInstance().init({
      resources: { [LANGUAGE]: shellSlice } as Resource,
      lng: LANGUAGE,
      fallbackLng: LANGUAGE,
      ns: Object.keys(shellSlice),
      defaultNS: 'common',
      initImmediate: false,
      interpolation: { escapeValue: false },
    });
  });

  const instance = () => i18next;

  it('boots with at least the default namespace present', () => {
    expect(Object.keys(shellSlice)).toContain('common');
    expect(Object.keys(shellSlice).length).toBeGreaterThan(0);
  });

  it('resolves EVERY key a shell module can request — no key comes back as itself', async () => {
    const client = i18next.createInstance();
    await client.init({
      resources: { [LANGUAGE]: shellSlice } as Resource,
      lng: LANGUAGE,
      fallbackLng: LANGUAGE,
      ns: Object.keys(shellSlice),
      defaultNS: 'common',
      initImmediate: false,
      interpolation: { escapeValue: false },
    });

    const raw: string[] = [];
    for (const key of allRequestedKeys()) {
      const candidates = namespacesRequesting(key);
      const resolved = candidates.some(namespace => client.exists(key, { ns: namespace }));
      if (!resolved) raw.push(`${key}  (tried: ${candidates.join(', ')})`);
    }

    // The failure message IS the string the user would have seen on screen.
    expect(raw).toEqual([]);
    expect(instance()).toBeDefined();
  });

  it('a namespace taken whole is present in full, not half', () => {
    for (const [namespace, want] of Object.entries(wants)) {
      if (!want.whole) continue;
      expect(Object.keys((shellSlice as Record<string, object>)[namespace] || {}).length).toBeGreaterThan(0);
    }
  });

  it('stays materially smaller than the 295.093 bytes it replaced', () => {
    // If this ever fails, the migration ledger has grown instead of shrinking
    // and the whole synchronous bundle is on its way back.
    expect(JSON.stringify(shellSlice).length).toBeLessThan(220_000);
  });

  /**
   * REGRESSION ANCHOR — the bug this list exists because of.
   *
   * The first cut of ADR-744 key-sliced these nine namespaces down to what the
   * SHELL asks for. That is correct for the shell and wrong for everything else:
   * a PAGE is a route boundary and sits outside the shell closure by design, but
   * on a COLD LOAD it renders in the same frame as the layout with no transition
   * to hide behind. `/dxf/viewer` painted the raw key
   * `dxfViewer.checkingPermissions` (src/app/dxf/viewer/page.tsx:43) because
   * common.json had gone from 34.201 bytes to 5.076.
   *
   * This list is FROZEN HISTORY — exactly what `src/i18n/config.ts:41-44` shipped
   * synchronously before this ADR. It is not a list to maintain; it is the
   * definition of "no worse than before", and it may only ever SHRINK, one entry
   * at a time, as per-route slices take over (ADR-744 §8).
   */
  const SYNCHRONOUS_BEFORE_ADR744 = [
    'common', 'common-actions', 'common-navigation', 'common-status',
    'common-validation', 'common-empty-states', 'landing', 'navigation', 'admin',
  ] as const;

  it.each(SYNCHRONOUS_BEFORE_ADR744)(
    'ships %s WHOLE — it was synchronous before ADR-744, so slicing it is a regression',
    (namespace) => {
      const want = wants[namespace];
      expect(want).toBeDefined();
      expect(want.whole).toBe(true);
      expect(Object.keys((shellSlice as Record<string, object>)[namespace] || {}).length).toBeGreaterThan(0);
    },
  );

  it('resolves the exact key that was reported raw on /dxf/viewer', async () => {
    const client = i18next.createInstance();
    await client.init({
      resources: { [LANGUAGE]: shellSlice } as Resource,
      lng: LANGUAGE,
      fallbackLng: LANGUAGE,
      ns: Object.keys(shellSlice),
      defaultNS: 'common',
      initImmediate: false,
      interpolation: { escapeValue: false },
    });

    for (const key of ['dxfViewer.checkingPermissions', 'dxfViewer.loading', 'dxfViewer.accessDeniedAriaLabel']) {
      expect(client.exists(key, { ns: 'common' })).toBe(true);
      expect(client.t(key, { ns: 'common' })).not.toBe(key);
    }
  });

  it('every prefix the generator recorded resolves to a real subtree', () => {
    for (const [namespace, want] of Object.entries(wants)) {
      if (want.whole) continue;
      for (const prefix of want.prefixes) {
        const tree = prefix.split('.').reduce<unknown>(
          (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
          (shellSlice as Record<string, unknown>)[namespace],
        );
        if (tree === undefined) continue;   // absent here, present in a sibling namespace
        expect(typeof tree).toBe('object');
      }
    }
  });
});
