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
 * 🏆 **Προεπισκόπηση θολώματος στη GPU** (Φ2ζ ζ3 · §4.15): ό,τι σχεδιάζει ο υπεύθυνος θολώνει **αμέσως**, με την ΙΔΙΑ γεωμετρία
 *   (κύκλος στη σφαίρα), την ΙΔΙΑ άκρη (`TOUR_REDACTION_FEATHER`) και τα ΙΔΙΑ κελιά (`redactionProxyWidth`) με τον ψήστη — η
 *   Matterport δείχνει μόνο «πινελιά» ως την επανεπεξεργασία.
 */

import { TOUR_REDACTION_FEATHER } from '@/lib/spatial-tour/tileset/tour-redaction-mask';
import {
  TOUR_REDACTION_PREVIEW_MAX, TOUR_REDACTION_PREVIEW_STATE, TOUR_REDACTION_PREVIEW_STRIDE, TOUR_REDACTION_RING_PX,
} from '@/lib/spatial-tour/viewer/tour-redaction-preview';

/** Αριθμός JS ⇒ κυριολεκτικό GLSL float (`1` ⇒ `1.0`) — οι σταθερές ζουν ΜΙΑ φορά, στο TypeScript. */
export function glslFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

const STRIDE = glslFloat(TOUR_REDACTION_PREVIEW_STRIDE);
const DRAFT = glslFloat(TOUR_REDACTION_PREVIEW_STATE.draft);
const SELECTED = glslFloat(TOUR_REDACTION_PREVIEW_STATE.selected);

/**
 * **Η κάλυψη μιας κατεύθυνσης** — κοινό απόσπασμα βάσης **και** πλακιδίων. Κάθε περιοχή: `xyz` = μοναδιαία κατεύθυνση του κέντρου
 * (συντεταγμένες **πανοράματος** — ο κύβος στρέφεται κατά το heading, άρα το τοπικό του ΕΙΝΑΙ αυτές), `w` = `κατάσταση × STRIDE +
 * ακτίνα` (`tour-redaction-preview.ts` — ο ΕΝΑΣ συσκευαστής). Επιστρέφει (βάρος θολώματος, πυρήνας περιγράμματος, άλως). Βάρος =
 * `redactionAlpha` του ψήστη· επικάλυψη ⇒ `max` (ο ψήστης αναμειγνύει διαδοχικά ⇒ κάλυψη ≥ — η προεπισκόπηση δεν υπόσχεται
 * ποτέ **περισσότερο** θόλωμα από το ψήσιμο).
 * 🔴 **Η παράγωγος (`fwidth`) ΕΞΩ από τον βρόχο** — `pixelAngle`, η γωνία ενός pixel: παράγωγος μέσα σε βρόχο με `break` είναι
 * ακαθόριστη, και το ANGLE/Direct3D (Chrome στα Windows) τη δίνει 0 ⇒ **ζωντανά 2026-09-29** το περίγραμμα δεν φαινόταν ΠΟΤΕ, ενώ
 * το θόλωμα (χωρίς παράγωγο) δούλευε. Άγκυρα: `tour-redaction-preview.test.ts`.
 * 🔑 **Περίγραμμα σε pixel ΟΘΟΝΗΣ** (`TOUR_REDACTION_RING_PX`): σταθερό πάχος σε κάθε ζουμ — λευκός πυρήνας + σκούρα άλως, ορατό σε
 * ανοιχτό ΚΑΙ σκούρο φόντο.
 * ⚠️ Μέσα στη GLSL **μόνο ASCII** — τα σχόλια ζουν εδώ, όχι στο κείμενο που φτάνει στον οδηγό της κάρτας.
 */
const REDACTION_COVER_GLSL = /* glsl */ `
uniform vec4 redactions[${TOUR_REDACTION_PREVIEW_MAX}];
uniform int redactionCount;
varying vec3 vDirection;

vec3 redactionCover(vec3 dir) {
  vec3 n = normalize(dir);
  float pixelAngle = max(length(fwidth(n)), 1e-6);
  float blur = 0.0;
  float core = 0.0;
  float halo = 0.0;
  for (int i = 0; i < ${TOUR_REDACTION_PREVIEW_MAX}; i++) {
    if (i >= redactionCount) break;
    vec4 r = redactions[i];
    float state = floor(r.w / ${STRIDE});
    float radius = r.w - state * ${STRIDE};
    float d = acos(clamp(dot(n, r.xyz), -1.0, 1.0));
    float weight = 1.0 - clamp((d - radius) / (radius * ${glslFloat(TOUR_REDACTION_FEATHER)}), 0.0, 1.0);
    if (state == ${DRAFT} || state == ${SELECTED}) blur = max(blur, weight);
    float px = abs(d - radius) / pixelAngle;
    float halfWidth = state == ${SELECTED} ? ${glslFloat(TOUR_REDACTION_RING_PX.selected / 2)} : ${glslFloat(TOUR_REDACTION_RING_PX.normal / 2)};
    core = max(core, 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, px));
    halo = max(halo, 1.0 - smoothstep(halfWidth + ${glslFloat(TOUR_REDACTION_RING_PX.halo)} - 0.5, halfWidth + ${glslFloat(TOUR_REDACTION_RING_PX.halo)} + 0.5, px));
  }
  return vec3(blur, core, halo);
}

vec3 withRedactionRing(vec3 rgb, vec3 cover) {
  return mix(mix(rgb, vec3(0.0), cover.z * 0.55), vec3(1.0), cover.y);
}
`;

