/**
 * @fileoverview **ΤΑ ΧΡΩΜΑΤΑ ΤΟΥ ΕΔΑΦΟΥΣ ΣΕ 3Δ** — χώμα, ισοϋψείς, φως (ADR-920 §14.5).
 * @related `terrain-map-palette.ts` (η κάτοψη) · `@/lib/terrain/elevation-ramp` (το χρώμα της επιφάνειας)
 * @module components/listing-detail/terrain/3d/terrain-3d-palette
 *
 * 🎨 **Τιμές, όχι tokens CSS**: το three δεν διαβάζει CSS. Οι ισοϋψείς παίρνουν **το ίδιο μελάνι** με την κάτοψη
 *   (`--plan-ink` #171717 · `--plan-ink-muted` #525252 στο `globals.css`, ίδιο στα δύο θέματα): κάθονται πάνω στην
 *   επιφάνεια, ποτέ πάνω στο φόντο, άρα το θέμα δεν τις αφορά. Το φόντο είναι **διαφανές** ⇒ φαίνεται το `Card`.
 * 🟤 **Χώμα σκουρότερο από την κλίμακα**: τα τοιχώματα είναι **τομή**, όχι επιφάνεια. Αν είχαν το καφέ της κλίμακας
 *   (#a8744d, «ανώτερες κλίσεις») θα διαβάζονταν ως πλαγιά.
 * ☀️ **Φως όπως στη χαρτογραφία (hillshade)**: από ΒΔ, αζιμούθιο 315°, ύψος 45° — η σύμβαση κάθε τοπογραφικού χάρτη.
 *   Με τα φυσικά φώτα του three (r155+) μια οριζόντια επιφάνεια δέχεται `(ημισφαιρικό + κατευθυντικό·sin45°) / π` ⇒ με
 *   άθροισμα ≈ π δείχνει **ακριβώς** το χρώμα της κλίμακας, όπως η κάτοψη.
 */

/** Τοιχώματα και πάτος του όγκου εδάφους (sRGB). */
export const TERRAIN_3D_SOIL_COLOR = 0x6b5440;

/** Κύριες ισοϋψείς = `--plan-ink`. */
export const TERRAIN_3D_CONTOUR_MAJOR_COLOR = 0x171717;
/** Δευτερεύουσες ισοϋψείς = `--plan-ink-muted`. */
export const TERRAIN_3D_CONTOUR_MINOR_COLOR = 0x525252;

/** Πάχος γραμμών σε CSS px (το `LineMaterial` μετρά πάνω στο `resolution` που του δίνουμε). */
export const TERRAIN_3D_CONTOUR_MAJOR_WIDTH_PX = 1.6;
export const TERRAIN_3D_CONTOUR_MINOR_WIDTH_PX = 0.8;

/**
 * ADR-920 §14.10 — **η επιθεώρηση σε 3Δ**, οι ΙΔΙΕΣ τιμές με την κάτοψη (`globals.css`): φωτισμένη ισοϋψής =
 * `--terrain-inspect-contour`, νερό = `--terrain-water`, δείκτης / προφίλ = `--plan-ink`. Πάχη σε CSS px, πάνω από την
 * κύρια ισοϋψή (1,6 px) ώστε η φωτισμένη να ξεχωρίζει και από σχήμα, όχι μόνο από χρώμα.
 */
export const TERRAIN_3D_INSPECT_CONTOUR_COLOR = 0xa21caf;
export const TERRAIN_3D_WATER_COLOR = 0x0369a1;
export const TERRAIN_3D_INK_COLOR = 0x171717;
export const TERRAIN_3D_PIN_HEAD_COLOR = 0xffffff;
export const TERRAIN_3D_INSPECT_CONTOUR_WIDTH_PX = 3.2;
export const TERRAIN_3D_WATER_WIDTH_PX = 3.2;
export const TERRAIN_3D_INK_WIDTH_PX = 2;

/** Ημισφαιρικό: ουρανός / έδαφος. */
export const TERRAIN_3D_SKY_COLOR = 0xffffff;
export const TERRAIN_3D_GROUND_COLOR = 0x8a7f72;
export const TERRAIN_3D_HEMI_INTENSITY = 1.8;

/** Κατευθυντικό: αζιμούθιο 315° (ΒΔ), ύψος 45°. `1.8 + 1.9·sin45° ≈ π`. */
export const TERRAIN_3D_SUN_INTENSITY = 1.9;
export const TERRAIN_3D_SUN_AZIMUTH_DEG = 315;
export const TERRAIN_3D_SUN_ALTITUDE_DEG = 45;
