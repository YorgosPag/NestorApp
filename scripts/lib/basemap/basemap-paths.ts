/**
 * @fileoverview Πού ζουν τα αρχεία του χάρτη φόντου στον δίσκο — **εκτός git**, στην cache του `node_modules`.
 * @related ADR-891 §7 · §9 · `scripts/build-basemap.ts` (γράφει) · `scripts/serve-basemap.ts` (σερβίρει)
 */

import { join } from 'node:path';

import { REPO_ROOT } from '../admin-boundaries/admin-boundary-source';

/** Λήψεις, εργαλείο, ενδιάμεσα αρχεία. */
export const BASEMAP_CACHE_DIR = join(REPO_ROOT, 'node_modules', '.cache', 'basemap');

/** Ο φάκελος που ανεβαίνει αυτούσιος στον διακομιστή (αρχείο + assets + άδειες). */
export const BASEMAP_BUNDLE_DIR = join(BASEMAP_CACHE_DIR, 'out', 'bundle');
