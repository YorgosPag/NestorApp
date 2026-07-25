/**
 * ADR-279 §9 / ADR-547 — CRITICAL_NAMESPACES is the single preload list.
 *
 * Two failures this file exists to prevent, both observed live:
 *
 * 1. **Divergence.** `config.ts` (boot) and `preloadCriticalNamespaces()`
 *    (language switch) used to hold separate literal arrays. They drifted by 5
 *    entries — `admin`/`procurement`/`settings` were absent from the
 *    language-switch path, so those surfaces rendered raw keys after a switch.
 *    Nothing detected it for weeks because both arrays independently "looked
 *    right". The guard is textual: config.ts must not restate the list.
 *
 * 2. **Raw keys in already-mounted surfaces.** A namespace consumed by a tab,
 *    card, or dialog reached without a route change has no loading boundary, so
 *    a lazy fetch paints the key itself (`locations.newAddress` on a button,
 *    `types.home` on a card — both seen by a user). Gating the render is not the
 *    alternative: CHECK 3.25 (ADR-267/ADR-300) blocks
 *    `if (!isNamespaceReady) return …` because it trades the key flash for a
 *    blank flash on every remount.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { CRITICAL_NAMESPACES, SUPPORTED_NAMESPACES } from '../lazy-config';

const readSource = (file: string): string =>
  readFileSync(join(__dirname, '..', file), 'utf8');

describe('CRITICAL_NAMESPACES — list integrity', () => {
  it('contains only namespaces declared in SUPPORTED_NAMESPACES', () => {
    const supported = new Set<string>(SUPPORTED_NAMESPACES);
    const unknown = CRITICAL_NAMESPACES.filter((ns) => !supported.has(ns));

    expect(unknown).toEqual([]);
  });

  it('has no duplicate entries', () => {
    const seen = new Set<string>();
    const duplicates = CRITICAL_NAMESPACES.filter((ns) => {
      if (seen.has(ns)) return true;
      seen.add(ns);
      return false;
    });

    expect(duplicates).toEqual([]);
  });

  it('stays a strict subset — preloading everything would defeat code splitting', () => {
    expect(CRITICAL_NAMESPACES.length).toBeLessThan(SUPPORTED_NAMESPACES.length);
  });
});

describe('CRITICAL_NAMESPACES — embedded-surface admission rule', () => {
  /**
   * Each entry renders inside a surface owned by a *different*, already
   * preloaded module, reached without a route change. Dropping any one of them
   * reintroduces the raw-key flash on that surface.
   */
  const EMBEDDED: ReadonlyArray<readonly [string, string]> = [
    ['addresses', 'address cards/editor inside contacts, projects, buildings, purchase orders'],
    ['quotes', 'ContactQuotesSection / ContactRfqInvitesSection — tabs of the contact card'],
    ['showcase', 'BuildingDetailsHeader action + storage/parking detail pages'],
    ['trash', 'soft-delete dialogs on projects, storage, parking'],
    ['toolbars', 'ActionButtons / ToolbarButtons — shared UI primitives'],
    ['banking', 'ContactBankingTab + sales payment dialogs'],
  ];

  it.each(EMBEDDED)('preloads %s (%s)', (namespace) => {
    expect(CRITICAL_NAMESPACES).toContain(namespace);
  });
});

describe('CRITICAL_NAMESPACES — single source of truth', () => {
  it('is the only preload array — config.ts consumes it instead of restating it', () => {
    const config = readSource('config.ts');

    expect(config).toContain('CRITICAL_NAMESPACES.map');
    // The pre-2026-07-25 shape. Its return would mean the copy is back.
    expect(config).not.toMatch(/const\s+criticalNamespaces\s*[:=]/);
  });

  it('drives preloadCriticalNamespaces() so a language switch loads the same set', () => {
    const lazyConfig = readSource('lazy-config.ts');
    const body = lazyConfig.slice(lazyConfig.indexOf('export async function preloadCriticalNamespaces'));

    expect(body).toContain('CRITICAL_NAMESPACES.map');
    expect(body).not.toMatch(/const\s+critical\s*:/);
  });
});
