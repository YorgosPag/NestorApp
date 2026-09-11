#!/usr/bin/env node
'use strict';
/**
 * CHECK 10 — Secret Scan (no credentials in code)
 *
 * JS equivalent of the _check_secret_scan bash function that was previously
 * inlined in the pre-commit hook. Runs as a worker thread in run-checks-parallel.js.
 *
 * Detects:
 *   - API key patterns (sk-*, sk_live_*, AIza*, ghp_*, xoxb-*, AAAA*)
 *   - Hardcoded password/secret/private_key/api_key assignments
 *   - PEM private keys (BEGIN * PRIVATE KEY)
 *
 * Skip list: images, lock files, .env.example, .env.sample, node_modules,
 *   git-hooks/, .github/workflows/, docs/architecture-review/, .gitleaks.toml,
 *   this file itself (its own detection patterns self-match, e.g. PRIVATE_KEY_RE)
 *
 * CLI:
 *   node scripts/check-secret-scan.js file1 file2 ...
 *
 * Exit codes: 0 = clean, 1 = blocked.
 */

const fs   = require('fs');
const path = require('path');

const RED    = '\x1b[0;31m';
const GREEN  = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC     = '\x1b[0m';

// Files to skip entirely
const FILE_SKIP_RE = /(\.(png|jpg|ico|woff|lock)$|\.env\.(example|sample)|node_modules|scripts[\\/]git-hooks[\\/]|\.github[\\/]workflows[\\/]|docs[\\/]architecture-review[\\/]|(^|[\\/])\.gitleaks\.toml$|(^|[\\/])check-secret-scan(\.test)?\.js$)/;

// Line-level patterns
// Το `(^|[^a-zA-Z0-9])` είναι όριο λέξης, όχι χαλάρωση: ένα πραγματικό κλειδί
// αρχίζει πάντα σε όριο (`"sk-…"`, `=sk-…`, αρχή γραμμής), ενώ χωρίς αυτό κάθε
// URL με «…sk-λέξη-λέξη…» έσκαγε ως κλειδί — π.χ. το `autodesk-helped-make-mcp`
// σε παραπομπή ADR. Ψευδώς θετικό blocking check = θόρυβος που εκπαιδεύει στο
// να το προσπερνάς (ADR-738 βιβλιογραφία, 2026-07-31).
const API_KEY_RE     = /(^|[^a-zA-Z0-9])(sk-[a-zA-Z0-9_-]{20,}|sk_live_[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{35}|ghp_[a-zA-Z0-9]{36}|xoxb-[a-zA-Z0-9-]+|AAAA[a-zA-Z0-9_-]{100,})/;
const SECRET_RE      = /(password|secret|private_key|api_key)\s*[:=]\s*['"]([^'"]{8,})['"]/i;
// 🔴 Η ΤΙΜΗ ΚΡΙΝΕΙ, ΟΧΙ ΜΟΝΟ ΤΟ ΟΝΟΜΑ (2026-09-11): το `resetPassword: 'action.titles.resetPassword'`
// είναι κλειδί i18n, όχι κωδικός — και μπλόκαρε το ADR-850. Κλειδί = διαδρομή αναγνωριστικών με
// τελείες, ΚΑΘΕ τμήμα ξεκινά με γράμμα, χωρίς κενά. Το όνομα ΔΕΝ χαλαρώνει (το `adminPassword:
// '…'` πιάνεται ακόμη)· ούτε το `summer.2024` περνά (τμήμα που ξεκινά με ψηφίο). Ίδια λογική με
// τα allowlists τιμών του gitleaks.
const I18N_KEY_VALUE_RE = /^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const PRIVATE_KEY_RE = /BEGIN.*PRIVATE KEY/;
const COMMENT_RE     = /^\s*(\/\/|\*|#)/;
const ENV_SKIP_RE    = /(\.env|process\.env|example|placeholder|schema|type|interface|dummy|test|mock)/i;

function scanFile(filePath) {
  const violations = [];
  if (!fs.existsSync(filePath)) return violations;

  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); } catch { return violations; }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length && violations.length < 3; i++) {
    const line = lines[i];
    if (COMMENT_RE.test(line)) continue;

    const secret = line.match(SECRET_RE);
    if (API_KEY_RE.test(line)) {
      violations.push(`  ❌ API key pattern in ${filePath}\n     ${i + 1}: ${line.trim().substring(0, 100)}`);
    } else if (secret && !ENV_SKIP_RE.test(line) && !I18N_KEY_VALUE_RE.test(secret[2])) {
      violations.push(`  ❌ Hardcoded secret in ${filePath}\n     ${i + 1}: ${line.trim().substring(0, 100)}`);
    } else if (PRIVATE_KEY_RE.test(line)) {
      violations.push(`  ❌ Private key in ${filePath}`);
    }
  }

  return violations;
}

function main(files) {
  const allViolations = [];
  for (const file of files) {
    if (!file || FILE_SKIP_RE.test(file.replace(/\\/g, '/'))) continue;
    allViolations.push(...scanFile(file));
  }

  if (allViolations.length === 0) {
    console.log(`${GREEN}  ✅ Secret scan: clean${NC}`);
    return 0;
  }

  console.log('');
  console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}`);
  console.log(`${RED}  🚫 COMMIT BLOCKED — Potential secrets detected${NC}`);
  console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}`);
  console.log('');
  for (const v of allViolations) console.log(v);
  console.log('');
  console.log(`${YELLOW}  Move secrets to .env files or environment variables.${NC}`);
  console.log(`${YELLOW}  If false positive, add to .gitignore or refactor.${NC}`);
  console.log('');
  return 1;
}

module.exports = { scanFile };

if (require.main === module) process.exit(main(process.argv.slice(2).filter(Boolean)));
