/**
 * SSoT — procedural tile renderer (ADR-653 Φ9).
 *
 * Ζωγραφίζει το tile ενός **διαδικαστικού** υλικού από παραμέτρους (γεννήτρια + χρώματα +
 * αρμός) σε ένα offscreen `HTMLCanvasElement` που **επαναλαμβάνεται seamless**. Το canvas
 * είναι ισοδύναμο `CanvasImageSource` με ένα `<img>`, οπότε το ADR-643 render path
 * (`computeImageTileMatrix` → `fillHatchPattern`) το tile-άρει **αυτούσιο** — μηδέν αλλαγή
 * math, μηδέν αρχείο εικόνας, πλήρως επεξεργάσιμα χρώματα, τέλεια ευκρίνεια σε normal zoom.
 *
 * Το canvas κωδικοποιεί το **repeat-unit** του μοτίβου (checker=2×2 κελιά, brick=2 σειρές,
 * stripes=2 μπάντες, grid=1 κελί με αρμό στα δεξιά/κάτω όρια). Ο αρμός δίνεται σε mm και
 * μεταφράζεται σε px ως κλάσμα του πραγματικού tile (`jointMm/tileWmm`) → σωστό φυσικό πάχος
 * σε κάθε zoom (η κλίμακα canvas→tileWmm γίνεται από το `computeImageTileMatrix`).
 *
 * Καλείται **μία φορά ανά variant key** μέσα στο `HatchImageCache` (σύγχρονη γέννηση, μηδέν
 * δίκτυο/decode) — ΠΟΤΕ per-frame (ADR-040).
 *
 * @see ../../../data/procedural-material-catalog.ts — defaults ανά γεννήτρια
 * @see ./hatch-image-variant-key.ts — variant key (procedural params + tile dims)
 * @see docs/centralized-systems/reference/adrs/ADR-653-editable-and-procedural-hatch-materials.md §3.1, §4.1
 */

import type { HatchProceduralParams } from '../../../types/entities';

/** Ανάλυση του tile canvas (px). Αρκετά υψηλή για ευκρινείς ακμές σε normal zoom. */
const TILE_PX = 512;

/** Ασφαλές χρώμα όταν λείπει (ουδέτερο γκρι). */
const FALLBACK_COLOR = '#808080';

/** Μετατοπίσεις wrap (±1 tile) ώστε μοτίβα που περνούν το όριο να είναι seamless. */
const WRAP_SHIFTS = [-TILE_PX, 0, TILE_PX] as const;

/**
 * Κέντρα των 2 εξαγώνων ανά repeat-unit (normalized tile coords, u→πλάτος, v→ύψος).
 * Σειρές στο v=0.25 (u=0.5) και v=0.75 (u=0 — το wrap δίνει το u=1) → offset μισού πλάτους.
 */
const HEX_CENTERS: readonly [number, number][] = [
  [0.5, 0.25],
  [0, 0.75],
];

/**
 * Μετατοπίσεις κορυφών pointy-top hex από το κέντρο (normalized). Με tile √3R×3R:
 * ±0.5 u = ±√3R/2 (μισό πλάτος), ±1/3 v = ±R (κορυφή), ±1/6 v = ±R/2 (πλάγιες ακμές).
 */
const HEX_OFFSETS: readonly [number, number][] = [
  [0, 1 / 3],
  [0.5, 1 / 6],
  [0.5, -1 / 6],
  [0, -1 / 3],
  [-0.5, -1 / 6],
  [-0.5, 1 / 6],
];

/** Χρώμα από `colors[i]` με fallback (procedural fills μπορεί να έχουν 1 χρώμα). */
function colorAt(colors: readonly string[], i: number, fallback = FALLBACK_COLOR): string {
  return colors[i] ?? fallback;
}

/**
 * Παράγει το (seamless) tile ενός procedural υλικού, ή `null` αν δεν υπάρχει 2D context.
 * `tileWmm`/`tileHmm` = το πραγματικό μέγεθος tile (για τη μετατροπή αρμού mm→px).
 */
