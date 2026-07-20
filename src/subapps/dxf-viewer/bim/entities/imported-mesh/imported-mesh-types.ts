/**
 * BIM Imported Mesh — Type Schema (ADR-683 Φ3, κενό Κ2 / κατάσταση D).
 *
 * **Η γεωμετρία που έφτιαξε ο συνεργάτης.** Ο Giorgio στέλνει `.glb`, ο εξωτερικός μηχανικός βάφει τα
 * υπάρχοντα στοιχεία **και προσθέτει νέα** (κάγκελα, έπιπλα, βλάστηση). Τα υπάρχοντα ταιριάζουν με
 * `bimId` (ADR-678). Τα **νέα** δεν ταιριάζουν με τίποτα — ως τη Φ3 απλώς αναφέρονταν σε ένα toast και
 * **χάνονταν**. Αυτός ο τύπος τους δίνει σπίτι.
 *
 * ## Το όριο — γιατί ΔΕΝ είναι παραμετρικό (ADR-683 §3)
 *
 * Τα mesh formats είναι **μονόδρομος**: ο Νέστωρ κρατά `Wall{h:300,t:25}`, το glTF κρατά ψημένα
 * τρίγωνα. Καμία εφαρμογή στον κόσμο δεν συμπεραίνει «αυτό είναι στηθαίο με παράμετρο ύψους» από
 * τρίγωνα — ούτε το Revit (γι' αυτό υπάρχουν IFC + linked models). Συνέπειες, **μη διαπραγματεύσιμες**:
 *
 *  - ✅ **Μετακινείται / περιστρέφεται** — μετασχηματισμός, δεν αγγίζει τη γεωμετρία (§10.1).
 *  - ❌ **Καμία λαβή σχήματος (reshape)** — θα απαιτούσε παραμετρικότητα που δεν υπάρχει.
 *  - ❌ **Δεν προτείνεται ως native `railing`** παρότι ο τύπος υπάρχει (§10.4) — ο συνεργάτης
 *    σχεδίασε κάτι συγκεκριμένο· η «αναβάθμιση» σε παραμετρικό θα άλλαζε σιωπηλά το σχήμα του.
 *
 * IFC: **`IfcBuildingElementProxy`** — η κλάση που το ίδιο το IFC ορίζει για γεωμετρία χωρίς
 * σημασιολογία δομικού στοιχείου. Ρητά ΟΧΙ `IfcRailing`, όσο κι αν το `Rail_01` το υπαινίσσεται.
 *
 * ## Ταυτότητα: linked-model, όχι αντίγραφο ανά αντικείμενο (απόφαση Giorgio 2026-07-20)
 *
 * Ένα `.glb` με 12 κάγκελα ανεβαίνει **μία** φορά σε project-scoped Storage path. Κάθε οντότητα
 * κρατά δείκτη `uploadId` + `nodeName` — ένα fetch, N templates, και η ταυτότητα «αυτά ήρθαν μαζί»
 * επιβιώνει για τον επόμενο γύρο συνεργασίας. Πρότυπο: Revit linked model.
 *
 * ## Γιατί οι διαστάσεις είναι *measured* και όχι *authored*
 *
 * Το `furniture` παίρνει `widthMm/depthMm/heightMm` από τον **κατάλογο** — υπάρχει authored αλήθεια να
 * ρωτηθεί. Εδώ **δεν υπάρχει κατάλογος**: η μόνη αλήθεια είναι το ίδιο το πλέγμα. Τις μετράμε **μία
 * φορά** κατά την εισαγωγή (bbox του κόμβου) και τις **αποθηκεύουμε**, γιατί το `geometry` πρέπει να
 * επαναϋπολογίζεται στο hydrate **πριν** φορτώσει ασύγχρονα το glTF. Χωρίς αυτό, κάθε reload θα
 * εμφάνιζε μηδενικό footprint μέχρι να κατέβει το αρχείο.
 *
 * @see ./imported-mesh-geometry — computeImportedMeshGeometry (params → geometry cache)
 * @see ../../types/furniture-types — ο αδελφός τύπος (mesh-based, αλλά catalog-driven)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §3, §8, §10.1
 */

