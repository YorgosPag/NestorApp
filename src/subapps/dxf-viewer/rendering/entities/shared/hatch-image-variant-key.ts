/**
 * SSoT — hatch image variant key (ADR-653 Φ8).
 *
 * ΕΝΑ ντετερμινιστικό κλειδί που περιγράφει **ΤΙ ζωγραφίζεται** (υλικό + χρωματισμός +
 * — Φ9 — διαδικαστικές παράμετροι), όχι απλώς **ποιο αρχείο**. Πριν το ADR-653 και τα
 * τρία caches του `HatchRenderer` (decoded image / `CanvasPattern` / μέσο χρώμα) ήταν
 * keyed **μόνο στο `assetId`** — ασυμβίβαστο με «ίδιο υλικό, δύο χρωματικές εκδοχές»
 * (καφέ σκακιέρα σε έναν χώρο, άσπρη/μαύρη στον διπλανό → θα μοιράζονταν cache entry).
 *
 * Κρίσιμο invariant: **χωρίς tint/procedural το κλειδί ΕΙΝΑΙ το `assetId`** → μηδενική
 * παλινδρόμηση, μηδέν cache-busting σε υπάρχοντα σχέδια (ADR-643 συμπεριφορά ακέραιη).
 *
 * @see ./hatch-image-cache.ts — ο consumer (keyed by variant key)
 * @see ../HatchRenderer.ts — imagePattern/averageColor caches (keyed by variant key)
 * @see docs/centralized-systems/reference/adrs/ADR-653-editable-and-procedural-hatch-materials.md §3.3
 */

import type {
  HatchImageFill,
  HatchImageTint,
  HatchProceduralParams,
} from '../../../types/entities';

/** Κανονικό τμήμα κλειδιού για ένα tint (σταθερή σειρά πεδίων → ίδιο tint = ίδιο string). */
function tintKeyPart(tint: HatchImageTint): string {
  return `tint:${tint.colorA},${tint.colorB},${tint.strength}`;
}

/**
 * Κανονικό τμήμα κλειδιού για procedural υλικό (ADR-653 Φ9). Περιλαμβάνει και τις διαστάσεις
 * tile γιατί ο αρμός ζωγραφίζεται ως κλάσμα του πραγματικού tile (jointMm/tileMm) → αλλαγή
 * μεγέθους αλλάζει το παραγόμενο canvas.
 */
function proceduralKeyPart(p: HatchProceduralParams, tileW: number, tileH: number): string {
  return `proc:${p.generator}|${p.colors.join(',')}|${p.jointMm ?? 0}|${p.jointColor ?? ''}|${tileW}x${tileH}`;
}

/**
 * Ντετερμινιστικό variant key για ένα image fill — «τι ζωγραφίζεται», όχι «ποιο αρχείο».
 * Procedural → params+tile dims (τα χρώματα ζουν εδώ, το tint αγνοείται). Αλλιώς: με `tint`
 * → `assetId|tint:…`· χωρίς → ακριβώς το `assetId` (ADR-643-compatible, μηδέν cache-busting).
 */
export function imageFillVariantKey(imageFill: HatchImageFill): string {
  if (imageFill.procedural) {
    return proceduralKeyPart(imageFill.procedural, imageFill.tileWidth, imageFill.tileHeight);
  }
  if (imageFill.tint) return `${imageFill.assetId}|${tintKeyPart(imageFill.tint)}`;
  return imageFill.assetId;
}
