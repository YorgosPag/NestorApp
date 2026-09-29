/**
 * @fileoverview **Συνθετικό πανόραμα με πρόσωπο σε γνωστή κατεύθυνση** (ADR-884 Φ2ζ ζ4) — για τις άγκυρες του αυτόματου θολώματος.
 * Η φωτογραφία (`face-portrait-nasa-jsc2003e41874.jpg`, δημόσιος τομέας — `README.md`) προβάλλεται **γνωμονικά** (όπως τη βλέπει
 * ένας φακός) πάνω στη σφαίρα, με κέντρο `(yaw, pitch)` και γωνιακό πλάτος `widthRad`.
 *
 * 🔑 **Ανεξάρτητη γεωμετρία**: η σύμβαση equirect (yaw 0 = κέντρο εικόνας, θετικό = δεξιά, pitch θετικό = πάνω) γράφεται εδώ
 * **ξανά**, από τον ορισμό — όχι με τις συναρτήσεις του κώδικα. Αν ο κώδικας γύρισε ανάποδα άξονα, η άγκυρα κοκκινίζει.
 */

import path from 'node:path';

import sharp from 'sharp';

const FACE_PHOTO = path.join(__dirname, 'face-portrait-nasa-jsc2003e41874.jpg');
const BACKGROUND = 128;

export interface FacePlacement {
  readonly yawRad: number;
  readonly pitchRad: number;
  /** Γωνιακό πλάτος της φωτογραφίας (το ύψος ακολουθεί την αναλογία της). */
  readonly widthRad: number;
}

interface Photo {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
}

type Vec = readonly [number, number, number];

const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** yaw 0 = −Z, θετικό προς +X, pitch θετικό προς +Y — ο ορισμός, ξαναγραμμένος. */
const direction = (yaw: number, pitch: number): Vec => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];

/** Το εικονοστοιχείο της φωτογραφίας που βλέπει η κατεύθυνση `d` — ή `null` αν πέφτει έξω από αυτήν. */
function photoPixelOf(d: Vec, placement: FacePlacement, photo: Photo): number | null {
  const { yawRad: y, pitchRad: p } = placement;
  const centre = direction(y, p);
  const east: Vec = [Math.cos(y), 0, Math.sin(y)];
  const north: Vec = [-Math.sin(y) * Math.sin(p), Math.cos(p), Math.cos(y) * Math.sin(p)];
  const depth = dot(d, centre);
  if (depth <= 0) return null;
  const halfW = Math.tan(placement.widthRad / 2);
  const halfH = halfW * (photo.height / photo.width);
  const u = (dot(d, east) / depth / halfW + 1) / 2;
  const v = (1 - dot(d, north) / depth / halfH) / 2;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
  return (Math.floor(v * photo.height) * photo.width + Math.floor(u * photo.width)) * 3;
}

async function loadPhoto(): Promise<Photo> {
  const { data, info } = await sharp(FACE_PHOTO).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** **Equirect `width × width/2`** (JPEG) με ένα πρόσωπο ανά τοποθέτηση, σε ουδέτερο γκρι φόντο. */
export async function equirectWithFaces(width: number, placements: readonly FacePlacement[]): Promise<Buffer> {
  const photo = await loadPhoto();
  const height = width / 2;
  const raw = Buffer.alloc(width * height * 3, BACKGROUND);
  for (let j = 0; j < height; j++) {
    const pitch = (0.5 - (j + 0.5) / height) * Math.PI;
    for (let i = 0; i < width; i++) {
      const d = direction(((i + 0.5) / width - 0.5) * 2 * Math.PI, pitch);
      for (const placement of placements) {
        const at = photoPixelOf(d, placement, photo);
        if (at !== null) photo.data.copy(raw, (j * width + i) * 3, at, at + 3);
      }
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
}