import type { BOQMeasurementUnit } from '@/types/boq/units';
import type { BimEntity, BoundingBox3D, Point3D, Polygon3D } from '../../types/bim-base';
import type { SceneUnits } from '../../../utils/scene-units';
import type { IfcEntityMixin } from '../../types/ifc-entity-mixin';

// ─── Sub-type discriminator ───────────────────────────────────────────────────

/**
 * Ο μόνος «kind». Το `BimEntity` απαιτεί discriminator, αλλά εδώ **δεν υπάρχει σημασιολογική
 * υποδιαίρεση να δηλωθεί**: ένα εισαγόμενο πλέγμα είναι γεωμετρία, τελεία. Κάθε προσπάθεια να
 * ταξινομηθεί σε `'railing' | 'furniture' | …` από το όνομα ή το σχήμα του θα ήταν ακριβώς η μαντεψιά
 * που απαγορεύει το §3.
 *
 * Η **ταυτότητα για προμέτρηση** (Φ3.1, §10.2) ανατίθεται χειροκίνητα, μία φορά, και ζει στο
 * `importedMeshIdentity` των params — **ποτέ στο `kind`**. Η διάκριση είναι ουσιώδης: το `kind`
 * περιγράφει *τι είναι* το αντικείμενο (και η απάντηση παραμένει «γεωμετρία»), ενώ η ταυτότητα
 * δηλώνει *πώς κοστολογείται*. Ανάθεση «κάγκελο αλουμινίου» δίνει τιμή ανά μονάδα· **δεν** κάνει
 * το πλέγμα παραμετρικό `railing` (§10.4).
 */
export type ImportedMeshKind = 'imported';

// ─── Ταυτότητα προμέτρησης (Φ3.1, §10.2) ─────────────────────────────────────

/**
 * Οι μονάδες που **μπορεί πράγματι να παραχθούν** για ένα ψημένο πλέγμα. Υποσύνολο του
 * `BOQMeasurementUnit`, γιατί ο SSoT κανόνας μονάδα→ποσότητα (`deriveAtoeQuantity`) καλύπτει
 * ακριβώς αυτές τις πέντε· οι υπόλοιπες (`ton`, `lt`, `hr`, `lump`…) δεν προκύπτουν από γεωμετρία
 * και θα έδιναν σιωπηλά **μηδέν**. Ο περιορισμός στον **τύπο** σημαίνει ότι το λάθος δεν μπορεί
 * καν να γραφτεί — δεν χρειάζεται έλεγχος στο runtime.
 */
export const IMPORTED_MESH_BOQ_UNITS = [
  'pcs',
  'm',
  'm2',
  'm3',
  'kg',
] as const satisfies readonly BOQMeasurementUnit[];

export type ImportedMeshBoqUnit = (typeof IMPORTED_MESH_BOQ_UNITS)[number];

/**
 * Type guard για τιμές που έρχονται από index-typed `params` (bridge) ή από persisted έγγραφα.
 * Ζει δίπλα στη λίστα ώστε να μην μπορεί να ξεχαστεί όταν αυτή αλλάξει.
 */
export function isImportedMeshBoqUnit(value: unknown): value is ImportedMeshBoqUnit {
  return (
    typeof value === 'string' &&
    (IMPORTED_MESH_BOQ_UNITS as readonly string[]).includes(value)
  );
}

