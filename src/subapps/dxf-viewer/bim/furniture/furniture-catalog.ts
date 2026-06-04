/**
 * Furniture catalog presets (SSoT) — ADR-410 vertical slice.
 *
 * The single source of truth for every shippable furniture asset: its catalog
 * id (which doubles as the Firebase Storage filename `furniture-library/<id>.glb`),
 * authored footprint dimensions (so the 2D footprint + 3D bbox placeholder work
 * WITHOUT loading the glTF), ΑΤΟΕ code and IFC class.
 *
 * Like a Revit content library entry: geometry lives in the mesh, metadata lives
 * here. The ribbon picker options are GENERATED from `FURNITURE_CATALOG` — never
 * hand-maintain a parallel list.
 *
 * Legality (ADR-409 §B-θετικό + §D.1): assets are MIXED licence —
 *   • Poly Haven assets = CC0 (no obligation)
 *   • Sketchfab assets  = CC-BY 4.0 (MANDATORY creator attribution, kept in `source`)
 * Both licences allow commercial redistribution + enrichment; the BIM metadata
 * below is ours. The exact licence + attribution per asset lives in each entry's
 * `source` field — that is the SSoT, not this comment.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 * @see docs/centralized-systems/reference/adrs/ADR-409-third-party-bim-library-licensing-policy.md §D.1
 */

import type { AtoeCategoryCode } from '../types/bim-base';
import type { FurnitureKind } from '../types/furniture-types';

export interface FurnitureCatalogPreset {
  /**
   * Catalog id — persisted in `FurnitureParams.assetId` AND used as the Storage
   * object name (`furniture-library/<id>.glb`). Stable, lowercase-kebab.
   */
  readonly id: string;
  /** Furniture kind discriminator. */
  readonly kind: FurnitureKind;
  /** i18n label key (namespace: dxf-viewer-shell). */
  readonly labelKey: string;
  /** Authored footprint width (mm) — X before rotation. */
  readonly widthMm: number;
  /** Authored footprint depth (mm) — Y before rotation. */
  readonly depthMm: number;
  /** Authored overall height (mm) — bbox Z. */
  readonly heightMm: number;
  /** ΑΤΟΕ category code for the BOQ feed (unit = 'pcs'). */
  readonly atoeCode: AtoeCategoryCode;
  /** Source attribution (CC0 — no obligation, kept for provenance only). */
  readonly source: string;
}

/**
 * The shippable furniture library. Opening slice = a single CC0 chair.
 * `chair_01` ↔ Firebase Storage `furniture-library/chair_01.glb`.
 */
