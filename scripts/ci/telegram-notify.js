#!/usr/bin/env node
'use strict';

/**
 * ADR-757 · ADR-865 §11 — Ειδοποίηση Telegram από βήμα workflow (λεπτό CLI πάνω στο
 * `scripts/lib/ci/telegram.js`).
 *
 * Χρήση:
 *   node scripts/ci/telegram-notify.js --status success --title "NestorApp — Deploy completato"
 *   node scripts/ci/telegram-notify.js --status failure --title "…" --line "…" --line "…"
 *
 * Env: TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID · (προαιρετικά) COMMIT_MESSAGE — μόνο η πρώτη γραμμή.
 * ⚠️ Το μήνυμα του commit φτάνει **ΜΟΝΟ** ως μεταβλητή περιβάλλοντος — ποτέ `${{ }}` μέσα σε
 * `run:` (script injection, GitHub «Security hardening for GitHub Actions»).
 *
 * Έξοδος **πάντα 0**: αποτυχία ειδοποίησης = `::warning::`, ποτέ αποτυχία της γραμμής.
 */

const { composeMessage, sendTelegram, runUrlOf } = require('../lib/ci/telegram');

function parseArgs(argv) {
  const out = { status: 'info', title: '', lines: [] };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === '--status') out.status = value;
    else if (flag === '--title') out.title = value;
    else if (flag === '--line') out.lines.push(value);
  }
  return out;
}

async function main(argv, env = process.env) {
  const args = parseArgs(argv);
  const commit = (env.COMMIT_MESSAGE || '').split('\n')[0].trim();
  const lines = [...(commit ? [`📝 ${commit}`] : []), ...args.lines];
  const text = composeMessage({ status: args.status, title: args.title, lines, link: runUrlOf(env) });
  const { sent, reason } = await sendTelegram(text, { env });
  if (!sent) console.log(`::warning::Telegram — ${reason}`);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

module.exports = { main, parseArgs };
