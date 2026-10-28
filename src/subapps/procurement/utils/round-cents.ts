/**
 * Στρογγυλοποίηση ποσού € σε λεπτά — ΕΝΑ σημείο για σύγκριση προσφορών και bid leveling (ADR-327 §8).
 * @module subapps/procurement/utils/round-cents
 */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