export const FURNITURE_CATALOG: readonly FurnitureCatalogPreset[] = [
  {
    id: 'dining_chair_02',
    kind: 'chair',
    labelKey: 'furniture.catalog.diningChair02',
    widthMm: 434,
    depthMm: 576,
    heightMm: 973,
    atoeCode: 'ΟΙΚ-12',
    source: 'Poly Haven (CC0)',
  },
  {
    id: 'painted_wooden_chair_01',
    kind: 'chair',
    labelKey: 'furniture.catalog.paintedWoodenChair01',
    widthMm: 432,
    depthMm: 540,
    heightMm: 956,
    atoeCode: 'ΟΙΚ-12',
    source: 'Poly Haven (CC0)',
  },
  {
    id: 'plastic_monobloc_chair_01',
    kind: 'chair',
    labelKey: 'furniture.catalog.plasticMonoblocChair01',
    widthMm: 642,
    depthMm: 628,
    heightMm: 880,
    atoeCode: 'ΟΙΚ-12',
    source: 'Poly Haven (CC0)',
  },
  {
    id: 'coffee_table_round_01',
    kind: 'table',
    labelKey: 'furniture.catalog.coffeeTableRound01',
    widthMm: 1301,
    depthMm: 1301,
    heightMm: 491,
    atoeCode: 'ΟΙΚ-12',
    source: 'Poly Haven (CC0)',
  },
  {
    id: 'modern_coffee_table_01',
    kind: 'table',
    labelKey: 'furniture.catalog.modernCoffeeTable01',
    widthMm: 600,
    depthMm: 1202,
    heightMm: 390,
    atoeCode: 'ΟΙΚ-12',
    source: 'Poly Haven (CC0)',
  },
  {
    id: 'modern_coffee_table_02',
    kind: 'table',
    labelKey: 'furniture.catalog.modernCoffeeTable02',
    widthMm: 1199,
    depthMm: 1200,
    heightMm: 369,
    atoeCode: 'ΟΙΚ-12',
    source: 'Poly Haven (CC0)',
  },
  {
    id: 'side_table_01',
    kind: 'table',
    labelKey: 'furniture.catalog.sideTable01',
    widthMm: 550,
    depthMm: 450,
    heightMm: 551,
    atoeCode: 'ΟΙΚ-12',
    source: 'Poly Haven (CC0)',
  },
  // ADR-410/411 — μοντέρνοι φωτορεαλιστικοί PBR ΚΑΝΑΠΕΔΕΣ (kind 'sofa') από
  // Sketchfab, άδεια CC-BY 4.0 (ADR-409 §B-θετικό.2). Οι Kenney CC0 καναπέδες
  // αφαιρέθηκαν (Giorgio: χαμηλή low-poly ποιότητα). CC-BY → υποχρεωτική αναφορά
  // δημιουργού στο `source` (όνομα + CC-BY + URL). Διαστάσεις = πραγματικό bbox
  // μετά από per-model height-normalization στα ~780mm (artist meshes σε αυθαίρετη
  // κλίμακα· bake scale στα GLB root nodes, validate 0 errors).
  {
    id: 'sofa_midcentury_01',
    kind: 'sofa',
    labelKey: 'furniture.catalog.sofaMidcentury01',
    widthMm: 1826,
    depthMm: 844,
    heightMm: 780,
    atoeCode: 'ΟΙΚ-12',
    source: 'Mid Century Modern Sofa by Tom Seddon (CC-BY) — sketchfab.com/3d-models/1f9f52ae17d642b582d0c5ccf9dd64b3',
  },
  {
    id: 'sofa_modern_01',
    kind: 'sofa',
    labelKey: 'furniture.catalog.sofaModern01',
    widthMm: 1918,
    depthMm: 645,
    heightMm: 780,
    atoeCode: 'ΟΙΚ-12',
    source: 'Modern Couch by sudeepsingh (CC-BY) — sketchfab.com/3d-models/e07980eccfa143a98b87c742d10e30e2',
  },
  {
    id: 'sofa_modern_02',
    kind: 'sofa',
    labelKey: 'furniture.catalog.sofaModern02',
    widthMm: 2622,
    depthMm: 850,
    heightMm: 780,
    atoeCode: 'ΟΙΚ-12',
    source: 'Modern Couch by Sinematic3D (CC-BY) — sketchfab.com/3d-models/9b1e09abe5e34d6397937ebf59901898',
  },
  {
    id: 'sofa_delica_01',
    kind: 'sofa',
    labelKey: 'furniture.catalog.sofaDelica01',
    widthMm: 2106,
    depthMm: 625,
    heightMm: 780,
    atoeCode: 'ΟΙΚ-12',
    source: 'Delica Couch by Visthétique (CC-BY) — sketchfab.com/3d-models/be956580a9b5457aa811c73701a49419',
  },
  // ADR-410/411 v2.1 — μεγάλη επέκταση βιβλιοθήκης: μοντέρνα φωτορεαλιστικά PBR
  // έπιπλα από Sketchfab (CC-BY 4.0, ADR-409 §B-θετικό.2) σε 10 νέα kinds. Per-item
  // scale-normalization στον μακρύτερο άξονα (artist meshes αυθαίρετη κλίμακα). Οι
  // διαστάσεις είναι το πραγματικό scaled bbox (w=gltfX, d=gltfZ, h=gltfY).
  // — κρεβάτια (μοντέρνα PBR, αντικαθιστούν τα Kenney) —
  {
    id: 'bed_modern_01',
    kind: 'bed',
    labelKey: 'furniture.catalog.bedModern01',
    widthMm: 2000,
    depthMm: 861,
    heightMm: 718,
    atoeCode: 'ΟΙΚ-12',
    source: 'Modern Wooden Bed by Jay_desai (CC-BY) — sketchfab.com/3d-models/443ba9fae87e4019a8c58a9a71f07c46',
  },
  {
    id: 'bed_blanc_01',
    kind: 'bed',
    labelKey: 'furniture.catalog.bedBlanc01',
    widthMm: 2000,
    depthMm: 1004,
    heightMm: 900,
    atoeCode: 'ΟΙΚ-12',
    source: 'Blanc Bed by NateNateroberts (CC-BY) — sketchfab.com/3d-models/2dde9ffbf7a0423b9f2782621067319a',
  },
  // — καρέκλες —
  {
    id: 'chair_dining_03',
    kind: 'chair',
    labelKey: 'furniture.catalog.chairDining03',
    widthMm: 849,
    depthMm: 900,
    heightMm: 804,
    atoeCode: 'ΟΙΚ-12',
    source: 'Dining Chair by soidev (CC-BY) — sketchfab.com/3d-models/05e815d0f2f64647b646e9b71f8ec9ed',
  },
  {
    id: 'chair_office_01',
    kind: 'chair',
    labelKey: 'furniture.catalog.chairOffice01',
    widthMm: 783,
    depthMm: 826,
    heightMm: 1050,
    atoeCode: 'ΟΙΚ-12',
    source: 'Office Chair Modern by thethieme (CC-BY) — sketchfab.com/3d-models/675f34f7304e4d92812a41e9750539aa',
  },
  {
    id: 'chair_office_02',
    kind: 'chair',
    labelKey: 'furniture.catalog.chairOffice02',
    widthMm: 671,
    depthMm: 692,
    heightMm: 1050,
    atoeCode: 'ΟΙΚ-12',
    source: 'Office Chair by artvolodskikh (CC-BY) — sketchfab.com/3d-models/a7fefb5dde954c84896949246dde5be6',
  },
  // — τραπέζια —
  {
    id: 'table_noguchi_01',
    kind: 'table',
    labelKey: 'furniture.catalog.tableNoguchi01',
    widthMm: 1200,
    depthMm: 864,
    heightMm: 367,
    atoeCode: 'ΟΙΚ-12',
    source: 'Noguchi Coffee Table by Deborah Kumagai (CC-BY) — sketchfab.com/3d-models/8f8a3dbd45534152b5771c36cc4742d9',
  },
  // — πολυθρόνες (armchair) —
  {
    id: 'armchair_patricia_01',
    kind: 'armchair',
    labelKey: 'furniture.catalog.armchairPatricia01',
    widthMm: 720,
    depthMm: 720,
    heightMm: 850,
    atoeCode: 'ΟΙΚ-12',
    source: 'Armchair Patricia by VirtualBG (CC-BY) — sketchfab.com/3d-models/31570071aa0c4901bc7a1841f1e51844',
  },
  {
    id: 'armchair_midcentury_01',
    kind: 'armchair',
    labelKey: 'furniture.catalog.armchairMidcentury01',
    widthMm: 850,
    depthMm: 714,
    heightMm: 764,
    atoeCode: 'ΟΙΚ-12',
    source: 'Midcentury Harvey Probber Armchair by eireni (CC-BY) — sketchfab.com/3d-models/e54f711755a54b119b364fe6fcbfd821',
  },
  // — γραφείο (desk) —
  {
    id: 'desk_01',
    kind: 'desk',
    labelKey: 'furniture.catalog.desk01',
    widthMm: 1183,
    depthMm: 1200,
    heightMm: 947,
    atoeCode: 'ΟΙΚ-12',
    source: 'School Desk by barism09 (CC-BY) — sketchfab.com/3d-models/a74180ee97bb4917b24cd48580663b44',
  },
  // — ντουλάπια / μπουφέδες (cabinet) —
  {
    id: 'cabinet_sideboard_01',
    kind: 'cabinet',
    labelKey: 'furniture.catalog.cabinetTall01',
    widthMm: 736,
    depthMm: 499,
    heightMm: 1500,
    atoeCode: 'ΟΙΚ-12',
    source: 'Sideboard Cabinet by Sharon El Schwaab (CC-BY) — sketchfab.com/3d-models/87f73814d5ce48f89aff98787006c95e',
  },
  {
    id: 'cabinet_sideboard_02',
    kind: 'cabinet',
    labelKey: 'furniture.catalog.cabinetSideboard01',
    widthMm: 1600,
    depthMm: 475,
    heightMm: 832,
    atoeCode: 'ΟΙΚ-12',
    source: 'Sideboard Design by Home 3D Model Rendering (CC-BY) — sketchfab.com/3d-models/aa85db9b82054ddfb6aaf63e6fe221b1',
  },
  // — ντουλάπες (wardrobe) —
  {
    id: 'wardrobe_modern_01',
    kind: 'wardrobe',
    labelKey: 'furniture.catalog.wardrobeModern01',
    widthMm: 1690,
    depthMm: 563,
    heightMm: 2000,
    atoeCode: 'ΟΙΚ-12',
    source: 'Modern Wooden Wardrobe by M4nT1Core (CC-BY) — sketchfab.com/3d-models/aff452c30e724283ae2c4f17297e0ef7',
  },
  {
    id: 'wardrobe_classic_01',
    kind: 'wardrobe',
    labelKey: 'furniture.catalog.wardrobeClassic01',
    widthMm: 902,
    depthMm: 781,
    heightMm: 2000,
    atoeCode: 'ΟΙΚ-12',
    source: 'Wardrobe Classic by Blaž Mraz (CC-BY) — sketchfab.com/3d-models/47270ac8a40c4af8bb55d076b159122a',
  },
  // — βιβλιοθήκη (bookshelf) —
  {
    id: 'bookshelf_wooden_01',
    kind: 'bookshelf',
    labelKey: 'furniture.catalog.bookshelfWooden01',
    widthMm: 1900,
    depthMm: 927,
    heightMm: 1884,
    atoeCode: 'ΟΙΚ-12',
    source: 'Wooden Bookcases by Matthew Collings (CC-BY) — sketchfab.com/3d-models/d0618ac16b2a4a87b9b6c7d5e6765626',
  },
  // — κομοδίνα (nightstand) —
  {
    id: 'nightstand_01',
    kind: 'nightstand',
    labelKey: 'furniture.catalog.nightstand01',
    widthMm: 550,
    depthMm: 367,
    heightMm: 501,
    atoeCode: 'ΟΙΚ-12',
    source: 'Nightstand by patriciu (CC-BY) — sketchfab.com/3d-models/5209cee63d5b48db83f75cfa2012f2d1',
  },
  {
    id: 'nightstand_02',
    kind: 'nightstand',
    labelKey: 'furniture.catalog.nightstand02',
    widthMm: 415,
    depthMm: 454,
    heightMm: 550,
    atoeCode: 'ΟΙΚ-12',
    source: 'Nightstand by Josean_3dev (CC-BY) — sketchfab.com/3d-models/e72a40a1adde489b9e0149f94eb7d967',
  },
  // — παγκάκι (bench) —
  {
    id: 'bench_modern_01',
    kind: 'bench',
    labelKey: 'furniture.catalog.benchModern01',
    widthMm: 1300,
    depthMm: 459,
    heightMm: 650,
    atoeCode: 'ΟΙΚ-12',
    source: 'Modern Bench by Geisson Pacheco (CC-BY) — sketchfab.com/3d-models/c57d2701903a4e20955e0b4c967e6215',
  },
  // — συρταριέρα (dresser) —
  {
    id: 'dresser_ikea_01',
    kind: 'dresser',
    labelKey: 'furniture.catalog.dresserIkea01',
    widthMm: 587,
    depthMm: 393,
    heightMm: 1000,
    atoeCode: 'ΟΙΚ-12',
    source: 'Ikea Drawer Cabinet by Taken_id (CC-BY) — sketchfab.com/3d-models/ece4a007b36b43aa95c029e5cbd0a216',
  },
  // — σκαμπό (stool) —
  {
    id: 'stool_bar_01',
    kind: 'stool',
    labelKey: 'furniture.catalog.stoolBar01',
    widthMm: 405,
    depthMm: 405,
    heightMm: 750,
    atoeCode: 'ΟΙΚ-12',
    source: 'Bar Stool by Saandy (CC-BY) — sketchfab.com/3d-models/aaf556f40f634719bc80a331d2799e4f',
  },
  // — έπιπλο τηλεόρασης (tvStand) —
  {
    id: 'tvstand_01',
    kind: 'tvStand',
    labelKey: 'furniture.catalog.tvStand01',
    widthMm: 1500,
    depthMm: 384,
    heightMm: 306,
    atoeCode: 'ΟΙΚ-12',
    source: 'TV Stand by Blaž Mraz (CC-BY) — sketchfab.com/3d-models/f6b71d3807d74be69b46cb7b2f2743ad',
  },
] as const;

/** Default asset id picked by the placement tool when none is chosen. */
export const DEFAULT_FURNITURE_ASSET_ID = 'dining_chair_02';

/** Resolve a catalog preset by id. Returns `undefined` for an unknown asset. */
export function resolveFurnitureAsset(assetId: string): FurnitureCatalogPreset | undefined {
  return FURNITURE_CATALOG.find((p) => p.id === assetId);
}