export function renderProceduralTile(
  params: HatchProceduralParams,
  tileWmm: number,
  tileHmm: number,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Αρμός σε px: κλάσμα του πραγματικού tile → φυσικό πάχος (clamp ώστε να μη «κλείνει» το κελί).
  const jointMm = params.jointMm ?? 0;
  const jointPxX = clampJoint((jointMm / Math.max(tileWmm, 1)) * TILE_PX);
  const jointPxY = clampJoint((jointMm / Math.max(tileHmm, 1)) * TILE_PX);
  const jointColor = params.jointColor ?? FALLBACK_COLOR;

  switch (params.generator) {
    case 'checker':
      drawChecker(ctx, params.colors);
      break;
    case 'grid-tile':
      drawGridTile(ctx, colorAt(params.colors, 0), jointColor, jointPxX, jointPxY);
      break;
    case 'running-bond':
      drawRunningBond(ctx, colorAt(params.colors, 0), jointColor, jointPxX, jointPxY);
      break;
    case 'stripes':
      drawStripes(ctx, params.colors);
      break;
    case 'herringbone':
      drawHerringbone(ctx, params.colors, jointColor, jointPxX, jointPxY);
      break;
    case 'basketweave':
      drawBasketweave(ctx, params.colors, jointColor, jointPxX, jointPxY);
      break;
    case 'hexagon':
      drawHexagon(ctx, colorAt(params.colors, 0), jointColor, jointPxX, jointPxY);
      break;
  }
  return canvas;
}

/** Αρμός ≥0 και ≤ 1/3 του κελιού (ώστε να μη καταπίνει το πλακίδιο). */
function clampJoint(px: number): number {
  return Math.max(0, Math.min(px, TILE_PX / 3));
}

/** Γεμίζει όλο το tile με το χρώμα αρμού (grout backdrop) — βάση κάθε jointed μοτίβου. */
function fillJointBackground(ctx: CanvasRenderingContext2D, joint: string): void {
  ctx.fillStyle = joint;
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
}

// ─── Γεννήτριες ─────────────────────────────────────────────────────────────

/** Σκακιέρα: 2×2 κελιά (c0,c1 / c1,c0) — tiles seamless. */
function drawChecker(ctx: CanvasRenderingContext2D, colors: readonly string[]): void {
  const c0 = colorAt(colors, 0, '#1a1a1a');
  const c1 = colorAt(colors, 1, '#f5f5f5');
  const half = TILE_PX / 2;
  ctx.fillStyle = c0;
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = c1;
  ctx.fillRect(half, 0, half, half);
  ctx.fillRect(0, half, half, half);
}

/** Πλακίδιο με αρμό: γεμάτο κελί + αρμός στο δεξί/κάτω όριο → tiling δίνει πλέγμα. */
function drawGridTile(
  ctx: CanvasRenderingContext2D, tile: string, joint: string, jx: number, jy: number,
): void {
  fillJointBackground(ctx, joint);
  ctx.fillStyle = tile;
  ctx.fillRect(0, 0, TILE_PX - jx, TILE_PX - jy);
}

/** Τούβλο (ιμάντας μισής μετατόπισης): 2 σειρές, η κάτω μετατοπισμένη κατά μισό τούβλο. */
function drawRunningBond(
  ctx: CanvasRenderingContext2D, brick: string, mortar: string, jx: number, jy: number,
): void {
  fillJointBackground(ctx, mortar);
  const rowH = TILE_PX / 2;
  const halfW = TILE_PX / 2;
  ctx.fillStyle = brick;
  // Πάνω σειρά: ένα πλήρες τούβλο (κάθετος αρμός στο δεξί όριο → wraps).
  ctx.fillRect(0, 0, TILE_PX - jx, rowH - jy);
  // Κάτω σειρά: μετατόπιση κατά μισό → δύο μισά τούβλα (αρμός στο κέντρο) που wrap-άρουν.
  ctx.fillRect(0, rowH, halfW - jx / 2, rowH - jy);
  ctx.fillRect(halfW, rowH, halfW - jx / 2, rowH - jy);
}

/** Ρίγες: 2 οριζόντιες μπάντες (c0 πάνω, c1 κάτω) — tiles seamless κάθετα. */
function drawStripes(ctx: CanvasRenderingContext2D, colors: readonly string[]): void {
  const c0 = colorAt(colors, 0, '#3d5a80');
  const c1 = colorAt(colors, 1, '#e0e0e0');
  const half = TILE_PX / 2;
  ctx.fillStyle = c0;
  ctx.fillRect(0, 0, TILE_PX, half);
  ctx.fillStyle = c1;
  ctx.fillRect(0, half, TILE_PX, half);
}

/**
 * Ένα «σανίδι» (rect) με αρμό: εσωτερική συρρίκνωση κατά μισό αρμό σε κάθε πλευρά (jx/jy)
 * ώστε δύο γειτονικά rects να αφήνουν πλήρη αρμό ανάμεσα (και μισό στο όριο tile → seamless).
 * Ζωγραφίζεται με wrap (±1 tile) ώστε σανίδες που περνούν το όριο να μη σπάνε.
 */
