#!/usr/bin/env node
/**
 * simulate-partner-repaint — ADR-683: προσομοίωση «τέλειου συνεργάτη» για δοκιμή του round-trip.
 *
 * ## Γιατί υπάρχει
 *
 * Το round-trip του ADR-683 (στέλνω .glb → ο συνεργάτης βάφει → γυρίζει → ταιριάζει με τα
 * υπάρχοντα στοιχεία) **δεν είχε δοκιμαστεί ποτέ ολόκληρο**. Η πρώτη προσπάθεια (Ζωγραφική 3D,
 * 2026-07-20) απέτυχε πριν καν αρχίσει: το εργαλείο ξαναέγραψε τα ονόματα κόμβων σε `node_idN`,
 * καταστρέφοντας το κανάλι ταυτότητας (`<Όροφος>_<Κατηγορία>_<bimId>`, βλ. `gltf-scene-parse.ts`).
 * Αποτέλεσμα: μηδέν αντιστοιχίσεις, όλα μπήκαν ως «νέα γεωμετρία».
 *
 * Αυτό το script κάνει το ελάχιστο που κάνει ένας συνεργάτης — **αλλάζει ένα χρώμα υλικού** — και
 * **τίποτα άλλο**. Δεν φορτώνει τη γεωμετρία, δεν την ξαναεξάγει: επεμβαίνει μόνο στο JSON chunk
 * του GLB και αντιγράφει το BIN chunk **αυτούσιο, byte-προς-byte**. Άρα ονόματα, ιεραρχία,
 * κορυφές και μετασχηματισμοί επιβιώνουν κατά κατασκευή — όχι κατά τύχη.
 *
 * Έτσι, αν το matching αποτύχει με ΑΥΤΟ το αρχείο, το σφάλμα είναι **δικό μας**, όχι του εργαλείου.
 *
 * ## Χρήση
 *
 *   # 1) Επιθεώρηση — τι ονόματα/υλικά περιέχει (ΠΑΝΤΑ τρέξε πρώτα αυτό)
 *   node scripts/simulate-partner-repaint.js "C:\\path\\Ισόγειο.glb"
 *
 *   # 2) Βάψιμο — άλλαξε ένα υλικό και γράψε νέο αρχείο
 *   node scripts/simulate-partner-repaint.js "…\\Ισόγειο.glb" --material 0 --color "#2244AA"
 *   node scripts/simulate-partner-repaint.js "…\\Ισόγειο.glb" --material "Σοβάς" --color "#2244AA" --out "…\\Ισόγειο-βαμμένο.glb"
 *
 * Μηδέν εξαρτήσεις — μόνο Node built-ins.
 *
 * @see src/subapps/dxf-viewer/io/mesh3d-roundtrip/gltf-scene-parse.ts — ο καταναλωτής των ονομάτων
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md
 */

'use strict';

const fs = require('fs');
const path = require('path');

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'

// ─── GLB container ────────────────────────────────────────────────────────────

/** Σπάει ένα GLB σε {json, bin}. Το `bin` επιστρέφεται αυτούσιο — δεν το αγγίζουμε ποτέ. */
function readGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 12 || buf.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error(`Δεν είναι έγκυρο GLB: ${filePath}`);
  }
  const total = buf.readUInt32LE(8);
  let offset = 12;
  let json = null;
  let bin = null;

  while (offset + 8 <= Math.min(total, buf.length)) {
    const len = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === CHUNK_JSON) json = JSON.parse(data.toString('utf8'));
    else if (type === CHUNK_BIN) bin = data;
    offset += 8 + len;
  }

  if (!json) throw new Error('Το GLB δεν έχει JSON chunk.');
  return { json, bin };
}

/** Ξαναχτίζει GLB. Το JSON γεμίζει με κενά, το BIN με μηδενικά — όπως ορίζει η προδιαγραφή. */
function writeGlb(filePath, json, bin) {
  const jsonRaw = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = (4 - (jsonRaw.length % 4)) % 4;
  const jsonBuf = Buffer.concat([jsonRaw, Buffer.alloc(jsonPad, 0x20)]);

  const parts = [];
  const binBuf = bin ? padTo4(bin, 0x00) : null;
  const total = 12 + 8 + jsonBuf.length + (binBuf ? 8 + binBuf.length : 0);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  parts.push(header, chunkHeader(jsonBuf.length, CHUNK_JSON), jsonBuf);
  if (binBuf) parts.push(chunkHeader(binBuf.length, CHUNK_BIN), binBuf);

  fs.writeFileSync(filePath, Buffer.concat(parts));
  return total;
}

function padTo4(buf, fill) {
  const pad = (4 - (buf.length % 4)) % 4;
  return pad === 0 ? buf : Buffer.concat([buf, Buffer.alloc(pad, fill)]);
}

function chunkHeader(length, type) {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(length, 0);
  h.writeUInt32LE(type, 4);
  return h;
}

// ─── Χρώμα ────────────────────────────────────────────────────────────────────

/**
 * sRGB hex → linear. Το glTF αποθηκεύει το `baseColorFactor` σε **γραμμικό** χώρο· περνώντας
 * ωμές τιμές sRGB το χρώμα βγαίνει ορατά πιο ανοιχτό απ' ό,τι διάλεξες.
 */
function hexToLinearRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Άκυρο χρώμα «${hex}» — περίμενα μορφή #RRGGBB.`);
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
}

// ─── Επιθεώρηση ───────────────────────────────────────────────────────────────

