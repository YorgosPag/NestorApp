/**
 * mesh3d-collada-writer — ADR-668/678 Φ3.1. **COLLADA 1.4.1 (`.dae`) exporter** (export side).
 *
 * **Γιατί δικός μας, ΟΧΙ η three:** η three 0.170 εξάγει `GLTF/OBJ/STL/PLY/USDZ/…` — **ΟΧΙ**
 * COLLADA. Και ο native OBJ importer του **Cinema 4D R15 (2013)** **ΔΕΝ διαβάζει υλικά** (οι
 * προτιμήσεις έχουν μόνο Scale/Normals/Optimize — αποδεδειγμένο ground-truth). Η **τομή**
 * «format που γράφουμε» × «format που το R15 διαβάζει ΜΕ χρώματα» δίνει πρακτικά **COLLADA**
 * (FBX=κλειστό binary Autodesk, 3DS=8.3 όρια). Άρα το `.dae` είναι ο μόνος δρόμος για χρώματα
 * στον συνεργάτη που είναι κλειδωμένος στο R15.
 *
 * **Per-face:** ένα `<triangles material="sym_i">` ανά `geometry.group` + binding στο instance —
 * βλ. `./mesh3d-collada-geometry`. **Χρώματα σε sRGB** (`getHexString()`, ίδιος χώρος με το
 * manifest baseline) — ΟΧΙ linear (το `.mtl` έγραφε linear· εδώ το διορθώνουμε by construction).
 *
 * **Υλικά = SSoT `assignExportMaterials`:** ο caller έχει ήδη δώσει σε κάθε mesh ονομασμένα
 * per-face clones + μας δίνει τον πίνακα `ExportMaterialEntry[]`. Εδώ απλώς τον απεικονίζουμε σε
 * `<effect>`/`<material>` — μηδέν επανεφεύρεση ονομάτων/χρωμάτων.
 *
 * @see ./mesh3d-collada-geometry — per-mesh `<geometry>` + `<node>`
 * @see ./mesh3d-materials — `assignExportMaterials` (SSoT υλικών)
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md
 */

import type * as THREE from 'three';
import { escapeXml } from '@/lib/xml/escape-xml';
import type { ExportLengthUnit } from '../../types';
import type { ExportMaterialEntry } from './mesh3d-materials';
import { unitScaleFromMeters } from './mesh3d-prepare';
import { buildColladaMeshBlocks } from './mesh3d-collada-geometry';

export interface ColladaExportOptions {
  /** Μονάδα του μοντέλου — ψημένη στις κορυφές ΚΑΙ δηλωμένη στο `<unit>` (διπλή ασφάλεια R15). */
  readonly unit: ExportLengthUnit;
  /** ISO timestamp για `<created>`/`<modified>` (το schema τα απαιτεί)· injected για ντετερμινισμό. */
  readonly createdIso: string;
}

/** COLLADA `<unit name meter>` — το `meter` είναι «πόσα μέτρα = 1 μονάδα εγγράφου». */
const UNIT_NAME: Readonly<Record<ExportLengthUnit, string>> = {
  meters: 'meter',
  centimeters: 'centimeter',
  millimeters: 'millimeter',
};

/** sRGB συνιστώσες 0..1 από το `getHexString()` (sRGB) — αποφεύγει το linear χρώμα του `.mtl`. */
function srgbComponents(color: THREE.Color): { r: number; g: number; b: number } {
  const hex = color.getHexString();
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
  };
}

/**
 * Ένα `<effect>` **blinn** με `sid="COMMON"` — ακριβώς όπως τα colored υλικά του native C4D R15.037
 * .dae (τα δικά του χρωματιστά υλικά = `<blinn><diffuse><color>`, χωρίς specular/shininess).
 *
 * **Αδιαφανή υλικά → ΜΟΝΟ `<diffuse>` (κανένα transparency block).** Ground-truth (C4D R15): ο
 * COLLADA importer έχει επιλογή **«Fix transparency for incompatible files»** ενεργή by default.
 * Αν κάθε υλικό κουβαλά `<transparency>`, ο R15 θεωρεί το αρχείο «ασύμβατο», ενεργοποιεί το fix και
 * «διορθώνει» τη διαφάνεια — τα υλικά φορτώνουν με σωστό χρώμα στο ντουλάπι αλλά βγαίνουν **γκρι/
 * διάφανα** πάνω στη γεωμετρία. Καθαρό opaque υλικό = καμία ασάφεια → ο R15 βάφει το diffuse
 * κατευθείαν (πρακτική Blender/μεγάλων για opaque materials).
 *
 * **Πραγματικά διάφανα** (κρυφά `HIDDEN_` opacity 0, ή γυαλί) → emit `<transparency>` (`A_ONE`:
 * result opacity = transparent.color.a × transparency = 1 × opacity ⇒ float = opacity· 0 = διάφανο).
 */
/** Τα sid/id ενός textured effect: surface→sampler→image αλυσίδα (native C4D δομή). */
interface EffectTextureIds {
  readonly imageId: string;
  readonly surfSid: string;
  readonly sampSid: string;
}