/**
 * **Η μία χειροκίνητη πληροφορία ολόκληρης της φάσης** (ADR-683 §10.2).
 *
 * Το ίδιο πλέγμα κοστολογείται 288 € ως αλουμίνιο και 832 € ως inox· και η μονάδα είναι
 * σημασιολογική (κάγκελο σε τρέχοντα μέτρα, τζάμι σε τετραγωνικά, εξάρτημα σε τεμάχια). Καμία από
 * τις δύο πληροφορίες **δεν υπάρχει στη γεωμετρία** — γι' αυτό δηλώνονται, μία φορά, από τον
 * χρήστη. Ό,τι ακολουθεί (ποσότητα, σύνολο) βγαίνει αυτόματα.
 *
 * Απόν → η οντότητα **δεν παράγει γραμμή BOQ** (απόφαση Giorgio): προτιμάται η ορατή απουσία από
 * μια μηδενική γραμμή που μοιάζει με μετρημένο κόστος. Το πλήθος των ανανάθετων εμφανίζεται στο UI
 * των εισαγόμενων.
 */
export interface ImportedMeshBoqIdentity {
  /** Κωδικός ΑΤΟΕ — κατηγορία (`OIK-x`) ή υποκατηγορία (`OIK-x.y`). */
  readonly categoryCode: string;
  /** Η σημασιολογική μονάδα μέτρησης — αυτή κρίνει ποιο μέγεθος γίνεται ποσότητα. */
  readonly unit: ImportedMeshBoqUnit;
  /** Ο τίτλος που θα δει ο εργολάβος στη γραμμή προμέτρησης. */
  readonly titleEL: string;
  /**
   * Προαιρετικός δείκτης σε `BimMaterial` της βιβλιοθήκης. Είναι η **μόνη** διαδρομή με την οποία
   * μπαίνει τιμή αυτόματα (`defaultUnitCost`) — πουθενά αλλού στο repo δεν υπάρχει σύνδεση
   * άρθρου ΑΤΟΕ με τιμή. Απόν → ο χρήστης βάζει τιμή στη γραμμή BOQ όπως σε κάθε άλλη.
   */
  readonly materialId?: string;
}

// ─── Parameters (SSoT) ────────────────────────────────────────────────────────