/**
 * Το κανάλι ταυτότητας του ADR-678 §2: `[HIDDEN_]<Όροφος>_<Κατηγορία>_<bimId>`. Αν ένα όνομα δεν
 * ταιριάζει, ο importer δεν θα βρει bimId και ο κόμβος θα μπει ως **νέα γεωμετρία**.
 */
function looksLikeIdentityName(name) {
  if (typeof name !== 'string') return false;
  const parts = name.replace(/^HIDDEN_/, '').split('_');
  return parts.length >= 3 && parts[parts.length - 1].length >= 6;
}

function inspect(json) {
  const nodes = json.nodes || [];
  const materials = json.materials || [];

  console.log(`\n📦 Κόμβοι: ${nodes.length}   Πλέγματα: ${(json.meshes || []).length}   Υλικά: ${materials.length}`);

  console.log('\n── ΟΝΟΜΑΤΑ ΚΟΜΒΩΝ (το κανάλι ταυτότητας) ──');
  let ok = 0;
  nodes.forEach((node, i) => {
    const name = node.name === undefined ? '(χωρίς όνομα)' : node.name;
    const good = looksLikeIdentityName(node.name);
    if (good) ok += 1;
    console.log(`  ${good ? '✅' : '❌'} [${i}] ${name}`);
  });
  console.log(`\n  → ${ok}/${nodes.length} κόμβοι φέρουν αναγνωρίσιμη ταυτότητα.`);
  if (ok === 0 && nodes.length > 0) {
    console.log('  ⚠️  ΚΑΝΕΝΑΣ κόμβος δεν έχει ταυτότητα — το matching θα αποτύχει ΟΛΟΚΛΗΡΩΤΙΚΑ.');
  }

  console.log('\n── ΥΛΙΚΑ (διάλεξε ένα με --material <index|όνομα>) ──');
  materials.forEach((mat, i) => {
    const base = (mat.pbrMetallicRoughness || {}).baseColorFactor;
    const shown = base ? `rgba(${base.map((v) => v.toFixed(3)).join(', ')})` : '(χωρίς baseColorFactor)';
    console.log(`  [${i}] ${mat.name || '(χωρίς όνομα)'} — ${shown}`);
  });
  console.log('');
}

// ─── Βάψιμο ───────────────────────────────────────────────────────────────────

function resolveMaterialIndex(materials, selector) {
  const asIndex = Number(selector);
  if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < materials.length) return asIndex;
  const byName = materials.findIndex((m) => m.name === selector);
  if (byName >= 0) return byName;
  const loose = materials.findIndex(
    (m) => typeof m.name === 'string' && m.name.toLowerCase().includes(String(selector).toLowerCase()),
  );
  if (loose >= 0) return loose;
  throw new Error(`Δεν βρέθηκε υλικό «${selector}». Τρέξε χωρίς --material για να δεις τη λίστα.`);
}

function repaint(json, selector, hex) {
  const materials = json.materials || [];
  if (materials.length === 0) throw new Error('Το αρχείο δεν έχει καθόλου υλικά.');

  const index = resolveMaterialIndex(materials, selector);
  const material = materials[index];
  const pbr = material.pbrMetallicRoughness || (material.pbrMetallicRoughness = {});
  const before = pbr.baseColorFactor ? [...pbr.baseColorFactor] : null;
  const alpha = before && before.length === 4 ? before[3] : 1;

  pbr.baseColorFactor = [...hexToLinearRgb(hex), alpha];

  console.log(`\n🎨 Υλικό [${index}] «${material.name || '(χωρίς όνομα)'}»`);
  console.log(`   πριν:  ${before ? before.map((v) => v.toFixed(3)).join(', ') : '(κανένα)'}`);
  console.log(`   μετά:  ${pbr.baseColorFactor.map((v) => v.toFixed(3)).join(', ')}   (${hex})`);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { input: null, material: null, color: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--material') args.material = argv[++i];
    else if (token === '--color') args.color = argv[++i];
    else if (token === '--out') args.out = argv[++i];
    else if (!args.input) args.input = token;
  }
  return args;
}

function defaultOutPath(input) {
  const dir = path.dirname(input);
  const ext = path.extname(input);
  return path.join(dir, `${path.basename(input, ext)}-βαμμένο${ext}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('Χρήση: node scripts/simulate-partner-repaint.js "<αρχείο.glb>" [--material <i|όνομα>] [--color "#RRGGBB"] [--out <αρχείο.glb>]');
    process.exit(1);
  }

  const { json, bin } = readGlb(args.input);
  console.log(`\n📄 ${args.input}`);
  inspect(json);

  if (args.material === null && args.color === null) {
    console.log('ℹ️  Μόνο επιθεώρηση. Πρόσθεσε --material και --color για να γράψω νέο αρχείο.\n');
    return;
  }
  if (args.material === null || args.color === null) {
    throw new Error('Χρειάζονται ΚΑΙ τα δύο: --material και --color.');
  }

  repaint(json, args.material, args.color);
  const out = args.out || defaultOutPath(args.input);
  const bytes = writeGlb(out, json, bin);
  console.log(`\n💾 Γράφτηκε: ${out}  (${(bytes / 1024).toFixed(1)} KB)`);
  console.log('   Ονόματα κόμβων + γεωμετρία: ΑΝΕΓΓΙΧΤΑ.\n');
}

try {
  main();
} catch (error) {
  console.error(`\n❌ ${error.message}\n`);
  process.exit(1);
}