function fillPlank(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, jx: number, jy: number,
): void {
  const ix = x + jx / 2, iy = y + jy / 2, iw = w - jx, ih = h - jy;
  if (iw <= 0 || ih <= 0) return;
  for (const dx of WRAP_SHIFTS) for (const dy of WRAP_SHIFTS) ctx.fillRect(ix + dx, iy + dy, iw, ih);
}

/** Ψαροκόκαλο (herringbone): 8 σανίδες 2:1 σε staircase (repeat 4W×4W)· H=c0, V=c1 + αρμός. */
function drawHerringbone(
  ctx: CanvasRenderingContext2D, colors: readonly string[], joint: string, jx: number, jy: number,
): void {
  const cH = colorAt(colors, 0, '#a9743f');
  const cV = colorAt(colors, 1, '#8a5a2e');
  fillJointBackground(ctx, joint);
  const u = TILE_PX / 4; // πλάτος σανίδας· μήκος = 2u (λόγος 2:1)
  // {x, y, w, h, vertical}: 4×4 torus, seamless (τα wrapping rects τα καλύπτει το fillPlank).
  const planks: readonly [number, number, number, number, boolean][] = [
    [0, 0, 2 * u, u, false], [2 * u, 0, u, 2 * u, true],
    [3 * u, u, 2 * u, u, false], [u, u, u, 2 * u, true],
    [2 * u, 2 * u, 2 * u, u, false], [0, 2 * u, u, 2 * u, true],
    [u, 3 * u, 2 * u, u, false], [3 * u, 3 * u, u, 2 * u, true],
  ];
  for (const [x, y, w, h, vertical] of planks) {
    ctx.fillStyle = vertical ? cV : cH;
    fillPlank(ctx, x, y, w, h, jx, jy);
  }
}

/** Πλέξη (basketweave): σκακιέρα από μπλοκ 2W· κάθε μπλοκ = 2 σανίδες H(c0)/V(c1) + αρμός. */
function drawBasketweave(
  ctx: CanvasRenderingContext2D, colors: readonly string[], joint: string, jx: number, jy: number,
): void {
  const cH = colorAt(colors, 0, '#c19a6b');
  const cV = colorAt(colors, 1, '#a97f52');
  fillJointBackground(ctx, joint);
  const b = TILE_PX / 2; // μπλοκ = 2W
  const half = b / 2; // πάχος σανίδας = W
  for (let by = 0; by < 2; by++) {
    for (let bx = 0; bx < 2; bx++) {
      const ox = bx * b, oy = by * b;
      if ((bx + by) % 2 === 0) {
        ctx.fillStyle = cH; // μπλοκ οριζόντιων σανίδων (2 στοιβαγμένες)
        fillPlank(ctx, ox, oy, b, half, jx, jy);
        fillPlank(ctx, ox, oy + half, b, half, jx, jy);
      } else {
        ctx.fillStyle = cV; // μπλοκ κάθετων σανίδων (2 δίπλα)
        fillPlank(ctx, ox, oy, half, b, jx, jy);
        fillPlank(ctx, ox + half, oy, half, b, jx, jy);
      }
    }
  }
}

/**
 * Εξάγωνο πλακάκι (hex mosaic): κανονικά pointy-top hex, 2 ανά repeat-unit (√3R×3R),
 * 1 χρώμα + αρμός (grout). Οι κορυφές ορίζονται σε normalized tile coords (η αναλογία
 * tile √3:3 τις κάνει κανονικές στον κόσμο)· inset ανά άξονα → ομοιόμορφος αρμός.
 */
function drawHexagon(
  ctx: CanvasRenderingContext2D, tile: string, joint: string, jx: number, jy: number,
): void {
  fillJointBackground(ctx, joint);
  ctx.fillStyle = tile;
  const su = 1 - (2 * jx) / TILE_PX; // grout ως κλάσμα του μισού πλάτους hex (√3R/2)
  const sv = 1 - (3 * jy) / TILE_PX; // grout ως κλάσμα του R (κατακόρυφη ακτίνα)
  for (const [cu, cv] of HEX_CENTERS) {
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
      fillHexPath(ctx, (cu + dx) * TILE_PX, (cv + dy) * TILE_PX, su, sv);
    }
  }
}

/** Ένα εξάγωνο (inset κατά su/sv) γύρω από κέντρο (px,py). */
function fillHexPath(
  ctx: CanvasRenderingContext2D, px: number, py: number, su: number, sv: number,
): void {
  ctx.beginPath();
  HEX_OFFSETS.forEach(([ou, ov], i) => {
    const x = px + ou * su * TILE_PX;
    const y = py + ov * sv * TILE_PX;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}
