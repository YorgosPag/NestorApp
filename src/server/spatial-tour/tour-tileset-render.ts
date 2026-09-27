import 'server-only';

/**
 * @fileoverview **ΑΠΟ ΕΝΑ EQUIRECT ΣΕ TILESET** — αποκωδικοποίηση μία φορά, έξι όψεις με τη σύμβαση, επίπεδα ανάλυσης,
 * πλακίδια 512 JPEG και μία λωρίδα προεπισκόπησης (ADR-884 Φ2α · §4.9). Μόνο υπολογισμός — καμία εγγραφή.
 * @related `lib/spatial-tour/tileset/tour-tileset-layout.ts` (η διάταξη) · `lib/spatial-tour/tileset/equirect-to-cube.ts`
 *   (η δειγματοληψία) · `tour-tileset-baker.ts` (γράφει ό,τι βγάζει αυτό)
 * @module server/spatial-tour/tour-tileset-render
 *
 * ⚖️ `sharp` μόνο στον διακομιστή — όρος της εξαίρεσης LGPL του `@img/sharp-*` (ADR-598).
 * 🧠 **Μνήμη**: ένα 8K equirect είναι ~100 MB ωμό· κρατάμε **μία** όψη τη φορά και βγάζουμε τα πλακίδια ως ροή
 * (`AsyncIterable`), ώστε ο γραφέας να ανεβάζει όσο ψήνεται.
 */

import sharp from 'sharp';

import { renderCubeFace, type RawImage } from '@/lib/spatial-tour/tileset/equirect-to-cube';
import {
  TOUR_PREVIEW_FACE_SIZE,
  TOUR_TILE_JPEG_QUALITY,
  TOUR_TILE_SIZE,
  faceSizeForEquirect,
  previewSegments,
  tileSegments,
  tilesPerSide,
  tilesetLevels,
} from '@/lib/spatial-tour/tileset/tour-tileset-layout';
import { TOUR_CUBE_FACES, type TourCubeFace } from '@/lib/spatial-tour/viewer/tour-cube-faces';

/** Ένα αντικείμενο προς αποθήκευση: τα τμήματα διαδρομής μετά το `tour-tiles/{tourId}/` και τα bytes. */
export interface TilesetObject {
  readonly segments: readonly string[];
  readonly body: Buffer;
}

interface RenderedTileset {
  readonly faceSize: number;
  readonly objects: AsyncIterable<TilesetObject>;
}

const RGB = 3;

async function decodeEquirect(bytes: Buffer): Promise<RawImage> {
  const { data, info } = await sharp(bytes).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function rawInput(image: RawImage): sharp.Sharp {
  return sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength), {
    raw: { width: image.width, height: image.height, channels: RGB },
  });
}

async function resized(face: RawImage, size: number): Promise<RawImage> {
  if (size === face.width) return face;
  const data = await rawInput(face).resize(size, size, { kernel: 'lanczos3' }).raw().toBuffer();
  return { data, width: size, height: size, channels: RGB };
}

function jpeg(image: sharp.Sharp): Promise<Buffer> {
  return image.jpeg({ quality: TOUR_TILE_JPEG_QUALITY, mozjpeg: true }).toBuffer();
}

async function* levelTiles(hash: string, face: TourCubeFace, level: number, image: RawImage): AsyncGenerator<TilesetObject> {
  const side = tilesPerSide(image.width);
  for (let row = 0; row < side; row++) {
    for (let col = 0; col < side; col++) {
      const left = col * TOUR_TILE_SIZE;
      const top = row * TOUR_TILE_SIZE;
      const region = {
        left, top, width: Math.min(TOUR_TILE_SIZE, image.width - left), height: Math.min(TOUR_TILE_SIZE, image.height - top),
      };
      yield { segments: tileSegments(hash, level, face, row, col), body: await jpeg(rawInput(image).extract(region)) };
    }
  }
}

async function* tilesetObjects(source: RawImage, hash: string, faceSize: number): AsyncGenerator<TilesetObject> {
  const levels = tilesetLevels(faceSize);
  const previewFaces: Buffer[] = [];
  for (const face of TOUR_CUBE_FACES) {
    const full = renderCubeFace(source, face, faceSize);
    for (let level = levels.length - 1; level >= 0; level--) {
      yield* levelTiles(hash, face, level, await resized(full, levels[level]));
    }
    previewFaces.push(Buffer.from((await resized(full, TOUR_PREVIEW_FACE_SIZE)).data));
  }
  // Κατακόρυφη λωρίδα = απλή παράθεση των ωμών όψεων, με τη σειρά του `TOUR_CUBE_FACES`.
  const strip = { data: Buffer.concat(previewFaces), width: TOUR_PREVIEW_FACE_SIZE, height: TOUR_PREVIEW_FACE_SIZE * TOUR_CUBE_FACES.length, channels: RGB };
  yield { segments: previewSegments(hash), body: await jpeg(rawInput(strip)) };
}

/** **Ψήσε** — επιστρέφει το μέγεθος όψης αμέσως και τα αντικείμενα ως ροή. */
export async function renderTileset(bytes: Buffer, hash: string): Promise<RenderedTileset> {
  const source = await decodeEquirect(bytes);
  const faceSize = faceSizeForEquirect(source.width);
  return { faceSize, objects: tilesetObjects(source, hash, faceSize) };
}
