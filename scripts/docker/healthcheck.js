#!/usr/bin/env node
/**
 * ADR-865 §11.12 — ο ΕΝΑΣ healthcheck της εικόνας παραγωγής.
 *
 * Τον καλούν **δύο** κριτές με την **ίδια** εντολή (`PANEL_COMMAND`):
 *   1. το `HEALTHCHECK` του Dockerfile (Docker → Traefik: container «starting» δεν παίρνει κίνηση)·
 *   2. ο Healthcheck του πίνακα του Coolify, τύπου **CMD**. Μόνο αυτός κάνει το rolling update να
 *      **περιμένει** το νέο container πριν σβήσει το παλιό: για εφαρμογή τύπου Docker Image το Coolify
 *      ΔΕΝ διαβάζει το HEALTHCHECK της εικόνας (`custom_healthcheck_found` προκύπτει μόνο από Dockerfile
 *      που χτίζει το ίδιο) ⇒ χωρίς τον πίνακα σβήνει το παλιό 0,6″ μετά την εκκίνηση του νέου —
 *      μετρημένο κενό 16″ (`503 no available server`), 2026-11-05.
 *
 * Γιατί αρχείο και όχι `node -e "…"`: ο πίνακας του Coolify δέχεται μόνο `^[a-zA-Z0-9 \-_.\/:=@,+]+$`
 * (χωρίς εισαγωγικά/παρενθέσεις) — αλλιώς **σιωπηλά** πέφτει σε HTTP check με curl/wget ⇒ 403 από το
 * middleware (`BLOCKED_BOT_PATTERNS`) ⇒ «ανθυγιές» για πάντα.
 *
 * Μηδέν εξαρτήσεις: η εικόνα runtime έχει μόνο το standalone του Next.
 */

'use strict';

const HEALTHCHECK = Object.freeze({
  url: 'http://127.0.0.1:3000/api/health',
  /** Ρητό UA (πρότυπο ADR-740 §9 `nestor-scheduler/1`) — όχι curl/wget/node-fetch. */
  userAgent: 'nestor-healthcheck/1',
  /** < του `--timeout` του Dockerfile και του πίνακα (5″), ώστε να κρίνουμε ΕΜΕΙΣ, όχι ο Docker με SIGKILL. */
  timeoutMs: 4000,
  /** Η διαδρομή του αρχείου μέσα στην εικόνα (`WORKDIR /app`). */
  imagePath: '/app/healthcheck.js',
});

/** Η εντολή που γράφεται στον πίνακα του Coolify και στο HEALTHCHECK του Dockerfile. */
const PANEL_COMMAND = `node ${HEALTHCHECK.imagePath}`;

/** Ο validator του Coolify (`generate_healthcheck_commands`): ό,τι δεν περνά ⇒ σιωπηλή εφεδρεία σε HTTP. */
const COOLIFY_CMD_PATTERN = /^[a-zA-Z0-9 \-_./:=@,+]+$/;
const COOLIFY_CMD_MAX_LENGTH = 1000;

/** @param {string} command */
function isCoolifyCommandAccepted(command) {
  return COOLIFY_CMD_PATTERN.test(command) && command.length <= COOLIFY_CMD_MAX_LENGTH;
}

/**
 * 0 = υγιές (ο server ΑΠΑΝΤΑ 2xx), 1 = όχι. Ποτέ throw: κάθε σφάλμα είναι «όχι ακόμη».
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [deps]
 * @returns {Promise<0|1>}
 */
async function probe({ fetchImpl = fetch, timeoutMs = HEALTHCHECK.timeoutMs } = {}) {
  try {
    const res = await fetchImpl(HEALTHCHECK.url, {
      headers: { 'user-agent': HEALTHCHECK.userAgent },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? 0 : 1;
  } catch {
    return 1;
  }
}

module.exports = { HEALTHCHECK, PANEL_COMMAND, isCoolifyCommandAccepted, probe };

if (require.main === module) {
  probe().then((code) => process.exit(code));
}