export interface ImportedMeshParams {
  readonly kind: ImportedMeshKind;
  /**
   * FK → το ανεβασμένο αρχείο (enterprise id, prefix `imesh`). **Κοινό** για όλες τις οντότητες που
   * ήρθαν από την ίδια εισαγωγή — αυτό είναι που κάνει το linked-model μοντέλο να δουλεύει.
   */
  readonly uploadId: string;
  /**
   * Το όνομα του κόμβου μέσα στο `.glb` (π.χ. `Rail_01`). Μαζί με το `uploadId` σχηματίζει το
   * μοναδικό κλειδί mesh: `<uploadId>#<nodeName>` (βλ. `bim-mesh-cache`). Είναι επίσης το όνομα που
   * είδε ο χρήστης στο toast των unmatched — η γέφυρα ανάμεσα στα δύο.
   */
  readonly nodeName: string;
  /**
   * Πλήρες Storage path του `.glb` (project-scoped). Αποθηκεύεται στην οντότητα ώστε το hydrate να
   * μπορεί να καταχωρήσει το path στον resolver χωρίς να ξέρει το project layout.
   */
  readonly storagePath: string;
  /** Το αρχικό όνομα αρχείου που έστειλε ο συνεργάτης — μόνο για εμφάνιση/ιχνηλασιμότητα. */
  readonly sourceFileName: string;
  /**
   * ADR-683 Φ3.1β — το όνομα υλικού του κόμβου στο `.glb` (π.χ. `Inox_304`), όπως το έγραψε ο
   * συνεργάτης. Απόν όταν το mesh δεν είχε ονομασμένο υλικό.
   *
   * ⚠️ **Αποθηκεύεται επειδή αλλιώς χάνεται οριστικά.** Ζει μόνο στο φορτωμένο glTF: μετά την
   * εισαγωγή κανείς δεν ξαναδιαβάζει το αρχείο, και η ανάθεση κοστολόγησης γίνεται **αργότερα**,
   * σε άλλη συνεδρία. Είναι η μοναδική διαδρομή με την οποία μια ανάθεση αποκτά **τιμή** αυτόματα
   * (όνομα → `BimMaterial` → `defaultUnitCost`, §10.2 μέτρο τριβής 2) — χωρίς αυτό το πεδίο, το
   * μέτρο θα ήταν δηλωμένο και ανενεργό.
   */
  readonly sourceMaterialName?: string;
  /** Σημείο εισαγωγής (κάτοψη). Το `z` προκύπτει από το `mountingElevationMm`. */
  readonly position: Point3D;
  /** Μοίρες CCW γύρω από το `position` (κάτοψη, περί τον κατακόρυφο άξονα). */
  readonly rotationDeg: number;
  /**
   * mm. Πλάτος/βάθος/ύψος **μετρημένα από το ίδιο το πλέγμα** κατά την εισαγωγή (bbox του κόμβου).
   * ⚠️ ΔΕΝ είναι authored από τον χρήστη και **δεν επεξεργάζονται** — αλλαγή τους θα σήμαινε
   * παραμόρφωση ψημένης γεωμετρίας. Υπάρχουν ώστε το footprint να υπολογίζεται πριν φορτώσει το glTF.
   */
  readonly measuredWidthMm: number;
  readonly measuredDepthMm: number;
  readonly measuredHeightMm: number;
  /**
   * m². Συνολικό εμβαδόν τριγώνων σε world space — **όχι** επιφάνεια κουτιού. Έρχεται αυτούσιο από
   * το `GeometrySignature.areaM2` της Φ2· δεν ξαναϋπολογίζεται (μία πηγή αλήθειας).
   */
  readonly measuredSurfaceAreaM2: number;
  /**
   * m³, ή **`null`** όταν το πλέγμα δεν είναι κλειστό κέλυφος.
   *
   * ⚠️ Το `null` **είναι απάντηση**, όχι «δεν μετρήθηκε ακόμα»: σημαίνει «αυτή η γεωμετρία δεν
   * στηρίζει την ερώτηση του όγκου» (ανοιχτό/μη πολλαπλό/εκφυλισμένο). Άρα κωδικοποιεί ταυτόχρονα
   * και τη **στεγανότητα** — γι' αυτό δεν αποθηκεύεται δεύτερο `isWatertight` flag που θα μπορούσε
   * να αποκλίνει. Η προμέτρηση προσφέρει m³/kg **μόνο** όταν αυτό δεν είναι `null` (ADR-683 §10.2,
   * πρακτική Revit DirectShape).
   */
  readonly measuredVolumeM3: number | null;
  /** mm. Υψόμετρο τοποθέτησης πάνω από το FFL του ορόφου. `0` → πατά στο δάπεδο. */
  readonly mountingElevationMm: number;
  /**
   * Μονάδα συντεταγμένων του καμβά. Αποθηκεύεται ώστε το `computeImportedMeshGeometry` να μετατρέπει
   * mm → canvas units. Απόν → `'mm'`.
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (αναφορά ορόφου). */
  readonly storeyId?: string;
  /**
   * ADR-683 Φ3.1 (§10.2) — η ανάθεση κοστολόγησης. Απόν → καμία γραμμή προμέτρησης.
   * Ζει εδώ (και όχι στο `kind`) γιατί δηλώνει **πώς κοστολογείται**, όχι **τι είναι**.
   */
  readonly importedMeshIdentity?: ImportedMeshBoqIdentity;
}

// ─── Geometry cache (παράγωγο· SSoT = params) ─────────────────────────────────

