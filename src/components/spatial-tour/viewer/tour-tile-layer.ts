/**
 * @fileoverview **Η ΣΤΡΩΣΗ ΠΛΑΚΙΔΙΩΝ ΕΝΟΣ ΚΥΒΟΥ** — κάθε πλακίδιο είναι δικό του quad με δική του υφή, πάνω από τη βάση
 * του κύβου· ψηλότερο επίπεδο ζωγραφίζεται πάνω από χαμηλότερο, ό,τι λείπει φαίνεται από κάτω (ADR-884 Φ2ε · §4.11).
 * @related `tour-panorama-engine.ts` (ο μόνος κάτοχος) · `lib/spatial-tour/viewer/tour-tile-visibility.ts` (`tileQuad` — η
 *   γεωμετρία από την ΙΔΙΑ σύμβαση με τον ψήστη) · `tour-panorama-shader.ts` (`TOUR_TILE_*_SHADER`)
 * @module components/spatial-tour/viewer/tour-tile-layer
 *
 * 🏆 **Όπως οι μεγάλοι** (Marzipano · Photo Sphere Viewer CubemapTiles): υφή **ανά πλακίδιο**, όχι καμβάς ανά όψη — η μνήμη
 *   GPU πληρώνει μόνο ό,τι ήρθε, και το ζουμ φτάνει στο ανώτερο επίπεδο χωρίς 6 υφές 2560².
 * 🔑 **Ταυτότητα στάσης** (`stopKey`): πλακίδιο άλλης στάσης **δεν μπαίνει** — κλείνει δομικά την κλάση «εικόνα του Α πάνω
 *   στο Β» (ζωντανή επαλήθευση Φ2δ, M11).
 * 🔑 **Κοινή αδιαφάνεια**: τα πλακίδια μοιράζονται το ΙΔΙΟ αντικείμενο uniform `opacity` με τη βάση του κύβου — το σβήσιμο
 *   της μετάβασης τα παίρνει μαζί του χωρίς να τα αγγίξει κανείς.
 * 🔑 **Όριο** (`TILE_LAYER_MAX`): πάνω από αυτό φεύγει το παλαιότερο — η βάση καλύπτει πάντα ό,τι λείπει.
 */

import {
  BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, Group, LinearFilter, Mesh, SRGBColorSpace, ShaderMaterial,
  Texture,
} from 'three';

import { tileQuad, type TourTileAddress } from '@/lib/spatial-tour/viewer/tour-tile-visibility';

import type { TourFaceImage } from './tour-panorama-source';
import { TOUR_TILE_FRAGMENT_SHADER, TOUR_TILE_VERTEX_SHADER } from './tour-panorama-shader';

/** Μέγιστα πλακίδια ανά κύβο (~1 MiB GPU το καθένα) — ένα κάδρο στο ανώτερο επίπεδο με το περιθώριό του χωρά άνετα. */
export const TILE_LAYER_MAX = 96;

/** Υφή πανοράματος από καμβά/εικόνα — ο ΕΝΑΣ ορισμός για βάση και πλακίδια (χρώμα sRGB, χωρίς mipmaps). */
export function panoramaTexture(image: TourFaceImage): Texture {
  const texture = new CanvasTexture(image);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export interface TileLayer {
  readonly group: Group;
  /** Η στάση που δείχνει ο κύβος· `null` = κενός. Αλλαγή ⇒ τα παλιά πλακίδια φεύγουν. */
  setStop(stopKey: string | null): void;
  readonly stopKey: string | null;
  has(tileKey: string): boolean;
  /** Βάζει πλακίδιο **μόνο** αν ανήκει στη στάση του κύβου· αλλιώς το αγνοεί (και επιστρέφει `false`). */
  put(stopKey: string, tileKey: string, address: TourTileAddress, levelSize: number, image: TourFaceImage): boolean;
  /** Σειρά σχεδίασης της βάσης του κύβου — τα πλακίδια ζωγραφίζονται αμέσως μετά, κατά επίπεδο. */
  setBaseOrder(order: number): void;
  dispose(): void;
}

interface TileEntry {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  readonly texture: Texture;
  readonly level: number;
}

function tileMesh(address: TourTileAddress, levelSize: number, texture: Texture, opacity: { value: number }): Mesh<BufferGeometry, ShaderMaterial> {
  const quad = tileQuad(address, levelSize);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(quad.positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(quad.uvs, 2));
  geometry.setIndex(quad.indices);
  const material = new ShaderMaterial({
    uniforms: { map: { value: texture }, opacity },
    vertexShader: TOUR_TILE_VERTEX_SHADER,
    fragmentShader: TOUR_TILE_FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

function disposeEntry(group: Group, entry: TileEntry): void {
  group.remove(entry.mesh);
  entry.mesh.geometry.dispose();
  entry.mesh.material.dispose();
  entry.texture.dispose();
}

/** Η στρώση πλακιδίων ενός κύβου — `opacity` = το ΙΔΙΟ αντικείμενο uniform με τη βάση του. */
export function createTileLayer(opacity: { value: number }): TileLayer {
  const group = new Group();
  const tiles = new Map<string, TileEntry>();
  let stopKey: string | null = null;
  let baseOrder = 0;

  const clear = () => {
    for (const entry of tiles.values()) disposeEntry(group, entry);
    tiles.clear();
  };

  return {
    group,
    get stopKey() { return stopKey; },
    setStop(next) {
      if (next === stopKey) return;
      clear();
      stopKey = next;
    },
    has: (tileKey) => tiles.has(tileKey),
    put(forStop, tileKey, address, levelSize, image) {
      if (forStop !== stopKey || tiles.has(tileKey)) return false;
      const texture = panoramaTexture(image);
      const mesh = tileMesh(address, levelSize, texture, opacity);
      mesh.renderOrder = baseOrder + 1 + address.level;
      tiles.set(tileKey, { mesh, texture, level: address.level });
      group.add(mesh);
      for (const [key, entry] of tiles) {
        if (tiles.size <= TILE_LAYER_MAX) break;
        disposeEntry(group, entry);
        tiles.delete(key);
      }
      return true;
    },
    setBaseOrder(order) {
      baseOrder = order;
      for (const entry of tiles.values()) entry.mesh.renderOrder = order + 1 + entry.level;
    },
    dispose: clear,
  };
}
