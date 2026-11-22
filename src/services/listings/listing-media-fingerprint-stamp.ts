/**
 * @fileoverview Το αποτύπωμα μέσων **στον διακομιστή** — οι κανονικές συμβολοσειρές περασμένες από SHA-256.
 * @related ADR-845 §7.17 Α5 · ADR-920 §14.9 Γ · lib/listings/listing-media-fingerprint (η κανονική μορφή) ·
 *   services/listings/listing-shelf-routing (οι συνταγές)
 * @module services/listings/listing-media-fingerprint-stamp
 *
 * 🔑 Χωριστό από την κανονική μορφή **μόνο** για το εργαλείο του hash (`node:crypto`, σύγχρονο) και για τις
 * **συνταγές**, που ξέρει μόνο ο διακομιστής (`PUBLIC_SHELF_KINDS`). Η **μορφή** είναι μία.
 */

import 'server-only';

import { createHash } from 'node:crypto';

import type { ListingMaterial } from '@/lib/listings/listing-material';
import { mediaFingerprintInput, mediaRecipesInput, stampOf } from '@/lib/listings/listing-media-fingerprint';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

import { listingShelfRecipesOf } from './listing-shelf-routing';

const sha256Hex = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * **Το αποτύπωμα αυτών των μέσων**, όπως γράφεται και όπως συγκρίνεται: `v3:<πηγές>:<συνταγές>`.
 *
 * 🔑 Οι συνταγές είναι **ανά πηγή, με τη σειρά της**: αλλαγή συνταγής εδάφους αλλάζει το αποτύπωμα **μόνο** των
 * αγγελιών που έχουν έδαφος (ADR-920 §14.9 Γ).
 */
export function mediaFingerprintOf(sources: readonly PublicShelfSource<ListingMaterial>[]): string {
  const recipes = sources.map(listingShelfRecipesOf);
  return stampOf(sha256Hex(mediaFingerprintInput(sources)), sha256Hex(mediaRecipesInput(recipes)));
}
