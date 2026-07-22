/**
 * imported-material-presets — ADR-683 Φ4 / ADR-679: keyword-based «όνομα υλικού → PBR preset»
 * για ΞΕΝΑ εισαγόμενα πλέγματα (`imported-mesh`).
 *
 * ## Το πρόβλημα που λύνει (μετρημένο, 2026-07-22)
 *
 * Ένα partner `.glb` (C4D → Blender → glTF) φτάνει συχνά με **χαμένα υλικά**: όλα τα materials
 * καταρρέουν στο Blender default (`baseColorFactor = [0.8,0.8,0.8]`, `metallic=0`, `roughness=1`,
 * καμία υφή) — επιβιώνουν ΜΟΝΟ τα **ονόματα** (`HMI-Polished-Aluminum`, `HMI-Aeron-Leather`, …).
 * Ο Νέστωρ αποδίδει πιστά ό,τι υπάρχει → «άσπρο πλαστικό» αντί για γραφίτη+γυαλισμένο μέταλλο.
 *
 * ## Η λύση (πρακτική Revit/ArchiCAD material-mapping)
 *
 * Όπως το Revit αντιστοιχίζει ονόματα υλικών πηγής σε υλικά της βιβλιοθήκης του, εδώ χαρτογραφούμε
 * το **όνομα** (το μόνο που επιβίωσε) σε ένα λογικό PBR preset. Είναι το **auto tier**: δίνει
 * αμέσως πλαυσίμπλη εμφάνιση χωρίς καμία χειροκίνητη ενέργεια. Το manual override (bind σε
 * `BimMaterial` βιβλιοθήκης) είναι μεταγενέστερη φάση, χτισμένη ΠΑΝΩ σε αυτό.
 *
 * ## Γιατί εδώ (SSoT) και pure
 *
 * Το ΙΔΙΟ preset τροφοδοτεί **δύο** καταναλωτές: το 3Δ (`imported-mesh-material-enhance` →
 * `buildMat`) και την 2Δ κάτοψη (`ImportedMeshRenderer` → παλέτα σιλουέτας). Ένα σημείο αλήθειας,
 * μηδέν three-εξάρτηση εδώ (καθαρά δεδομένα) ώστε να είναι testable και να μη σέρνει το 2Δ σε three.
 *
 * ⚠️ **Safety-net, όχι κανόνας:** ο καταναλωτής 3Δ εφαρμόζει preset ΜΟΝΟ όταν το πηγαίο υλικό
 * μοιάζει αδιαμόρφωτο-default (δες `imported-mesh-material-enhance`). Έτσι, αν ο συνεργάτης
 * διορθώσει το export και στείλει σωστά PBR υλικά, αυτά περνούν **ανέγγιχτα** — το preset δεν
 * μάχεται ποτέ ένα καλό αρχείο.
 *
 * @see ../../bim-3d/converters/imported-mesh-material-enhance — ο 3Δ καταναλωτής (gate + buildMat)
 * @see ../renderers/ImportedMeshRenderer — ο 2Δ καταναλωτής (παλέτα σιλουέτας)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.6
 */

/**
 * Ένα PBR preset σε μορφή έτοιμη για `buildMat` (`PbrMaterialDef`): το `color` είναι **αριθμός**
 * (`0xRRGGBB`) όπως απαιτεί ο κατάλογος 3Δ· η 2Δ παίρνει CSS hex μέσω {@link importedPresetHex}.
 */
export interface ImportedMaterialPreset {
  /** Κλειδί κατηγορίας — μόνο για ιχνηλασιμότητα/tests (δεν είναι user-facing). */
  readonly key: string;
  /** Χρώμα βάσης `0xRRGGBB` (sRGB) — τροφοδοτεί απευθείας το `buildMat`. */
  readonly color: number;
  readonly metalness: number;
  readonly roughness: number;
  readonly opacity?: number;
  readonly transparent?: boolean;
}

/**
 * Κανόνας αντιστοίχισης: regex πάνω στο **κανονικοποιημένο** όνομα → preset.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΜΕΤΡΑΕΙ — πρώτο match κερδίζει.** Το `HMI-Aeron-Leather` περιέχει ΚΑΙ «aeron»
 * (ύφασμα) ΚΑΙ «leather» (δέρμα): το `leather` πρέπει να ελεγχθεί **πριν** το ύφασμα, αλλιώς ένα
 * δερμάτινο μαξιλάρι θα βαφόταν σαν πλέγμα. Γενικός κανόνας: πιο ειδικό/σκουρόχρωμο πρώτα.
 */
interface PresetRule {
  readonly test: RegExp;
  readonly preset: ImportedMaterialPreset;
}

/**
 * Ο πίνακας κανόνων. Τα χρώματα/τιμές είναι «λογικές default» ανά οικογένεια υλικού — όχι ακριβής
 * αναπαραγωγή ενός brand. Στόχος: να σταματήσει το «άσπρο πλαστικό» και να δώσει σωστή αίσθηση
 * όγκου/υλικού (μέταλλο γυαλίζει, ύφασμα ματ σκούρο, δέρμα σκούρο).
 */
