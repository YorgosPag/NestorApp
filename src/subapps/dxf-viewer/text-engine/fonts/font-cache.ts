/**
 * FontCache — in-memory cache for parsed opentype.Font objects (ADR-344 Phase 2).
 *
 * WeakMap keyed by ArrayBuffer prevents GC retention of font binaries.
 * Name-keyed Map enables fast lookup by DXF STYLE table font name.
 * Singleton export so the cache survives hot-reload across HMR boundaries.
 *
 * @module text-engine/fonts/font-cache
 */

import type { Font } from 'opentype.js';

export class FontCache {
  /** Buffer → Font: avoids re-parsing the same binary twice. */
  private readonly byBuffer = new WeakMap<ArrayBuffer, Font>();
  /** Lowercase name → Font: primary lookup path for DXF style names. */
  private readonly byName = new Map<string, Font>();

  get(name: string): Font | undefined {
    return this.byName.get(name.toLowerCase());
  }

  set(name: string, font: Font, buffer?: ArrayBuffer): void {
    this.byName.set(name.toLowerCase(), font);
    if (buffer) this.byBuffer.set(buffer, font);
  }

  has(name: string): boolean {
    return this.byName.has(name.toLowerCase());
  }

  getByBuffer(buffer: ArrayBuffer): Font | undefined {
    return this.byBuffer.get(buffer);
  }

  /**
   * Τα ονόματα που έχουν φορτωθεί (πεζά, όπως το κλειδί αναζήτησης).
   *
   * Υπάρχει επειδή **δύο** επιφάνειες ρωτούν «ποιες γραμματοσειρές υπάρχουν;» (το πάνελ
   * κειμένου και το mini toolbar του πίνακα). Πριν από αυτό, ο μόνος τρόπος ήταν
   * `fontCache as unknown as { byName?: Map<…> }` — δηλαδή ο καταναλωτής **έσπαγε** την
   * ενθυλάκωση της κλάσης, και ένα δεύτερο αντίγραφο εκείνου του cast θα ήταν δεύτερη
   * γνώση για ένα ιδιωτικό πεδίο.
   */
  names(): readonly string[] {
    return [...this.byName.keys()];
  }

  clear(): void {
    this.byName.clear();
    // WeakMap entries are GC'd automatically — no manual clear needed
  }

  get size(): number {
    return this.byName.size;
  }
}

/** Module-level singleton — survives hot-reload. */
export const fontCache = new FontCache();
