/**
 * @fileoverview **Το γεωγραφικό πλαίσιο ενός έργου** — η ΜΙΑ ανάγνωση των πεδίων γεωαναφοράς του `Project`
 * (ADR-369 3 βαθμίδες Revit · ADR-650 M10) και η σημασία τους.
 * @module lib/geo/project-geo-frame
 *
 * 🔑 Η σύμβαση (Revit «Angle to True North», ADR-650 M10): το `northRotation` είναι η περιστροφή
 * **τοπικό → κόσμος** (αριστερόστροφα, μοίρες), δηλαδή `κόσμος = R(r)·τοπικό + αρχή`, όπου κόσμος =
 * κάνναβος ΕΓΣΑ'87 με +Y = Βορράς. Από αυτήν προκύπτουν, **χωρίς δεύτερη απόφαση**:
 *   - ο άξονας +X του έργου στον κόσμο: `R(r)·(1,0) = (cos r, sin r)`
 *   - ο αληθινός Βορράς στο έργο:       `R(−r)·(0,1) = (sin r, cos r)`
 *
 * Ζει στο `src/lib` επειδή είναι γεγονός του **έργου**, όχι του σχεδιαστή: το διαβάζουν ο μετασχηματισμός
 * του DXF viewer (`geo-reference-schema.geoReferenceFromProject`) **και** ο εξαγωγέας IFC (`TrueNorth`,
 * `IfcMapConversion`). Η συμφωνία με το `geo-transform.forwardRigidMap` κλειδώνεται με άγκυρα μέσα στο subapp
 * (`geo-referencing/__tests__/project-geo-frame-agreement.test.ts`). ADR-937 §3.1 — πριν από αυτό το φύλλο, το
 * IFC είχε δική του, **αντίθετη** ερμηνεία του ίδιου πεδίου.
 *
 * ⚠️ Φύλλο χωρίς runtime εισαγωγές.
 */

/** Τα ελάχιστα πεδία του `Project` που ορίζουν τη γεωαναφορά (μέτρα / μοίρες, όπως αποθηκεύονται). */
export interface ProjectGeoFrameFields {
  readonly basePoint?: { readonly x?: number; readonly y?: number; readonly z: number };
  readonly surveyPoint?: { readonly z: number };
  readonly northRotation?: number;
}

/** Το επίπεδο πλαίσιο ενός **γεωαναφερμένου** έργου: πού πέφτει η τοπική αρχή (0,0) στον κάνναβο, και η στροφή. */
export interface ProjectGeoFrame {
  /** Ανατολική συντεταγμένη ΕΓΣΑ'87 της τοπικής αρχής, σε μέτρα. */
  readonly eastingM: number;
  /** Βόρεια συντεταγμένη ΕΓΣΑ'87 της τοπικής αρχής, σε μέτρα. */
  readonly northingM: number;
  /** Περιστροφή τοπικό → κόσμος, μοίρες (αριστερόστροφα). */
  readonly northRotationDeg: number;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Το πλαίσιο του έργου, ή `null` όταν το έργο **δεν** είναι γεωαναφερμένο (λείπει το επίπεδο ζεύγος
 * `basePoint.x/y`). Το `null` δεν είναι σφάλμα: σημαίνει «ταυτοτικό», και ο καταναλωτής δεν ισχυρίζεται θέση.
 */
export function projectGeoFrame(fields: ProjectGeoFrameFields | null | undefined): ProjectGeoFrame | null {
  const bp = fields?.basePoint;
  if (!bp || typeof bp.x !== 'number' || typeof bp.y !== 'number') return null;
  return { eastingM: bp.x, northingM: bp.y, northRotationDeg: fields?.northRotation ?? 0 };
}

/** Ο άξονας +X του έργου, εκφρασμένος στον κόσμο (μοναδιαίο διάνυσμα `(cos r, sin r)`). */
export function projectXAxisInWorld(northRotationDeg: number): readonly [number, number] {
  const rad = northRotationDeg * DEG_TO_RAD;
  return [Math.cos(rad), Math.sin(rad)];
}

/** Ο αληθινός Βορράς, εκφρασμένος στο σύστημα του έργου (μοναδιαίο διάνυσμα `(sin r, cos r)`). */
export function trueNorthInProject(northRotationDeg: number): readonly [number, number] {
  const rad = northRotationDeg * DEG_TO_RAD;
  return [Math.sin(rad), Math.cos(rad)];
}

/**
 * Το υψόμετρο της τοπικής αρχής (z = 0 του έργου) στο κατακόρυφο σύστημα του σημείου αποτύπωσης, σε μέτρα.
 * ADR-369: `γεωδαιτικό z = survey.z + basePoint.z + …` — εδώ οι δύο πρώτοι όροι, που ορίζουν την αρχή.
 */
export function projectOriginHeightM(fields: ProjectGeoFrameFields | null | undefined): number {
  return (fields?.surveyPoint?.z ?? 0) + (fields?.basePoint?.z ?? 0);
}
