/**
 * arc-listening-dim-config — config SSoT για τις **arc-length listening dimensions** της κολώνας
 * πάνω σε κύκλο/τόξο (ADR-398 §3.12).
 *
 * **Γιατί config (Giorgio 2026-06-22):** «να εξυπηρετεί ΚΑΘΕ λογική χρήστη». Διαφορετικοί χρήστες
 * σκέφτονται σε **μήκος τόξου**, **γωνία**, ή **ακτίνα** — το ίδιο feature τους εξυπηρετεί όλους
 * ταυτόχρονα μέσα από ΕΝΑ μοντέλο: 2 καμπύλα arc gaps (προς γειτονικά τεταρτημόρια/άκρα) + ακτίνα,
 * με ρυθμιζόμενο label format. Default = όλα ON, label = μήκος («πάντα νούμερα» + η αρχική απόφαση).
 *
 * **Zero-import leaf** (cycle-proof, mirror `config/grip-size-default.ts`): καμία εξάρτηση ώστε να
 * το διαβάζει και ο pure resolver (`ghost-face-dim-references`) και ο painter χωρίς κύκλο. Imperative
 * store (zero React) — single-writer (μελλοντικό UI toggle), multi-reader (resolver + painter + tests).
 *
 * @see ./ghost-face-dim-references.ts — ο consumer (ποιες arc dims εκπέμπονται + label)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.12
 */

/** Μορφή ετικέτας arc gap: μήκος τόξου (μέτρα) / γωνία (μοίρες) / και τα δύο. */
export type ArcDimLabelMode = 'length' | 'angle' | 'both';

/** Ρυθμίσεις arc-length listening dimensions (ποιες εκπέμπονται + πώς γράφονται). */
export interface ArcListeningDimConfig {
  /** Εμφάνιση των 2 καμπύλων μηκών τόξου προς τα γειτονικά datums (τεταρτημόρια / άκρα). */
  readonly showArcGaps: boolean;
  /** Εμφάνιση της ευθείας ακτίνας R (κέντρο → κολώνα). */
  readonly showRadius: boolean;
  /** Πώς γράφεται η ετικέτα των arc gaps. */
  readonly labelMode: ArcDimLabelMode;
}

/** Default Revit-grade: όλα ON, ετικέτα = μήκος τόξου (s = r·θ). */
export const ARC_LISTENING_DIM_DEFAULT: ArcListeningDimConfig = Object.freeze({
  showArcGaps: true,
  showRadius: true,
  labelMode: 'length',
});

let current: ArcListeningDimConfig = ARC_LISTENING_DIM_DEFAULT;

export const arcListeningDimConfigStore = {
  /** Reader (non-React) — resolver + painter + tests. */
  get(): ArcListeningDimConfig {
    return current;
  },
  /** Writer (partial patch) — μελλοντικό UI toggle / tests. */
  set(patch: Partial<ArcListeningDimConfig>): void {
    current = { ...current, ...patch };
  },
  /** Reset στο default. */
  reset(): void {
    current = ARC_LISTENING_DIM_DEFAULT;
  },
};