export const TOUR_PANORAMA_VERTEX_SHADER = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = position;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww;
}
`;

/**
 * Οι κλάδοι ακολουθούν ΛΕΞΗ ΠΡΟΣ ΛΕΞΗ το `directionToCubeFace` — άλλαξε και τα δύο ή κανένα. Το `cellBlur` = το θολωμένο χρώμα
 * **όπως το φτιάχνει ο ψήστης**: equirect σε κελιά (`redactionCellRad`), μεγεθυμένο ξανά — εδώ διγραμμική ανάμειξη των τεσσάρων
 * κέντρων κελιών γύρω από το σημείο.
 */
export const TOUR_PANORAMA_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D faceFront;
uniform sampler2D faceRight;
uniform sampler2D faceBack;
uniform sampler2D faceLeft;
uniform sampler2D faceUp;
uniform sampler2D faceDown;
uniform float opacity;
uniform float redactionCellRad;
${REDACTION_COVER_GLSL}
vec2 toUv(float a, float b, float m) { return vec2(a / m, b / m) * 0.5 + 0.5; }

vec4 sampleCube(vec3 d) {
  vec3 m = abs(d);
  if (m.x >= m.y && m.x >= m.z) {
    return d.x > 0.0 ? texture2D(faceRight, toUv(d.z, d.y, m.x)) : texture2D(faceLeft, toUv(-d.z, d.y, m.x));
  } else if (m.y >= m.z) {
    return d.y > 0.0 ? texture2D(faceUp, toUv(d.x, d.z, m.y)) : texture2D(faceDown, toUv(d.x, -d.z, m.y));
  }
  return d.z < 0.0 ? texture2D(faceFront, toUv(d.x, d.y, m.z)) : texture2D(faceBack, toUv(-d.x, d.y, m.z));
}

vec3 cellDirection(float yaw, float pitch) {
  return vec3(sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch));
}

vec3 cellBlur(vec3 d) {
  vec3 n = normalize(d);
  float c = redactionCellRad;
  vec2 p = vec2(atan(n.x, -n.z), atan(n.y, length(n.xz))) / c - 0.5;
  vec2 cell = floor(p);
  vec2 f = p - cell;
  vec3 a = sampleCube(cellDirection((cell.x + 0.5) * c, (cell.y + 0.5) * c)).rgb;
  vec3 b = sampleCube(cellDirection((cell.x + 1.5) * c, (cell.y + 0.5) * c)).rgb;
  vec3 e = sampleCube(cellDirection((cell.x + 0.5) * c, (cell.y + 1.5) * c)).rgb;
  vec3 g = sampleCube(cellDirection((cell.x + 1.5) * c, (cell.y + 1.5) * c)).rgb;
  return mix(mix(a, b, f.x), mix(e, g, f.x), f.y);
}

void main() {
  vec3 rgb = sampleCube(vDirection).rgb;
  vec3 cover = redactionCount > 0 ? redactionCover(vDirection) : vec3(0.0);
  if (cover.x > 0.0) rgb = mix(rgb, cellBlur(vDirection), cover.x);
  gl_FragColor = vec4(withRedactionRing(rgb, cover), opacity);
  #include <colorspace_fragment>
}
`;

/**
 * **Ένα πλακίδιο** (ADR-884 Φ2ε · §4.11): quad πάνω στην όψη του κύβου, με γωνίες από την ΙΔΙΑ σύμβαση
 * (`cubeFaceUvToDirection`) — εδώ καμία επιλογή όψης, το `uv` είναι ήδη το σωστό. Ίδιο κόλπο βάθους (`xyww`) και ίδια
 * αδιαφάνεια με τη βάση, ώστε το σβήσιμο να παίρνει μαζί του και τα πλακίδια. Η θέση του quad **είναι** κατεύθυνση
 * πανοράματος (`tileQuad`) ⇒ `vDirection` για την προεπισκόπηση θολώματος.
 */
export const TOUR_TILE_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec3 vDirection;
void main() {
  vUv = uv;
  vDirection = position;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww;
}
`;

/**
 * Το πλακίδιο **ανοίγει** μέσα στο πρόχειρο θόλωμα (διαφάνεια = 1 − βάρος): από κάτω φαίνεται η βάση, που έχει ΟΛΗ την όψη και άρα
 * μπορεί να ψηφιδώσει — ένα πλακίδιο δεν βλέπει τα κελιά έξω από το δικό του ορθογώνιο. Το περίγραμμα ζωγραφίζεται και εδώ.
 */
export const TOUR_TILE_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D map;
uniform float opacity;
varying vec2 vUv;
${REDACTION_COVER_GLSL}
void main() {
  vec3 cover = redactionCount > 0 ? redactionCover(vDirection) : vec3(0.0);
  vec3 rgb = withRedactionRing(texture2D(map, vUv).rgb, cover);
  gl_FragColor = vec4(rgb, opacity * max(1.0 - cover.x, max(cover.y, cover.z)));
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
