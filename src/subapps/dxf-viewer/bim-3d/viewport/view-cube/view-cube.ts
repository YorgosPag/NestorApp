/**
 * ViewCube — **re-export**. Το σπίτι είναι πλέον το `@/lib/three/view-cube/view-cube` (ADR-920 Β6.3):
 * ο ίδιος κύβος (ADR-553, scissored sub-viewport του ΙΔΙΟΥ renderer) οδηγεί και τον θεατή εδάφους της
 * αγγελίας. Κανένας από τους εισαγωγείς του viewer δεν άλλαξε.
 */

export { createViewCube } from '@/lib/three/view-cube/view-cube';
export type { ViewCubeEngine } from '@/lib/three/view-cube/view-cube';