const PRESET_RULES: readonly PresetRule[] = [
  // Μέταλλο — γυαλισμένο/ματ. Το HDRI `scene.environment` δίνει αυτόματα αντανακλάσεις σε
  // κάθε metallic MeshStandardMaterial, άρα αρκεί σωστό metalness/roughness.
  {
    test: /alumin|aluminium|\bsteel\b|\binox\b|chrome|chrom|metal|\biron\b|brass|bronze|copper|nickel|\bsilver\b|polish/i,
    preset: { key: 'metal', color: 0xb9bdc6, metalness: 0.9, roughness: 0.28 },
  },
  // Γυαλί — διάφανο, χαμηλό roughness.
  {
    test: /glass|crystal|vetro|acryl|plexi|perspex/i,
    preset: { key: 'glass', color: 0xaecad8, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.34 },
  },
  // Δέρμα — ΠΡΙΝ το ύφασμα (βλ. σχόλιο σειράς). `leath` (όχι `leather`) γιατί το C4D κόβει τα
  // ονόματα υλικών στους ~16 χαρακτήρες (μετρημένο: `HMI-Aeron-Leathe`).
  {
    test: /leath|\bpelle\b|cuero|\bhide\b|nappa/i,
    preset: { key: 'leather', color: 0x2b2723, metalness: 0, roughness: 0.5 },
  },
  // Ξύλο.
  {
    test: /\bwood\b|\boak\b|walnut|timber|legno|birch|beech|plywood|\bmdf\b|mahog|teak/i,
    preset: { key: 'wood', color: 0x8a5a2e, metalness: 0, roughness: 0.6 },
  },
  // Ύφασμα / πλέγμα καθίσματος (Aeron «Pellicle» = mesh της Herman Miller) / αφρός. `pellic` για
  // truncated ονόματα (`HMI-3D01__Pellic`).
  {
    test: /fabric|textile|cloth|\bmesh\b|pellic|aeron|weave|upholster|\bfoam\b|cushion|felt|\bseat\b/i,
    preset: { key: 'fabric', color: 0x3a3d42, metalness: 0, roughness: 0.78 },
  },
  // Ελαστικό / πλαστικό / ροδάκια.
  {
    test: /rubber|plastic|\babs\b|nylon|polymer|\bpvc\b|caster|wheel|\btpu\b/i,
    preset: { key: 'plastic', color: 0x2e3033, metalness: 0, roughness: 0.62 },
  },
  // Πέτρα / σκυρόδεμα / μάρμαρο.
  {
    test: /concret|\bstone\b|marble|granite|beton|cement|terrazzo/i,
    preset: { key: 'stone', color: 0x9a9a95, metalness: 0, roughness: 0.82 },
  },
];

/**
 * Κανονικοποίηση για case-insensitive match (mirror Revit material naming). Οι separators `_`/`-`
 * γίνονται κενά ώστε τα word-boundaries (`\b`) να δουλεύουν αξιόπιστα: το `_` είναι word-char, οπότε
 * `\boak\b` ΔΕΝ θα έπιανε το `Oak_Natural` (μετρημένο). Μετά το split, `oak natural` → match.
 */
function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[_-]+/g, ' ');
}

/**
 * Λύνει ένα όνομα υλικού πηγής σε PBR preset, ή `null` όταν κανένα keyword δεν ταιριάζει (τότε ο
 * καταναλωτής αφήνει το υπάρχον/ουδέτερο — ποτέ μαντεψιά).
 *
 * `null`/κενό/whitespace → `null` (δεν υπάρχει τι να αναγνωριστεί).
 */
export function resolveImportedMaterialPreset(
  name: string | null | undefined,
): ImportedMaterialPreset | null {
  if (typeof name !== 'string') return null;
  const normalized = normalize(name);
  if (normalized.length === 0) return null;
  for (const rule of PRESET_RULES) {
    if (rule.test.test(normalized)) return rule.preset;
  }
  return null;
}

/** CSS hex (`#rrggbb`) ενός preset — για την 2Δ παλέτα σιλουέτας (canvas fill/stroke). */
export function importedPresetHex(preset: ImportedMaterialPreset): string {
  return `#${preset.color.toString(16).padStart(6, '0')}`;
}

/**
 * CSS `rgba(r,g,b,a)` ενός preset — για ημιδιάφανο 2Δ fill/edge της σιλουέτας. Το `alpha` clamp-άρεται
 * στο [0,1]. Αποσυνθέτει το `0xRRGGBB` σε κανάλια χωρίς string parsing (μία πηγή του χρώματος).
 */
export function importedPresetRgba(preset: ImportedMaterialPreset, alpha: number): string {
  const r = (preset.color >> 16) & 0xff;
  const g = (preset.color >> 8) & 0xff;
  const b = preset.color & 0xff;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
