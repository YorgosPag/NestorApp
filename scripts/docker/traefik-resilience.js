#!/usr/bin/env node
/**
 * ADR-865 §11.12.4 — η ΜΙΑ πηγή για το «αίτημα που χάνεται» κατά το rolling update.
 *
 * Μέτρηση 2 (§11.12.3): 419 OK / 1 χαμένο. Το χαμένο αίτημα έφυγε ≈1,9″ ΜΕΤΑ τη διαγραφή του παλιού
 * container: ο docker provider του Traefik μαθαίνει τον θάνατο με καθυστέρηση (throttle γεγονότων ~2″)
 * ⇒ ως τότε η ισοκατανομή (WRR) κρατά τη διεύθυνση του νεκρού ⇒ το dial **κρέμεται** (η IP δεν υπάρχει
 * πια: κανείς δεν απαντά, ούτε με άρνηση) ως το `dialTimeout`, που εξ ορισμού είναι **30″**.
 *
 * Δύο κομμάτια, και χρειάζονται ΚΑΙ ΤΑ ΔΥΟ (μετρημένο στον κώδικα του Traefik v3.0–v3.7):
 *   1. `serversTransport` με σύντομο `dialTimeout` — το κρεμασμένο dial γίνεται **γρήγορη** αποτυχία.
 *      Δεν δηλώνεται με labels (`ServersTransports … label:"-"`): ζει στον file provider του proxy του
 *      Coolify (`/traefik/dynamic/`, watch) και τα labels του service απλώς τον **ονομάζουν** (`…@file`).
 *   2. `retry` middleware — επαναλαμβάνει **μόνο** αν το αίτημα ΔΕΝ γράφτηκε στον backend
 *      (`proxyReached && !wroteRequest`) ⇒ ασφαλές και για POST: ο backend δεν το είδε ποτέ. Κάθε
 *      προσπάθεια ξανακαλεί την ισοκατανομή ⇒ ο WRR (EDF) δίνει τον **άλλο** server, δηλαδή το νέο.
 *   Χωρίς το (1), το (2) θα επαναλάμβανε μετά από 30″. Χωρίς το (2), το (1) θα έδινε γρήγορο 502.
 *
 * ❌ Απορρίφθηκε ο παθητικός έλεγχος υγείας (v3.6+): μετρά ως αποτυχία και κάθε **5xx της εφαρμογής**·
 *    με ΕΝΑ container σε μόνιμη λειτουργία, ένα 500 θα έβγαζε εκτός ΟΛΟ τον ιστότοπο (`503 no available
 *    server`) για όλο το `failureWindow`. Μετατρέπει ένα σφάλμα σελίδας σε διακοπή.
 *
 * Μηδέν εξαρτήσεις. CLI: `node scripts/docker/traefik-resilience.js <αρχείο με τα Labels του Coolify>`.
 */

'use strict';

const TRAEFIK_RESILIENCE = Object.freeze({
  transportName: 'nestor-fast-dial',
  /** Όνομα του αρχείου στο Coolify → Servers → Proxy → Dynamic Configurations. */
  dynamicConfigFile: 'nestor-fast-dial.yaml',
  /**
   * Dial μέσα στο ίδιο docker bridge = κλάσμα του ms. 1″ = το αρχικό RTO του TCP: ένα SYN που χάθηκε
   * θα ξαναστελνόταν ούτως ή άλλως τότε, άρα κάτω από 1″ κόβουμε υγιή dial υπό φορτίο.
   */
  dialTimeoutMs: 1000,
  middlewareName: 'nestor-retry',
  /** Συνολικές προσπάθειες (η 1η μετρά): νεκρός → νέος, +1 αν ταυτόχρονο αίτημα «έφαγε» τη σειρά του WRR. */
  attempts: 3,
  /**
   * Η υπομονή του πελάτη που κρίνουμε: ο βρόχος μέτρησης του §11.12 κόβει στα 5″. Το χειρότερο κόστος
   * του retry (όλες οι προσπάθειες σε νεκρό dial) πρέπει να χωρά ΑΥΣΤΗΡΑ μέσα.
   */
  clientPatienceMs: 5000,
});

const PROVIDER_REF = `${TRAEFIK_RESILIENCE.transportName}@file`;

/** Χειρότερη επιπλέον καθυστέρηση που προσθέτει ο μηχανισμός σε ένα αίτημα. */
function worstCaseDialMs({ attempts, dialTimeoutMs } = TRAEFIK_RESILIENCE) {
  return attempts * dialTimeoutMs;
}

/** Το περιεχόμενο του αρχείου του file provider (YAML — το Traefik δέχεται Go duration). */
function dynamicConfigYaml() {
  const { transportName, dialTimeoutMs } = TRAEFIK_RESILIENCE;
  return [
    '# ADR-865 §11.12.4 — παράγεται από scripts/docker/traefik-resilience.js· ΜΗΝ το αλλάζεις με το χέρι.',
    'http:',
    '  serversTransports:',
    `    ${transportName}:`,
    '      forwardingTimeouts:',
    `        dialTimeout: ${dialTimeoutMs}ms`,
    '',
  ].join('\n');
}

const ROUTER_KEY = /^traefik\.http\.routers\.([^.=\s]+)\.(rule|middlewares)$/i;
const SERVICE_KEY = /^traefik\.http\.services\.([^.=\s]+)\.loadbalancer\.(server\.port|serverstransport)$/i;

/**
 * Οι γραμμές του πεδίου Labels του Coolify (μία `κλειδί=τιμή` ανά γραμμή· κενές/σχόλια μένουν ως έχουν).
 * @param {string} text
 */
