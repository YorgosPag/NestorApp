/**
 * ADR-909 Β2.6 / ADR-453 — **οι εικόνες ενός σχεδίου, έτοιμες ΠΡΙΝ από τη σύγχρονη απόδοση.**
 *
 * Η λήψη εκτός οθόνης (raster PDF, δημόσια κάτοψη) ζωγραφίζει **μία φορά, σύγχρονα**. Ο αποδότης δεν
 * περιμένει εικόνες: ζητά από την αποθήκη ό,τι είναι έτοιμο, και για ό,τι λείπει ζωγραφίζει εφεδρικό
 * (επίπεδο χρώμα για γέμισμα υλικού, πλαίσιο για «γυμνή» εικόνα). Στην οθόνη αυτό διορθώνεται στο επόμενο
 * frame· στη λήψη **δεν υπάρχει επόμενο frame**.
 *
 * Άρα ο δρόμος έχει δύο μισά, και αυτό το αρχείο είναι και τα δύο:
 *
 * 1. {@link preloadSceneImages} — **ασύγχρονο**, τρέχει **πριν** από την απόδοση και **έξω** από κάθε
 *    όψη/πολιτική (`renderInPublicFloorplanView`, `setPrintColorPolicy`): εκεί μέσα δεν μπαίνει `await`.
 * 2. {@link missingSceneImageWarnings} — **σύγχρονο**, τρέχει πάνω σε **ό,τι πράγματι ζωγραφίστηκε** και
 *    ονομάζει κάθε εικόνα που δεν ήταν έτοιμη. Κανένα σιωπηλό γκρι: ό,τι έχασε η εικόνα, το μαθαίνει ο
 *    άνθρωπος — με τους **ίδιους** κωδικούς που εκπέμπει ήδη το vector PDF (`print-fidelity`, ADR-667).
 *
 * 🔑 Τα δύο μισά ρωτούν την αποθήκη με το **ίδιο** κλειδί που θα ζητήσει ο αποδότης (`shared-image-caches`).
 *
 * @module subapps/dxf-viewer/print/capture/preload-scene-images
 * @see ../../rendering/entities/shared/shared-image-caches.ts — οι αποθήκες + το «ποια εικόνα ζητώ»
 * @see ../print-fidelity.ts — οι κωδικοί απώλειας (SSoT)
 */

import type { HatchImageFill } from '../../types/entities';
import type { PrintPlotStyle } from '../../config/print-color-policy';
import { IMAGE_OP_TIMEOUT_MS, withTimeout } from '../../export/core/image-export-shared';
import type { HatchImageCache, ImageResolveSpec } from '../../rendering/entities/shared/hatch-image-cache';
import {
  hatchFillImageCache,
  imageEntityImageCache,
  imageEntityResolveSpec,
  imageFillResolveSpec,
} from '../../rendering/entities/shared/shared-image-caches';

/** Ό,τι χρειάζεται για να αναγνωριστεί μια οντότητα που φέρει εικόνα — και οι δύο μορφές σκηνής το έχουν. */
interface ImageBearingProbe {
  readonly type: string;
  readonly fillType?: string;
  readonly imageFill?: HatchImageFill;
  readonly url?: string;
}

/** Μια εικόνα που ο αποδότης **θα ζητήσει**, και από ποια αποθήκη. */
interface SceneImageNeed {
  readonly cache: HatchImageCache;
  readonly spec: ImageResolveSpec;
  /** Ο κωδικός απώλειας αν δεν είναι έτοιμη (βλ. `print-fidelity`). */
  readonly missingCode: string;
}

/** Η εικόνα που θα ζητήσει ο αποδότης γι' αυτή την οντότητα — `null` όταν δεν φέρει εικόνα. */
function imageNeedOf(entity: ImageBearingProbe, plotStyle: PrintPlotStyle): SceneImageNeed | null {
  if (entity.type === 'hatch' && entity.fillType === 'image' && entity.imageFill) {
    return {
      cache: hatchFillImageCache,
      spec: imageFillResolveSpec(entity.imageFill, plotStyle),
      missingCode: 'image-fill:decode-failed',
    };
  }
  if (entity.type === 'image' && entity.url) {
    return {
      cache: imageEntityImageCache,
      spec: imageEntityResolveSpec(entity.url, plotStyle),
      missingCode: 'image-entity:decode-failed',
    };
  }
  return null;
}

/**
 * **Φέρε κάθε εικόνα της σκηνής**, υπό το στυλ με το οποίο θα τυπωθεί. Δεν πετά ποτέ, δεν κρεμά ποτέ.
 *
 * Παράλληλα (οι εικόνες είναι ανεξάρτητες) και με **όριο χρόνου** ανά εικόνα: ένα διαγραμμένο αρχείο με
 * `crossOrigin` μπορεί να αφήσει το `decode()` να μη τελειώσει ποτέ (ADR-644) — και μια λήψη που περιμένει
 * για πάντα είναι χειρότερη από μια λήψη που λέει «αυτή η εικόνα δεν φόρτωσε».
 *
 * ⚠️ Δεν επιστρέφει «τι απέτυχε»: η σκηνή που **τελικά** ζωγραφίζεται μπορεί να είναι υποσύνολο αυτής
 * (προφίλ, κρυφά στρώματα). Το ρωτά το {@link missingSceneImageWarnings}, πάνω στη σωστή σκηνή.
 */
export async function preloadSceneImages(
  entities: readonly ImageBearingProbe[],
  plotStyle: PrintPlotStyle,
): Promise<void> {
  const needs = new Map<string, SceneImageNeed>();
  for (const entity of entities) {
    const need = imageNeedOf(entity, plotStyle);
    if (need !== null) needs.set(`${need.missingCode}|${need.spec.key}`, need);
  }
  await Promise.all(
    [...needs.values()].map((need) =>
      withTimeout(need.cache.preload(need.spec), IMAGE_OP_TIMEOUT_MS).catch(() => false),
    ),
  );
}

/**
 * **Ποιες εικόνες ΔΕΝ ήταν έτοιμες** για τις οντότητες που ζωγραφίστηκαν — ένας κωδικός ανά οντότητα.
 *
 * Σύγχρονο και χωρίς παρενέργειες: ρωτά μόνο «είναι έτοιμη;». Κενός πίνακας ⇒ η εικόνα είναι πιστή.
 * Μια «γυμνή» εικόνα **χωρίς** `url` είναι ανεπίλυτη αναφορά (ADR-736), όχι αποτυχία φόρτωσης — άλλος κωδικός.
 */
export function missingSceneImageWarnings(
  entities: readonly ImageBearingProbe[],
  plotStyle: PrintPlotStyle,
): string[] {
  const warnings: string[] = [];
  for (const entity of entities) {
    if (entity.type === 'image' && !entity.url) {
      warnings.push('image-entity:unresolved-reference');
      continue;
    }
    const need = imageNeedOf(entity, plotStyle);
    if (need !== null && !need.cache.isReady(need.spec.key)) warnings.push(need.missingCode);
  }
  return warnings;
}
