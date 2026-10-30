#!/usr/bin/env node
/**
 * =============================================================================
 * ENTERPRISE: Missing i18n Keys — Pre-commit Check
 * =============================================================================
 * Verifies that all t('key') calls in staged .ts/.tsx files reference keys
 * that actually exist in the corresponding locale JSON file.
 *
 * LOGIC:
 *   1. Find useTranslation('namespace') → determines which JSON to check
 *   2. Find all t('key') / t('key', ...) calls
 *   3. Check if key exists in src/i18n/locales/el/{namespace}.json
 *   4. Report missing keys — BLOCK commit if any found in staged files
 *
 * SKIPS:
 *   - Dynamic keys: t(variable), t(`template`), t(condition ? 'a' : 'b')
 *   - Cross-namespace: t('ns:key') — explicit namespace override (valid)
 *   - Test files, config files, scripts
 *
 * BASELINE: .i18n-missing-keys-baseline.json (ratchet pattern)
 *
 * Usage: node scripts/check-i18n-missing-keys.js file1.tsx file2.ts ...
 * =============================================================================
 */
const path = require('path');
const extract = require('./lib/i18n-namespace-extract');
const { judgeAgainstBaseline, collectMissingKeys, makeDeps } = require('./lib/i18n-missing-keys-ratchet');
const { commitInput } = require('./lib/gate-input');

const REPO_ROOT = path.join(__dirname, '..');
const BASELINE_FILE = '.i18n-missing-keys-baseline.json';

// Resolve shared namespace bundles (e.g. COMMON_NAMESPACES) once, so
// useTranslation(<CONST>) call sites are checked, not silently skipped.

// ADR-280 compat splits: the runtime hook loads `declared + splits` and searches
// the key in ALL of them (useTranslation.ts → resolveAllNamespaces /
// resolveAcrossNamespaces). This gate must ask the SAME question, or it reports
// "missing" for keys the app resolves — and the only way to satisfy it would be to
// COPY the keys back into the parent namespace, undoing the ADR-280 split. See
// scripts/lib/i18n-namespace-extract.js → loadCompatNamespaces (ADR-744 §12).

// Colors
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

// `extractTCalls` moved to ./lib/i18n-namespace-extract (ADR-744) so the
// shell-slice generator can share it instead of cloning it. Behaviour unchanged.

/**
 * Get line number from character index
 */
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

/** Η baseline από την ΕΙΣΟΔΟ — λείπει ή χαλασμένη ⇒ `{}`. */
function loadBaseline(input) {
  const text = input.read(BASELINE_FILE);
  if (text === null) return {};
  try {
    return JSON.parse(text).files || {};
  } catch {
    return {};
  }
}

/** Αρχείο που κρίνει η πύλη: `.ts`/`.tsx` εκτός tests, scripts, config. */
const inScope = (file) => /\.(ts|tsx)$/.test(file)
  && !/(__tests__|\.test\.|\.spec\.|\.stories\.|scripts\/|\.config\.)/.test(file);

/** Τα λείποντα κλειδιά ενός αρχείου (με γραμμή) — `null` ⇒ δεν κρίνεται. */
function missingKeysOf(content, deps) {
  // MIA MHXANH gia tin pyli KAI ti baseline (ADR-777 8.41). Dyo klhseis ths idias
  // metrisis apeklinan gia mines: 114 enanti 6 sto idio dentro.
  const found = collectMissingKeys(content, deps);
  if (!found) return null;
  return {
    namespaces: found.namespaces,
    missingKeys: found.missingKeys.map(k => ({ key: k.key, bucket: k.bucket, line: getLineNumber(content, k.index) })),
  };
}

/** Η κρίση ενός αρχείου έναντι της baseline· τυπώνει μείωση ή μπλοκάρισμα. Επιστρέφει αν μπλοκάρει. */
function judgeFile(file, found, baseline) {
  const { namespaces, missingKeys } = found;
  const normalizedFile = file.replace(/\\/g, '/');
  // KEY - DYO KADOI, OXI ENAS ARITHMOS (ADR-777 8.41). Me ena athroisma i **antallagi**
  // perna athoryva: diorthoneis ena sketo kleidi, prostheteis ena rito `ns:key`, to
  // synolo den kounietai - kai to rito ksanaginetai AORATO, dhladi akrivws i vlavi pou
  // afti i epektasi yparxei gia na kleisei (dogma ADR-749: taftotita, oxi plithos).
  // Dexetai kai to PALIO sxima (sketos arithmos): tote o arithmos einai to epitrepomeno
  // ton **sketon**, kai ta rita ksekinoun apo MIDENIKI anoxi.
  const verdict = judgeAgainstBaseline(missingKeys, baseline[normalizedFile] || 0);
  const baselineCount = verdict.allow.bare + verdict.allow.explicit;
  const currentCount = missingKeys.length;

  if (!verdict.blocked) {
    // Same or improved — allow
    if (currentCount < baselineCount) {
      console.log(`${GREEN}  📉 ${normalizedFile}: ${baselineCount} → ${currentCount} (-${baselineCount - currentCount})${NC}`);
    }
    return false;
  }

  // New or increased violations — BLOCK
  console.log(`${RED}  🚫 ${normalizedFile}: ${verdict.overflow.length} new missing i18n key(s)${NC}`);
  // Deixe ta kleidia TOU KADOU pou palindromise - to sketo `slice(-newCount)` edeixne
  // opoiadipote teleftaia, dhladi mporouse na onomasei kleidi pou DEN eftaie.
  for (const { key, line, bucket } of verdict.overflow) {
    // To rito `ns:key` elegxthike se ENA namespace - afto pou ONOMAZEI. Anafora
    // pou apari8mei ta DILOMENA tha estelne ton anagnosti na psaxei se la8os arxeio.
    const nsNames = bucket === 'explicit' ? key.split(':')[0] : namespaces.join(', ');
    console.log(`${YELLOW}     Line ${line}: t('${key}') — not found in [${nsNames}] locale${NC}`);
  }
  return true;
}

/**
 * `files` = τα σταδιοποιημένα (ορίσματα). `input` = η είσοδος (ADR-924): με `--index` (εκτελεστής) τα αρχεία,
 * τα locale, τα bundles και η baseline ΤΟΥ COMMIT, όχι του δίσκου.
 */
function run(files, input = commitInput(REPO_ROOT)) {
  const deps = makeDeps(REPO_ROOT, extract, input);
  const baseline = loadBaseline(input);
  let hasBlock = false;
  for (const file of files) {
    if (!inScope(file) || !input.exists(file)) continue;
    const found = missingKeysOf(input.read(file), deps);
    if (!found || found.missingKeys.length === 0) continue;
    if (judgeFile(file, found, baseline)) hasBlock = true;
  }

  if (hasBlock) {
    console.log(`${RED}  ❌ Missing i18n keys check FAILED — add keys to locale JSON files${NC}`);
    return 1;
  }

  console.log(`${GREEN}  ✅ i18n keys: all t() calls have matching locale entries${NC}`);
  return 0;
}

if (require.main === module) process.exit(run(process.argv.slice(2).filter(a => !a.startsWith('--'))));

module.exports = { run };
