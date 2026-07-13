/**
 * Asset source resolver factory — SSoT για «πού ζουν φυσικά τα builtin assets» (ADR-654).
 *
 * Εξήχθη από το `bim-3d/materials/texture-source.ts` (ADR-413) όταν η βιβλιοθήκη
 * επίπλων κάτοψης (ADR-654) χρειάστηκε ΤΟΝ ΙΔΙΟ μηχανισμό: builtin assets που σε dev
 * σερβίρονται από το `public/` και σε production από το Firebase Storage, με τον ίδιο
 * mode switch και το ίδιο in-flight de-dup. Δύο αντίγραφα της ίδιας λογικής θα ήταν
 * ακριβώς το token-based sibling clone που απαγορεύει ο κανόνας N.18 (ADR-584) — άρα
 * ο μηχανισμός ζει ΕΔΩ, μία φορά, και οι δύο βιβλιοθήκες τον κάνουν configure.
 *
 * Δύο modes:
 *   - 'public'  → bundled κάτω από το `publicRoot`, σερβίρεται από το site root.
 *                 Σύγχρονο (καμία δικτύωση).
 *   - 'storage' → Firebase Storage κάτω από το `storageRoot`, μέσω `getDownloadURL`.
 *                 Τα in-flight Promises γίνονται de-dup ανά path.
 *
 * @see ../../bim-3d/materials/texture-source.ts — PBR textures (ADR-413)
 * @see ../../data/furniture-plan-source.ts — entourage sprites (ADR-654)
 */

import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/** Πού σερβίρονται φυσικά τα αρχεία. */
export type AssetSourceMode = 'public' | 'storage';

export interface AssetSourceConfig {
  /** Public-served root (π.χ. `/textures`). Χωρίς trailing slash. */
  readonly publicRoot: string;
  /** Root folder στο Firebase Storage (π.χ. `bim-texture-library`). */
  readonly storageRoot: string;
  /**
   * Το mode εκκίνησης. Οι καλούντες το περνούν από env + NODE_ENV — ο factory ΔΕΝ
   * διαβάζει env μόνος του (κάθε βιβλιοθήκη έχει δικό της env flag).
   */
  readonly initialMode: AssetSourceMode;
}

export interface AssetSourceResolver {
  /**
   * Κατεβατό URL για ένα relative object path (π.χ. `wood/albedo.jpg`).
   * `null` όταν το αρχείο δεν βρίσκεται (storage error) ⇒ ο καλών κάνει graceful
   * degrade αντί να σκάσει.
   */
  resolveUrl(relativePath: string): Promise<string | null>;
  /** Αλλάζει το mode για ΟΛΕΣ τις επόμενες αναλύσεις. */
  setMode(mode: AssetSourceMode): void;
  /** Τρέχον mode (read-only accessor). */
  getMode(): AssetSourceMode;
}

/** Φτιάχνει έναν απομονωμένο resolver (δικό του mode + δικό του in-flight cache). */
export function createAssetSourceResolver(config: AssetSourceConfig): AssetSourceResolver {
  let mode: AssetSourceMode = config.initialMode;
  const inFlight = new Map<string, Promise<string | null>>();

  function resolveStorageUrl(relativePath: string): Promise<string | null> {
    const existing = inFlight.get(relativePath);
    if (existing) return existing;

    const promise = getDownloadURL(ref(storage, `${config.storageRoot}/${relativePath}`))
      .then((url): string | null => url)
      .catch((): string | null => {
        inFlight.delete(relativePath);
        return null;
      });
    inFlight.set(relativePath, promise);
    return promise;
  }

  return {
    resolveUrl(relativePath: string): Promise<string | null> {
      if (mode === 'public') {
        return Promise.resolve(`${config.publicRoot}/${relativePath}`);
      }
      return resolveStorageUrl(relativePath);
    },
    setMode(next: AssetSourceMode): void {
      mode = next;
    },
    getMode(): AssetSourceMode {
      return mode;
    },
  };
}