function effectElement(
  effectId: string,
  entry: ExportMaterialEntry,
  tex: EffectTextureIds | null,
): string {
  const transparency = entry.transparent
    ? `<transparent opaque="A_ONE"><color>1 1 1 1</color></transparent>` +
      `<transparency><float>${entry.opacity}</float></transparency>`
    : '';
  // Textured (ADR-679 Φ1): newparams surface→sampler ΜΕΣΑ στο profile_COMMON (πριν το technique) +
  // `<diffuse><texture>` — ακριβώς όπως το native C4D. Αλλιώς flat `<diffuse><color>`.
  const newparams = tex
    ? `<newparam sid="${tex.surfSid}"><surface type="2D"><init_from>${tex.imageId}</init_from></surface></newparam>` +
      `<newparam sid="${tex.sampSid}"><sampler2D><source>${tex.surfSid}</source></sampler2D></newparam>`
    : '';
  const diffuse = tex
    ? `<diffuse><texture texture="${tex.sampSid}" texcoord="UVSET0"/></diffuse>`
    : (() => {
        const { r, g, b } = srgbComponents(entry.color);
        return `<diffuse><color>${r} ${g} ${b} 1</color></diffuse>`;
      })();
  return (
    `<effect id="${effectId}"><profile_COMMON>${newparams}<technique sid="COMMON"><blinn>` +
    diffuse +
    transparency +
    `</blinn></technique></profile_COMMON></effect>`
  );
}

/** `<asset>` με μονάδα, up-axis (Y_UP όπως το OBJ που δουλεύει) και timestamps. */
function assetElement(options: ColladaExportOptions): string {
  const meter = 1 / unitScaleFromMeters(options.unit);
  return (
    `<asset><contributor><authoring_tool>Nestor DXF Viewer (ADR-678)</authoring_tool></contributor>` +
    `<created>${options.createdIso}</created><modified>${options.createdIso}</modified>` +
    `<unit name="${UNIT_NAME[options.unit]}" meter="${meter}"/><up_axis>Y_UP</up_axis></asset>`
  );
}

/** `<library_images>` + `<effect>`/`<material>` + απεικόνιση `όνομα υλικού → material id`. */
function buildMaterialLibraries(materials: readonly ExportMaterialEntry[]): {
  images: string[];
  effects: string[];
  materialDefs: string[];
  materialIdByName: Map<string, string>;
} {
  const images: string[] = [];
  const effects: string[] = [];
  const materialDefs: string[] = [];
  const materialIdByName = new Map<string, string>();
  materials.forEach((entry, i) => {
    const matId = `material_${i}`;
    const effectId = `effect_${i}`;
    materialIdByName.set(entry.name, matId);
    const tex =
      entry.map != null
        ? { imageId: `image_${i}`, surfSid: `surf_${i}`, sampSid: `samp_${i}` }
        : null;
    if (tex !== null && entry.map != null) {
      images.push(`<image id="${tex.imageId}"><init_from>${escapeXml(entry.map.fileName)}</init_from></image>`);
    }
    effects.push(effectElement(effectId, entry, tex));
    materialDefs.push(
      `<material id="${matId}" name="${escapeXml(entry.name)}"><instance_effect url="#${effectId}"/></material>`,
    );
  });
  return { images, effects, materialDefs, materialIdByName };
}

/**
 * Σειριοποιεί ένα προετοιμασμένο THREE δέντρο σε COLLADA 1.4.1 XML. Το δέντρο είναι meshes-only
 * (decorations αφαιρεμένα, instances ψημένα) και έχει ονομασμένα υλικά + world matrices έτοιμα.
 * Pure/testable — καμία I/O, καμία εξάρτηση από `Date`/`Math.random`.
 */
export function serialiseCollada(
  root: THREE.Object3D,
  materials: readonly ExportMaterialEntry[],
  options: ColladaExportOptions,
): string {
  root.updateMatrixWorld(true);
  const { images, effects, materialDefs, materialIdByName } = buildMaterialLibraries(materials);

  const geometries: string[] = [];
  const nodes: string[] = [];
  let index = 0;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    const blocks = buildColladaMeshBlocks(mesh, index, materialIdByName);
    index += 1;
    if (blocks !== null) {
      geometries.push(blocks.geometry);
      nodes.push(blocks.node);
    }
  });

  return (
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">` +
    assetElement(options) +
    (images.length > 0 ? `<library_images>${images.join('')}</library_images>` : '') +
    `<library_effects>${effects.join('')}</library_effects>` +
    `<library_materials>${materialDefs.join('')}</library_materials>` +
    `<library_geometries>${geometries.join('')}</library_geometries>` +
    `<library_visual_scenes><visual_scene id="scene" name="scene">${nodes.join('')}</visual_scene></library_visual_scenes>` +
    `<scene><instance_visual_scene url="#scene"/></scene>` +
    `</COLLADA>\n`
  );
}
