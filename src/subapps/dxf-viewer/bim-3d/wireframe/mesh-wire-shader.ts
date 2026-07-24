/**
 * mesh-wire-shader — τα GLSL κομμάτια του barycentric wireframe (ADR-689 Φ3).
 *
 * Εγχέονται σε ένα stock `MeshBasicMaterial` μέσω `onBeforeCompile` — **ΟΧΙ** `ShaderMaterial`.
 * Ο λόγος είναι σκληρός περιορισμός του έργου: το `section-clip-applicator` δέχεται clipping planes
 * μόνο σε built-in mesh materials (ADR-452 allowlist)· ένα `ShaderMaterial` δεν κουβαλά τα
 * `<clipping_planes_*>` chunks, άρα το Section Box θα σταματούσε να κόβει τα πλέγματα. Με
 * `onBeforeCompile` τα chunks μένουν ακέραια και κερδίζουμε το clipping δωρεάν. Ίδιο πρότυπο με το
 * `glyph-atlas-text-lod` (ADR-645 Φάση C).
 *
 * ## Πού μπαίνει το κάθε κομμάτι
 *
 *   vertex   : header στο global scope· body στην αρχή του `main` (χρειάζεται μόνο το attribute).
 *   fragment : header στο global scope· ο υπολογισμός κάλυψης στην αρχή του `main` (early discard
 *              στο Συρμάτινο, πριν σπαταληθεί οτιδήποτε άλλο)· η επιβολή χρώματος **αμέσως μετά**
 *              το `<opaque_fragment>` — δηλαδή σε linear working space, ώστε τα επόμενα
 *              `<tonemapping_fragment>` / `<colorspace_fragment>` να κάνουν σωστά τη μετατροπή
 *              εξόδου (αν γράφαμε μετά από αυτά, η απόχρωση θα έβγαινε λάθος).
 *
 * ⚠️ Τα σχόλια ΜΕΣΑ στα template strings είναι σκόπιμα **μόνο ASCII αγγλικά** — non-ASCII ή
 * απόστροφος μέσα σε GLSL template string σπάει το build.
 *
 * @see ./mesh-wire-encoding — ο `wireEdgeAlpha` είναι ο JS καθρέφτης του fragment υπολογισμού εδώ
 */

import {
  WIRE_ANTIALIAS_PX,
  WIRE_CODE_ATTRIBUTE,
  WIRE_CORNER_RADIX,
} from './mesh-wire-encoding';

/** Κάτω από αυτή την κάλυψη το pixel δεν είναι γραμμή (1/255 — κάτω από ένα βήμα 8-bit). */
const DISCARD_EPSILON = '0.0039';

/** Δηλώσεις του vertex stage: το πακεταρισμένο attribute και τα δύο varyings προς το fragment. */
export const WIRE_VERTEX_HEADER = /* glsl */ `
attribute float ${WIRE_CODE_ATTRIBUTE};
varying vec3 vWireBary;
varying vec3 vWireMask;
`;

/**
 * Αποκωδικοποίηση του πακεταρισμένου float σε βαρυκεντρική βάση + μάσκα ορατών ακμών.
 * Χωρίς branching και χωρίς dynamic indexing (απαγορευμένο σε GLSL ES 1.00 σε πολλούς drivers).
 */
export const WIRE_VERTEX_BODY = /* glsl */ `
  // Unpack: low 2 bits = which corner of the triangle this vertex is, rest = the edge mask.
  float wireCorner = mod( ${WIRE_CODE_ATTRIBUTE}, ${WIRE_CORNER_RADIX}.0 );
  float wireMaskBits = floor( ${WIRE_CODE_ATTRIBUTE} / ${WIRE_CORNER_RADIX}.0 );
  // One-hot barycentric basis built with step() - no dynamic indexing, no branches.
  vWireBary = vec3(
    step( wireCorner, 0.5 ),
    step( 0.5, wireCorner ) * step( wireCorner, 1.5 ),
    step( 1.5, wireCorner )
  );
  // The 3 mask bits are identical on all three corners, so they interpolate flat.
  vWireMask = vec3(
    mod( wireMaskBits, 2.0 ),
    mod( floor( wireMaskBits / 2.0 ), 2.0 ),
    mod( floor( wireMaskBits / 4.0 ), 2.0 )
  );
`;

/** Δηλώσεις του fragment stage: τα uniforms εμφάνισης + η κάλυψη που μοιράζονται τα δύο injections. */
export const WIRE_FRAGMENT_HEADER = /* glsl */ `
uniform vec3 uWireColor;
uniform vec3 uWireFillColor;
uniform float uWireWidthPx;
uniform float uWireFillMode;
varying vec3 vWireBary;
varying vec3 vWireMask;
float wireAlpha;
`;

/**
 * Η καρδιά: απόσταση από την πλησιέστερη **ορατή** ακμή, σε pixels, μέσω των παραγώγων οθόνης.
 * Το `fwidth` λέει πόσο αλλάζει η βαρυκεντρική συνιστώσα ανά pixel, άρα `bary / fwidth(bary)` ΕΙΝΑΙ
 * η απόσταση σε pixels — γι' αυτό το πάχος μένει σταθερό σε κάθε εστίαση και προοπτική.
 * Καθρέφτης: `wireEdgeAlpha` στο `mesh-wire-encoding`.
 */
export const WIRE_FRAGMENT_COVERAGE = /* glsl */ `
  // Screen-space distance to each of the three edges, in pixels. The epsilon guards degenerate
  // triangles (zero derivative), whose huge quotient simply never wins the min() below.
  vec3 wireDistPx = vWireBary / max( fwidth( vWireBary ), vec3( 1e-8 ) );
  // Hidden edges are pushed far away instead of branched around.
  wireDistPx += ( vec3( 1.0 ) - vWireMask ) * 1000000.0;
  float wireNearestPx = min( min( wireDistPx.x, wireDistPx.y ), wireDistPx.z );
  wireAlpha = 1.0 - smoothstep( uWireWidthPx - ${WIRE_ANTIALIAS_PX}.0, uWireWidthPx, wireNearestPx );
  // Wireframe mode only: everything that is not a line is not drawn at all.
  if ( uWireFillMode < 0.5 && wireAlpha < ${DISCARD_EPSILON} ) discard;
`;

/**
 * Η επιβολή χρώματος. Ένα material, δύο εμφανίσεις:
 *   - `uWireFillMode = 0` (Συρμάτινο): fill == wire colour, ώστε η ζώνη anti-aliasing να σβήνει σε
 *     διαφάνεια και όχι σε ξένο χρώμα· το κανάλι alpha κάνει την εξομάλυνση.
 *   - `uWireFillMode = 1` (Κρυφή Γραμμή): αδιαφανείς λευκές όψεις-occluder ΜΕ τις ακμές τους, σε
 *     **ένα** pass — εκεί που η κλασική υλοποίηση θα χρειαζόταν δύο περάσματα.
 */
export const WIRE_FRAGMENT_RESOLVE = /* glsl */ `
  gl_FragColor = vec4(
    mix( uWireFillColor, uWireColor, wireAlpha ),
    mix( wireAlpha, 1.0, uWireFillMode )
  );
`;
