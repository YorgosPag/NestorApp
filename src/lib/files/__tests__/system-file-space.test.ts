/**
 * @jest-environment node
 *
 * =============================================================================
 * 🔒 ΑΓΚΥΡΑ: Ο ΧΩΡΟΣ ΣΥΣΤΗΜΑΤΟΣ ΤΩΝ ΑΡΧΕΙΩΝ ΜΕΝΕΙ ΧΩΡΙΣΤΟΣ (ADR-934 §5.2.2 Μ-β6)
 * =============================================================================
 *
 * **Το ερώτημα**: *«μπορεί ένας τύπος του χώρου συστήματος να ξαναβρεθεί στο `files` του ανθρώπου — και να φανεί σε
 * λίστα, κάδο, αναζήτηση;»*
 *
 * | ομάδα | ερώτημα | μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Κ | ο κατάλογος είναι κλειστός και δεμένος στο `ENTITY_TYPES`; | τύπος-φάντασμα · κριτής που λέει «ναι» σε όλα |
 * | Α | ποιο module ονομάζει τύπο του χώρου συστήματος; | νέος γραφέας (π.χ. `ENTITY_TYPES.CATALOG_MEDIA_CONTENT` σε άλλο αρχείο) |
 * | Σ | κανένα module του χώρου δεν ρωτά τη συλλογή του ανθρώπου | `COLLECTIONS.FILES_SYSTEM` → `COLLECTIONS[FILE_COLLECTION.company]` |
 * | Γ | ο ΕΝΑΣ δείκτης εγγραφής περιεχομένου δείχνει στον χώρο συστήματος | ίδιο, στο `mediaContentFileRef` |
 *
 * 🔑 Η ανακάλυψη γίνεται **από τον δίσκο** (κάθε `.ts/.tsx` του `src/`), ποτέ από χειρόγραφη λίστα αρχείων — η λίστα
 * εδώ είναι η **άδεια**, όχι η σάρωση.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from '@jest/globals';

import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  isSystemSpaceEntityType,
  SYSTEM_FILE_ENTITY_TYPES,
  SYSTEM_FILE_ENTITY_TYPE_REASONS,
} from '../system-file-space';

const SRC = path.resolve(__dirname, '../../..');
const rel = (file: string): string => path.relative(SRC, file).split(path.sep).join('/');

/**
 * **Τα modules που επιτρέπεται να ονομάζουν τύπο του χώρου συστήματος** — με λόγο. Νέα γραμμή = απόφαση ότι το module
 * ζει **μέσα** στον χώρο (και η ομάδα Σ το ελέγχει αμέσως).
 */
const SYSTEM_SPACE_MODULES: Readonly<Record<string, string>> = {
  'config/domain-constants.ts': 'η δήλωση του τύπου',
  'lib/files/system-file-space.ts': 'ο κλειστός κατάλογος του χώρου',
  'server/catalog/media-quarantine.server.ts': 'ο γραφέας της καραντίνας (γέννηση)',
  'server/catalog/media-quarantine-sweep.server.ts': 'το δίχτυ ορφανών της καραντίνας',
  'subapps/catalog/import/media-content-state.ts': 'ο κριτής κατάστασης της καραντίνας',
};

/** Οι δηλώσεις — δεν ρωτούν συλλογή, άρα η ομάδα Σ δεν τις αφορά. */
const DECLARATION_MODULES = new Set(['config/domain-constants.ts', 'lib/files/system-file-space.ts']);

/** Ό,τι δείχνει στη συλλογή του ανθρώπου (`files` / `files_personal`). */
const USER_SPACE_COLLECTION = /COLLECTIONS\.FILES(?:_PERSONAL)?\b(?!_)|\bFILE_COLLECTION\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Το κλειδί του `ENTITY_TYPES` για μια τιμή (π.χ. `catalog_media_content` → `CATALOG_MEDIA_CONTENT`). */
const entityTypeKeyOf = (value: string): string | undefined =>
  Object.entries(ENTITY_TYPES).find(([, v]) => v === value)?.[0];

/** Αναφέρει το κείμενο τύπο του χώρου συστήματος — με το κλειδί **ή** με την ωμή τιμή; */
function namesSystemType(text: string): boolean {
  return SYSTEM_FILE_ENTITY_TYPES.some((value) => {
    const key = entityTypeKeyOf(value);
    return (key !== undefined && text.includes(`ENTITY_TYPES.${key}`)) || text.includes(`'${value}'`) || text.includes(`"${value}"`);
  });
}

const SOURCES = walk(SRC).map((file) => ({ file: rel(file), text: fs.readFileSync(file, 'utf8') }));

describe('Κ — ο κλειστός κατάλογος', () => {
  it('έχει τουλάχιστον έναν τύπο, και κάθε τύπος είναι τιμή του `ENTITY_TYPES` με λόγο', () => {
    expect(SYSTEM_FILE_ENTITY_TYPES.length).toBeGreaterThan(0);
    for (const value of SYSTEM_FILE_ENTITY_TYPES) {
      expect(entityTypeKeyOf(value)).toBeDefined();
      expect(SYSTEM_FILE_ENTITY_TYPE_REASONS[value].length).toBeGreaterThan(20);
    }
  });

  it('ο κριτής λέει «ναι» μόνο στον κατάλογο', () => {
    expect(isSystemSpaceEntityType(ENTITY_TYPES.CATALOG_MEDIA_CONTENT)).toBe(true);
    expect(isSystemSpaceEntityType(ENTITY_TYPES.CATALOG_ASSET)).toBe(false);
    expect(isSystemSpaceEntityType('toString')).toBe(false);
    expect(isSystemSpaceEntityType(undefined)).toBe(false);
  });
});

describe('Α — ποιος ονομάζει τύπο του χώρου συστήματος', () => {
  it('🔴 μόνο τα δηλωμένα modules (νέος γραφέας ⇒ απόφαση, όχι σύμπτωση)', () => {
    const naming = SOURCES.filter(({ text }) => namesSystemType(text)).map(({ file }) => file).sort();
    expect(naming).toEqual(Object.keys(SYSTEM_SPACE_MODULES).sort());
  });
});

describe('Σ — κανένα module του χώρου δεν ρωτά τη συλλογή του ανθρώπου', () => {
  it('🔴 τα modules του χώρου συστήματος δεν αναφέρουν `files` / `files_personal` / `FILE_COLLECTION`', () => {
    const leaking = SOURCES
      .filter(({ file }) => file in SYSTEM_SPACE_MODULES && !DECLARATION_MODULES.has(file))
      .filter(({ text }) => USER_SPACE_COLLECTION.test(text))
      .map(({ file }) => file);
    expect(leaking).toEqual([]);
  });
});

describe('Γ — ο ΕΝΑΣ δείκτης εγγραφής περιεχομένου', () => {
  it('🔴 το `mediaContentFileRef` δείχνει στο `COLLECTIONS.FILES_SYSTEM`, ποτέ στη συλλογή του ανθρώπου', () => {
    const revival = SOURCES.find(({ file }) => file === 'server/catalog/media-content-revival.server.ts');
    expect(revival).toBeDefined();
    expect(revival?.text).toMatch(/mediaContentFileRef[\s\S]{0,200}COLLECTIONS\.FILES_SYSTEM/);
    expect(USER_SPACE_COLLECTION.test(revival?.text ?? '')).toBe(false);
  });
});
