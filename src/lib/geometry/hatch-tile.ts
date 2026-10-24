/**
 * **Το πλακίδιο μιας διαγράμμισης 45°** — path data για `<pattern>` του SVG (ADR-907 κάτοψη ορόφου · ADR-920 χάρτης εδάφους).
 *
 * 🔑 Οι γραμμές ξεκινούν **έξω** από το πλακίδιο (±¼ πλευράς), ώστε τα πλακίδια να ενώνονται **χωρίς ραφή** στις γωνίες·
 *   μία μόνο διαγώνιος από γωνία σε γωνία αφήνει κενά-σκαλοπάτια σε κάθε ένωση. Ένα σημείο για κάθε διαγράμμιση της
 *   εφαρμογής: δύο αντίγραφα θα απέκλιναν στην πρώτη διόρθωση της ραφής.
 *
 * @module lib/geometry/hatch-tile
 */

/** `rising` = «/» · `cross` = «/» + «\». */
export type HatchTileKind = 'rising' | 'cross';

/** Path data του πλακιδίου πλευράς `tile` (μονάδες του χρήστη SVG). */
export function hatchTilePathData(tile: number, kind: HatchTileKind): string {
  const q = tile / 4;
  const rising = `M${-q},${q} l${2 * q},${-2 * q} M0,${tile} l${tile},${-tile} M${tile - q},${tile + q} l${2 * q},${-2 * q}`;
  if (kind === 'rising') return rising;
  const falling = `M${-q},${tile - q} l${2 * q},${2 * q} M0,0 l${tile},${tile} M${tile - q},${-q} l${2 * q},${2 * q}`;
  return `${rising} ${falling}`;
}
