/**
 * @fileoverview Το αποτύπωμα μέσων **στον διακομιστή** — η κανονική συμβολοσειρά περασμένη από SHA-256.
 * @related ADR-845 §7.17 Α5 · lib/listings/listing-media-fingerprint (η κανονική μορφή, κοινή με τον browser)
 * @module services/listings/listing-media-fingerprint-stamp
 *
 * 🔑 Χωριστό από την κανονική μορφή **μόνο** για το εργαλείο του hash: εδώ `node:crypto`
 * *(σύγχρονο)*, στον browser Web Crypto *(ασύγχρονο)*. Η **μορφή** είναι μία.
 */

import 'server-only';

import { createHash } from 'node:crypto';

import type { ListingMaterial } from '@/lib/listings/listing-material';
import { mediaFingerprintInput, stampOf } from '@/lib/listings/listing-media-fingerprint';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

/** **Το αποτύπωμα αυτών των μέσων**, όπως γράφεται και όπως συγκρίνεται. */
export function mediaFingerprintOf(sources: readonly PublicShelfSource<ListingMaterial>[]): string {
  return stampOf(createHash('sha256').update(mediaFingerprintInput(sources), 'utf8').digest('hex'));
}
