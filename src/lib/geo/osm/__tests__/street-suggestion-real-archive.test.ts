/**
 * @fileoverview 🏆 **«Μήπως εννοείτε…» πάνω σε ΠΡΑΓΜΑΤΙΚΟ λεξικό** — record/replay του δικού μας αρχείου (ADR-950 §8.19).
 *
 * Γιατί υπάρχει: το test του διακομιστή (`evidence-address-verification.test.ts`) ελέγχει το «ΣΑΜΟΓΡΑΦΗΣ ⇒ Σαμοθράκης»
 * με λεξικό **τριών** ονομάτων (mock). Η αληθινή γειτονιά του Τ.Κ. 563 34 έχει **εκατοντάδες** οδούς· μια ισοπαλία με
 * άλλη υπαρκτή οδό στην ίδια απόσταση θα έδινε **σιωπηλά** «καμία πρόταση» στην παραγωγή, ενώ το mock θα έμενε
 * πράσινο. Εδώ το λεξικό είναι **ακριβώς** ό,τι βλέπει ο διακομιστής.
 *
 * Fixtures: το 3×3 μπλοκ z15 γύρω από το σημείο του Τ.Κ. 563 34 (Nominatim: 40.6698541, 22.8928791 — κέντρο
 * `18467/12325`), από το `greece-20260926.pmtiles`, καταγεγραμμένο 2026-11-24, αποσυμπιεσμένο MVT σε gzip.
 * Ίδιο μπλοκ με το `findArchiveStreetNamesNear` (`tileBlock`): το κέντρο ελέγχεται παρακάτω με το ίδιο `archiveTileOf`.
 *
 * | Άγκυρα | Μετάλλαξη που πιάνει |
 * |---|---|
 * | Λ1 το λεξικό της γειτονιάς περιέχει «Σαμοθράκης» | λάθος στρώση / ιδιότητα ονόματος (`name` · `name:el`) |
 * | Λ2 ΣΑΜΟΓΡΑΦΗΣ ⇒ Σαμοθράκης, μοναδικός νικητής | ισοπαλία με πραγματική οδό · χαλαρό/αυστηρό όριο λαθών |
 * | Λ3 Σαμοφράκης (οπτική σύγχυση) ⇒ Σαμοθράκης | χαμένο δίπλωμα τάξεων μορφής |
 * | Λ4 ανύπαρκτο όνομα ⇒ καμία πρόταση | «Μήπως» που μαντεύει ό,τι να 'ναι από μεγάλο λεξικό |
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

import { closestUnderOcrConfusion } from '@/lib/string/ocr-glyph-fold';
import { archiveTileOf, decodeRoadNames, type ArchiveTileAddress } from '../osm-archive-tile';

const Z = 15;
const POSTCODE_56334 = { lat: 40.6698541, lng: 22.8928791 };
const CENTRE: ArchiveTileAddress = { z: Z, x: 18467, y: 12325 };

function blockAround(centre: ArchiveTileAddress): ArchiveTileAddress[] {
  const tiles: ArchiveTileAddress[] = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) tiles.push({ z: centre.z, x: centre.x + dx, y: centre.y + dy });
  }
  return tiles;
}

function namesOf(tile: ArchiveTileAddress): string[] {
  const file = join(__dirname, 'fixtures', `kordelio-z15-${tile.x}-${tile.y}.mvt.gz`);
  return decodeRoadNames(gunzipSync(readFileSync(file)));
}

const dictionary = [...new Set(blockAround(CENTRE).flatMap(namesOf))];

describe('Λ1 — το πραγματικό λεξικό της γειτονιάς του 563 34', () => {
  it('🔑 το σημείο του Τ.Κ. πέφτει στο κεντρικό πλακίδιο των fixtures', () => {
    expect(archiveTileOf(POSTCODE_56334, Z)).toEqual(CENTRE);
  });

  it('🔴 εκατοντάδες υπαρκτές οδοί, ανάμεσά τους η «Σαμοθράκης»', () => {
    expect(dictionary.length).toBeGreaterThan(200);
    expect(dictionary).toContain('Σαμοθράκης');
  });
});

describe('Λ2–Λ4 — «Μήπως εννοείτε…» με ΟΛΟ το λεξικό, όχι με τρία ονόματα', () => {
  it('🔴 ΣΑΜΟΓΡΑΦΗΣ (γράμματα κάτω από την υπογραφή) ⇒ Σαμοθράκης — ζωντανός έλεγχος 2026-11-24', () => {
    expect(closestUnderOcrConfusion('ΣΑΜΟΓΡΑΦΗΣ', dictionary)).toBe('Σαμοθράκης');
  });

  it('🔴 Σαμοφράκης (οπτική σύγχυση Θ↔Φ) ⇒ Σαμοθράκης', () => {
    expect(closestUnderOcrConfusion('Σαμοφράκης', dictionary)).toBe('Σαμοθράκης');
  });

  it('🔑 ανύπαρκτο όνομα ⇒ καμία πρόταση (το μεγάλο λεξικό δεν γίνεται μαντεία)', () => {
    expect(closestUnderOcrConfusion('ΞΥΛΟΦΩΤΟΚΑΝΤΗΛΟΥ', dictionary)).toBeNull();
  });
});
