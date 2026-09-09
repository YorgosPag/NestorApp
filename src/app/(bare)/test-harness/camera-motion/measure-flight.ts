'use client';

/**
 * @fileoverview **Ο ΔΕΙΓΜΑΤΟΛΗΠΤΗΣ** — βηματίζει μια πτήση με ΠΑΓΩΜΕΝΟ ρολόι.
 * @related lib/geo/camera-trajectory · lib/maps/maplibre (`freezeMapClock`)
 * @module app/(bare)/test-harness/camera-motion/measure-flight
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🏆 ΓΙΑΤΙ ΠΑΓΩΜΕΝΟ ΡΟΛΟΪ ΚΑΙ ΟΧΙ ΧΡΟΝΟΜΕΤΡΟ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Η πρώτη προσπάθεια μέτρησης *(2026-09-09)* χρησιμοποίησε **ρολόι τοίχου** και απέτυχε
 * **τρεις φορές** για λόγους που δεν είχαν καμία σχέση με τον χάρτη: μια δεύτερη ανοιχτή
 * καρτέλα έκανε το `visibilityState` **`hidden`**, ο Chrome σταμάτησε εντελώς το
 * `requestAnimationFrame`, και η μέτρηση έβγαλε **3 καρέ σε 3,3 δευτερόλεπτα**.
 *
 * 🔑 Με παγωμένο ρολόι **τίποτα από αυτά δεν έχει σημασία**: ο χρόνος που «βλέπει» ο
 * χάρτης τον ορίζουμε εμείς. Ένα καρέ που αργεί δεν αλλοιώνει τη μέτρηση — απλώς αργεί.
 * Είναι το ίδιο ιδίωμα με το `mainClock.autoAdvance = false` του **Jetpack Compose**.
 *
 * ⚠️ **Χρειάζεται όμως ΠΡΑΓΜΑΤΙΚΟ καρέ ανά βήμα**: το MapLibre προχωρά την κίνηση μέσα
 * στον βρόχο απόδοσης, όχι στο `setNow`. Γι' αυτό κάθε βήμα περιμένει **ένα** `rAF` — του
 * οποίου ο ρυθμός είναι πλέον **αδιάφορος** για την ορθότητα.
 */

import { freezeMapClock, thawMapClock } from '@/lib/maps/maplibre';
import type { CameraSample } from '@/lib/geo/camera-trajectory';
import { cameraFlight } from '@/lib/geo/camera-motion';

/** Η επιφάνεια του χάρτη που χρειάζεται ο δειγματολήπτης — τίποτε άλλο. */
export interface FlyableMap {
  flyTo: (options: Record<string, unknown>) => void;
  jumpTo: (options: Record<string, unknown>) => void;
  triggerRepaint: () => void;
  getZoom: () => number;
  getCenter: () => { lat: number; lng: number };
}

/** Βήμα δειγματοληψίας: 60 fps ονομαστικά — αρκετά πυκνό ώστε να φανεί η καμπύλη. */
const STEP_MS = 1000 / 60;

/** Πάνω από αυτό σταματάμε: καμία υγιής πτήση δεν πλησιάζει, και δεν κρεμάμε τη σελίδα. */
const CEILING_MS = 12_000;

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** Το καρέ που βλέπει ο άνθρωπος αυτή τη στιγμή. */
function sample(map: FlyableMap, ms: number): CameraSample {
  const center = map.getCenter();
  return { ms, zoom: map.getZoom(), lat: center.lat, lng: center.lng };
}

/**
 * **Πέταξε τον χάρτη και κατάγραψε κάθε καρέ**, με τον χρόνο υπό τον έλεγχό μας.
 *
 * ⚠️ Η δειγματοληψία **δεν σταματά** μόλις το κάδρο φτάσει: συνεχίζει για λίγα ακίνητα
 * καρέ, ώστε το `cameraTrajectory` να μπορεί να αποδείξει ότι η κίνηση **σταμάτησε**.
 * Χωρίς αυτό, ένα πήδημα και μια πτήση θα είχαν την ίδια καταγραφή.
 *
 * ⛔ Το `thawMapClock` είναι σε `finally` **υποχρεωτικά**: ένα σφάλμα στη μέση θα άφηνε
 * τον χάρτη με παγωμένο ρολόι, δηλαδή **μόνιμα ακίνητο**, και το επόμενο άτομο θα
 * κυνηγούσε φάντασμα.
 */
export async function measureFlight(
  map: FlyableMap,
  target: { center: readonly [number, number]; zoom: number },
  home: { center: readonly [number, number]; zoom: number },
): Promise<CameraSample[]> {
  const samples: CameraSample[] = [];
  try {
    freezeMapClock(0);
    map.jumpTo({ center: [...home.center], zoom: home.zoom });
    map.triggerRepaint();
    await nextFrame();

    samples.push(sample(map, 0));
    map.flyTo({ center: [...target.center], zoom: target.zoom, ...cameraFlight('travel') });

    let stillFrames = 0;
    for (let t = STEP_MS; t <= CEILING_MS && stillFrames < 4; t += STEP_MS) {
      freezeMapClock(t);
      map.triggerRepaint();
      await nextFrame();
      const shot = sample(map, t);
      const prev = samples[samples.length - 1];
      stillFrames = shot.zoom === prev.zoom && shot.lat === prev.lat && shot.lng === prev.lng
        ? stillFrames + 1
        : 0;
      samples.push(shot);
    }
    return samples;
  } finally {
    thawMapClock();
  }
}
