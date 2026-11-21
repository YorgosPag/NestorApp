/**
 * DXF True-Color ↔ hex — **re-export**. Το σπίτι είναι πλέον το `@/lib/color/true-color` (ADR-920 Β6.1):
 * ο δημόσιος χάρτης εδάφους το χρειάζεται έξω από το subapp. Κανένας από τους εισαγωγείς δεν άλλαξε.
 */

export { trueColorToHex, hexToTrueColor } from '@/lib/color/true-color';
