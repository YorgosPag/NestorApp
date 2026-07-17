/**
 * ADR-668 — serialisation of a prepared THREE tree to OBJ (+MTL) / GLB.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md
 */

import type * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';

/**
 * Ο `OBJExporter` **δεν γράφει ποτέ** `mtllib` — ούτε καν όταν γράφει `usemtl`. Χωρίς τη γραμμή
 * `mtllib`, το C4D (και κάθε άλλος importer) αγνοεί σιωπηλά το `.mtl` και ανοίγει το μοντέλο
 * γκρι. Άρα την εισάγουμε εμείς, πριν από οτιδήποτε άλλο.
 */
export function injectMtlLib(objText: string, mtlFilename: string): string {
  return `mtllib ${mtlFilename}\n${objText}`;
}

export function serialiseObj(root: THREE.Object3D): string {
  return new OBJExporter().parse(root);
}

/**
 * glTF 2.0 binary. `trs: true` κρατά τα node transforms (και άρα το πραγματικό δέντρο, που το
 * OBJ δεν μπορεί). `onlyVisible: false` — ό,τι έχτισε ο headless build εξάγεται· η ορατότητα
 * είναι θέμα του viewport, όχι του αρχείου.
 */
export async function serialiseGlb(root: THREE.Object3D): Promise<ArrayBuffer> {
  const result = await new GLTFExporter().parseAsync(root, {
    binary: true,
    onlyVisible: false,
    trs: true,
    embedImages: true,
  });
  if (!(result instanceof ArrayBuffer)) {
    throw new Error('MESH3D_GLB_NOT_BINARY');
  }
  return result;
}
