'use strict';

/**
 * ADR-757 · ADR-865 §11 — Ο **ΕΝΑΣ** αποστολέας Telegram του CI.
 *
 * Πριν ζούσε **inline** (`curl` μέσα στο `docker-build.yml`) — με το μήνυμα του commit
 * παρεμβαλλόμενο **απευθείας** στο script του shell (`echo "${{ … head_commit.message }}"`):
 * script injection κατά τα docs του GitHub («untrusted input»), και μήνυμα με `_`/`*` που
 * έσπαγε το Markdown ⇒ **σιωπηλή** αποτυχία αποστολής. Εδώ: το κείμενο φτάνει ως **μεταβλητή
 * περιβάλλοντος**, και η μορφοποίηση είναι HTML με **διαφυγή**.
 *
 * 🔑 **ΠΟΤΕ δεν ρίχνει τη γραμμή.** Ειδοποίηση που αποτυγχάνει επιστρέφει `{sent:false, reason}`
 * — δεν πετά. Ο αγγελιοφόρος δεν αποφασίζει αν έγινε η ανάπτυξη.
 *
 * Καταναλωτές: `scripts/ci/telegram-notify.js` (βήματα workflow) · `scripts/ci/ci-health-report.js`
 * (μεταβάσεις Tier 1 — πολιτική `alert`, ADR-757).
 */

const API = 'https://api.telegram.org';
/**
 * 2026-11-09: 15″ → 30″. Μετρημένο στο run 42613191252: το «Deploy completato» **έφτασε** στο
 * Telegram, αλλά η απάντηση άργησε >15″ και καταγράφηκε ως αποτυχία (timeout ≠ «δεν στάλθηκε»).
 */
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2_000;

/**
 * Σφάλματα της **φάσης σύνδεσης** (undici `error.cause.code`): το αίτημα **δεν** έφυγε ποτέ, άρα η
 * επανάληψη **δεν** μπορεί να διπλασιάσει μήνυμα. ⚠️ ΟΧΙ timeout ή `ECONNRESET`: εκεί το Telegram μπορεί
 * να το έχει ήδη παραδώσει — επανάληψη = διπλό μήνυμα (ακριβώς η περίπτωση του run 42613191252).
 */
const CONNECT_PHASE_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT',
]);

function isConnectPhaseFailure(error) {
  return CONNECT_PHASE_CODES.has(error?.cause?.code);
}

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const ICON = Object.freeze({ success: '✅', failure: '❌', cancelled: '⚪', skipped: '⚪', info: 'ℹ️' });

const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Ο σύνδεσμος του τρεξίματος, ή `null` εκτός GitHub Actions. */
function runUrlOf(env = process.env) {
  const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: run } = env;
  return server && repo && run ? `${server}/${repo}/actions/runs/${run}` : null;
}

/**
 * @param {{status?:string, title:string, lines?:string[], link?:string|null}} message
 * @returns {string} κείμενο HTML (parse_mode=HTML)
 */
function composeMessage({ status = 'info', title, lines = [], link = null }) {
  const icon = ICON[status] ?? ICON.info;
  const body = lines.filter(Boolean).map(escapeHtml);
  const tail = link ? [`🔗 ${escapeHtml(link)}`] : [];
  return [`${icon} <b>${escapeHtml(title)}</b>`, '', ...body, ...tail].join('\n');
}

/**
 * @returns {Promise<{sent:boolean, reason:string|null}>}
 */
async function postOnce(url, body, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return response.ok ? { sent: true, reason: null } : { sent: false, reason: `Telegram HTTP ${response.status}` };
}

/**
 * Επανάληψη **μόνο** σε αποτυχία σύνδεσης (`isConnectPhaseFailure`), έως `MAX_ATTEMPTS`.
 * @returns {Promise<{sent:boolean, reason:string|null}>}
 */
async function sendTelegram(text, { env = process.env, fetchImpl = fetch, sleep = wait } = {}) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { sent: false, reason: 'λείπουν TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID' };
  const url = `${API}/bot${token}/sendMessage`;
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await postOnce(url, body, fetchImpl);
    } catch (error) {
      if (!isConnectPhaseFailure(error) || attempt >= MAX_ATTEMPTS) {
        return { sent: false, reason: `Telegram: ${error.message} (προσπάθεια ${attempt}/${MAX_ATTEMPTS})` };
      }
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
}

module.exports = { composeMessage, sendTelegram, runUrlOf, escapeHtml, ICON, MAX_ATTEMPTS };