function parseLabels(text) {
  return text.split(/\r?\n/).map((raw) => {
    const at = raw.indexOf('=');
    if (at <= 0 || raw.trimStart().startsWith('#')) return { raw };
    return { raw, key: raw.slice(0, at).trim(), value: raw.slice(at + 1).trim() };
  });
}

/** @param {ReturnType<typeof parseLabels>} lines */
function collectTargets(lines) {
  const routers = new Map();
  const services = new Map();
  for (const line of lines) {
    if (!line.key) continue;
    const r = ROUTER_KEY.exec(line.key);
    if (r) routers.set(r[1], { ...(routers.get(r[1]) || {}), [r[2].toLowerCase()]: line });
    const s = SERVICE_KEY.exec(line.key);
    if (s) services.set(s[1], { ...(services.get(s[1]) || {}), [s[2].toLowerCase()]: line });
  }
  return { routers, services };
}

/** @param {string | undefined} value */
function splitList(value) {
  return (value || '').split(',').map((v) => v.trim()).filter(Boolean);
}

/**
 * Τι λείπει από ένα σύνολο Labels ώστε να ισχύει ο μηχανισμός. Κενός πίνακας = πλήρες.
 * @param {string} text
 * @returns {string[]}
 */
function findGaps(text) {
  const lines = parseLabels(text);
  const { routers, services } = collectTargets(lines);
  const { middlewareName, attempts } = TRAEFIK_RESILIENCE;
  const gaps = [];
  if (routers.size === 0) gaps.push('κανένας router (traefik.http.routers.*.rule)');
  if (services.size === 0) gaps.push('κανένα service (traefik.http.services.*.loadbalancer.server.port)');
  for (const [name, r] of routers) {
    const list = splitList(r.middlewares && r.middlewares.value);
    if (!list.includes(middlewareName)) gaps.push(`router ${name}: λείπει ο ${middlewareName}`);
    else if (list[list.length - 1] !== middlewareName) gaps.push(`router ${name}: ο ${middlewareName} πρέπει να είναι τελευταίος`);
  }
  for (const [name, s] of services) {
    if (!s.serverstransport || s.serverstransport.value !== PROVIDER_REF) gaps.push(`service ${name}: λείπει serverstransport=${PROVIDER_REF}`);
  }
  const def = lines.find((l) => l.key && l.key.toLowerCase() === `traefik.http.middlewares.${middlewareName}.retry.attempts`);
  if (!def || def.value !== String(attempts)) gaps.push(`ορισμός ${middlewareName}.retry.attempts=${attempts}`);
  return gaps;
}

/**
 * Προσθέτει τον μηχανισμό σε Labels του Coolify. Ιδεμπότητο: δεύτερη εφαρμογή = ίδιο κείμενο.
 * Ο retry μπαίνει ΤΕΛΕΥΤΑΙΟΣ σε κάθε router: ό,τι είναι πριν (π.χ. gzip) τρέχει μία φορά, μόνο το
 * «προς τον server» επαναλαμβάνεται.
 * @param {string} text
 * @returns {string}
 */
function applyResilience(text) {
  const lines = parseLabels(text);
  const { routers, services } = collectTargets(lines);
  if (routers.size === 0 || services.size === 0) {
    throw new Error('Τα Labels δεν έχουν router και service του Traefik — λάθος επικόλληση;');
  }
  const { middlewareName, attempts } = TRAEFIK_RESILIENCE;
  const out = lines.map((l) => l.raw);
  const append = [];

  for (const [name, r] of routers) {
    if (r.middlewares) {
      const list = splitList(r.middlewares.value).filter((m) => m !== middlewareName);
      const key = r.middlewares.key;
      out[lines.indexOf(r.middlewares)] = `${key}=${[...list, middlewareName].join(',')}`;
    } else {
      append.push(`traefik.http.routers.${name}.middlewares=${middlewareName}`);
    }
  }
  for (const [name, s] of services) {
    const line = `traefik.http.services.${name}.loadbalancer.serverstransport=${PROVIDER_REF}`;
    if (s.serverstransport) out[lines.indexOf(s.serverstransport)] = line;
    else append.push(line);
  }
  const defKey = `traefik.http.middlewares.${middlewareName}.retry.attempts`;
  const defAt = lines.findIndex((l) => l.key && l.key.toLowerCase() === defKey);
  if (defAt >= 0) out[defAt] = `${defKey}=${attempts}`;
  else append.push(`${defKey}=${attempts}`);

  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  return [...out, ...append].join('\n');
}

module.exports = {
  TRAEFIK_RESILIENCE,
  PROVIDER_REF,
  worstCaseDialMs,
  dynamicConfigYaml,
  parseLabels,
  findGaps,
  applyResilience,
};

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write('Χρήση: node scripts/docker/traefik-resilience.js <αρχείο με τα Labels του Coolify>\n');
    process.exit(2);
  }
  const labels = applyResilience(require('fs').readFileSync(file, 'utf8'));
  const gaps = findGaps(labels);
  if (gaps.length > 0) {
    process.stderr.write(`Κενά μετά την εφαρμογή:\n- ${gaps.join('\n- ')}\n`);
    process.exit(1);
  }
  process.stdout.write(`===== Labels (Configuration → General → Labels) =====\n${labels}\n\n`);
  process.stdout.write(`===== ${TRAEFIK_RESILIENCE.dynamicConfigFile} (Servers → Proxy → Dynamic Configurations) =====\n${dynamicConfigYaml()}`);
}
