/**
 * @fileoverview **ΤΟ GLSL ΔΙΔΥΜΟ ΤΗΣ ΣΥΜΒΑΣΗΣ ΟΨΕΩΝ** — ο κύβος ζωγραφίζεται από **μία** ψηφίδα που διαλέγει όψη και
 * `(u, v)` ανά εικονοστοιχείο (ADR-884 Φ1 · §4.8).
 * @related `lib/spatial-tour/viewer/tour-cube-faces.ts` (η αυθεντία — `directionToCubeFace`)· η άγκυρα
 *   `__tests__/tour-panorama-shader.test.ts` ελέγχει ότι οι έξι κλάδοι εδώ είναι **οι ίδιοι** με εκεί.
 * @module components/spatial-tour/viewer/tour-panorama-shader
 *
 * 🔑 **Γιατί όχι `CubeTexture` / `BackSide` με έξι υλικά**: και τα δύο κουβαλούν **δική τους** σύμβαση καθρεφτίσματος
 * (το three αναποδογυρίζει το `x` στα env maps· ένα κουτί από μέσα δείχνει κάθε όψη κατοπτρικά) — δηλαδή μια δεύτερη
 * αλήθεια για το «ποιο εικονοστοιχείο κοιτάζει βόρεια», αόρατη μέχρι να δει κάποιος το «Β» στη λάθος πλευρά. Εδώ η
 * σύμβαση είναι **γραμμένη**, και ο ψήστης της Φ2 κόβει με την ίδια.
 * 🔑 **Αδιαφάνεια ως uniform**: δύο κύβοι (τρέχων + επόμενος) για το διασταυρούμενο σβήσιμο, χωρίς δεύτερο πέρασμα.
 */

export const TOUR_PANORAMA_VERTEX_SHADER = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = position;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww;
}
`;

/** Οι κλάδοι ακολουθούν ΛΕΞΗ ΠΡΟΣ ΛΕΞΗ το `directionToCubeFace` — άλλαξε και τα δύο ή κανένα. */
export const TOUR_PANORAMA_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D faceFront;
uniform sampler2D faceRight;
uniform sampler2D faceBack;
uniform sampler2D faceLeft;
uniform sampler2D faceUp;
uniform sampler2D faceDown;
uniform float opacity;
varying vec3 vDirection;

vec2 toUv(float a, float b, float m) { return vec2(a / m, b / m) * 0.5 + 0.5; }

void main() {
  vec3 d = vDirection;
  vec3 m = abs(d);
  vec4 color;
  if (m.x >= m.y && m.x >= m.z) {
    color = d.x > 0.0 ? texture2D(faceRight, toUv(d.z, d.y, m.x)) : texture2D(faceLeft, toUv(-d.z, d.y, m.x));
  } else if (m.y >= m.z) {
    color = d.y > 0.0 ? texture2D(faceUp, toUv(d.x, d.z, m.y)) : texture2D(faceDown, toUv(d.x, -d.z, m.y));
  } else {
    color = d.z < 0.0 ? texture2D(faceFront, toUv(d.x, d.y, m.z)) : texture2D(faceBack, toUv(-d.x, d.y, m.z));
  }
  gl_FragColor = vec4(color.rgb, opacity);
  #include <colorspace_fragment>
}
`;

/** Όψη → όνομα uniform (μία αντιστοίχιση, τη διαβάζει και ο μηχανισμός και η άγκυρα). */
export const TOUR_FACE_UNIFORM = {
  front: 'faceFront',
  right: 'faceRight',
  back: 'faceBack',
  left: 'faceLeft',
  up: 'faceUp',
  down: 'faceDown',
} as const;
