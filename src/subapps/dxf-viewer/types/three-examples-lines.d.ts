/**
 * Ambient module declarations για την οικογένεια `three/examples/jsm/lines/*`.
 *
 * Το `three` 0.170 διανέμει αυτά τα examples ως **σκέτο `.js` χωρίς `.d.ts`**
 * (επαλήθευση: `node_modules/three/examples/jsm/lines/` — μόνο `.js`), οπότε χωρίς
 * τη δήλωση ο compiler βγάζει TS2307/TS7016 σε κάθε καταναλωτή.
 *
 * ## Πού ζει και γιατί εδώ
 *
 * Οι καταναλωτές είναι **7 αρχεία παραγωγής του subapp**, μοιρασμένα σε δύο
 * υποσυστήματα (`bim-3d/**`, `canvas-v2/webgl-lines/**`) — δηλαδή δεν υπάρχει ένας
 * φάκελος «δίπλα στον καταναλωτή». Άρα η δήλωση ζει στο `types/` του subapp, που
 * είναι ο κοινός τους πρόγονος. Το root TypeScript program τη βλέπει μέσω του
 * `src/types/dxf-viewer-ambient.d.ts` (ADR-719).
 *
 * Οι τύποι είναι **σκόπιμα χαλαροί** (`any` σε `material`/`color`): στόχος είναι να
 * λυθεί η ανάλυση του module, όχι να ξαναγραφτεί η επιφάνεια των examples του three.
 *
 * ⚠️ `LineMaterial.linewidth` και `LineMaterial.resolution` μοιράζονται την **ίδια
 * μονάδα** — αλλαγή στο ένα χωρίς το άλλο δίνει λάθος πάχος γραμμής (ADR-375/650).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-719-ambient-declaration-ssot.md
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'three/examples/jsm/lines/LineSegments2' {
  import { Mesh } from 'three';
  export class LineSegments2 extends Mesh {
    constructor(...args: any[]);
    material: any;
    geometry: any;
  }
}

declare module 'three/examples/jsm/lines/LineMaterial' {
  import { ShaderMaterial, Vector2 } from 'three';
  export class LineMaterial extends ShaderMaterial {
    constructor(parameters?: Record<string, unknown>);
    linewidth: number;
    color: any;
    resolution: Vector2;
    dashed: boolean;
    dashSize: number;
    gapSize: number;
    dashOffset: number;
    dashScale: number;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/lines/LineGeometry' {
  export class LineGeometry {
    constructor();
    setPositions(positions: number[] | Float32Array): this;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/lines/LineSegmentsGeometry' {
  export class LineSegmentsGeometry {
    constructor();
    setPositions(positions: number[] | Float32Array): this;
    dispose(): void;
  }
}