/**
 * Υπολογισμένη γεωμετρία. Επιστρέφεται από `computeImportedMeshGeometry(params)` — **ποτέ** δεν
 * μεταλλάσσεται από καταναλωτές.
 *
 * Το `footprint` είναι το **ορθογώνιο του bbox**, όχι το ακριβές περίγραμμα: το πραγματικό περίγραμμα
 * (`computeTopSilhouette`) απαιτεί φορτωμένο πλέγμα και ζει στο `bimMeshCache`, όπου ο 2Δ renderer το
 * βρίσκει όταν είναι έτοιμο. Εδώ κρατάμε το συντηρητικό ορθογώνιο ώστε hit-test και bounds να
 * δουλεύουν **αμέσως**, χωρίς δίκτυο — ίδιο μοτίβο με το `furniture`.
 */
export interface ImportedMeshGeometry {
  /** Polygon3D — οριζόντιο ίχνος στο επίπεδο τοποθέτησης. Κλειστό CCW. */
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Εμβαδόν ίχνους. */
  readonly area: number;
  /** mm. Καθρέφτης του `params.measuredHeightMm` για ευκολία downstream. */
  readonly height: number;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

/**
 * Οντότητα εισαγόμενου πλέγματος. **Πλήρης πολίτης** (§10.1): σχεδιάζεται σε κάτοψη ΚΑΙ 3Δ,
 * επιλέγεται, μετακινείται, περιστρέφεται, εξάγεται — δεν είναι 3Δ-only διακοσμητικό.
 */
export interface ImportedMeshEntity
  extends BimEntity<ImportedMeshKind, ImportedMeshParams, ImportedMeshGeometry>,
    IfcEntityMixin {
  readonly type: 'imported-mesh';
  /** IFC4 — γεωμετρία χωρίς σημασιολογία δομικού στοιχείου (βλ. σχόλιο αρχείου). */
  readonly ifcType: 'IfcBuildingElementProxy';
}

// ─── Σταθερές ─────────────────────────────────────────────────────────────────

/** Διαχωριστικό κλειδιού mesh: `<uploadId>#<nodeName>`. */
export const IMPORTED_MESH_NODE_SEPARATOR = '#';

/**
 * Η κατηγορία mesh για το `bimMeshCache` / `resolveMeshUrl`. Ξεχωριστή από τις κατηγορίες της
 * curated βιβλιοθήκης (`furniture`, `sanitary`, …) γιατί τα εισαγόμενα ζουν σε project-scoped path με
 * **διαφορετικά** storage rules (ο χρήστης γράφει· στη βιβλιοθήκη γράφει μόνο super-admin).
 */
export const IMPORTED_MESH_CATEGORY = 'imported';

/** Ελάχιστη διάσταση (mm) κάτω από την οποία ένας κόμβος θεωρείται εκφυλισμένος και αγνοείται. */
export const MIN_IMPORTED_MESH_DIMENSION_MM = 1;

/** Προεπιλεγμένο υψόμετρο τοποθέτησης — πατά στο δάπεδο του ορόφου. */
export const DEFAULT_IMPORTED_MESH_MOUNTING_ELEVATION_MM = 0;

/** Το κλειδί mesh για cache/resolver. Καθρεφτίζεται από `parseImportedMeshAssetId`. */
export function importedMeshAssetId(uploadId: string, nodeName: string): string {
  return `${uploadId}${IMPORTED_MESH_NODE_SEPARATOR}${nodeName}`;
}

/**
 * Αντίστροφο του {@link importedMeshAssetId}. Τα ονόματα κόμβων glTF **μπορούν** να περιέχουν `#`,
 * οπότε σπάμε στο **πρώτο** διαχωριστικό: το `uploadId` είναι enterprise id (χωρίς `#`), ό,τι
 * ακολουθεί είναι το όνομα ακέραιο.
 */
export function parseImportedMeshAssetId(
  assetId: string,
): { readonly uploadId: string; readonly nodeName: string } | null {
  const at = assetId.indexOf(IMPORTED_MESH_NODE_SEPARATOR);
  if (at <= 0 || at === assetId.length - 1) return null;
  return { uploadId: assetId.slice(0, at), nodeName: assetId.slice(at + 1) };
}
