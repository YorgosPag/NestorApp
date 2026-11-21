/**
 * ADR-865 §11.12.4 — άγκυρες του μηχανισμού «γρήγορο dial + retry» του Traefik.
 * Εκτελούν τη συνάρτηση που παράγει το κείμενο που μπαίνει στον πίνακα του Coolify.
 */

'use strict';

const {
  TRAEFIK_RESILIENCE,
  PROVIDER_REF,
  worstCaseDialMs,
  dynamicConfigYaml,
  parseLabels,
  findGaps,
  applyResilience,
} = require('../docker/traefik-resilience');
const { TIMING } = require('../lib/ci/netcup-release');

/** Σχήμα των Labels που παράγει το Coolify v4 για εφαρμογή με domain + https. */
const COOLIFY_LABELS = [
  'traefik.enable=true',
  'traefik.http.middlewares.gzip.compress=true',
  'traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https',
  'traefik.http.routers.http-0-abc.entryPoints=http',
  'traefik.http.routers.http-0-abc.middlewares=redirect-to-https',
  'traefik.http.routers.http-0-abc.rule=Host(`nestorconstruct.gr`) && PathPrefix(`/`)',
  'traefik.http.routers.http-0-abc.service=http-0-abc',
  'traefik.http.routers.https-0-abc.entryPoints=https',
  'traefik.http.routers.https-0-abc.middlewares=gzip',
  'traefik.http.routers.https-0-abc.rule=Host(`nestorconstruct.gr`) && PathPrefix(`/`)',
  'traefik.http.routers.https-0-abc.service=https-0-abc',
  'traefik.http.routers.https-0-abc.tls.certresolver=letsencrypt',
  'traefik.http.routers.https-0-abc.tls=true',
  'traefik.http.services.http-0-abc.loadbalancer.server.port=3000',
  'traefik.http.services.https-0-abc.loadbalancer.server.port=3000',
  'caddy_0.handle_path.0_reverse_proxy={{upstreams 3000}}',
  '',
].join('\n');

const valueOf = (text, key) => (parseLabels(text).find((l) => l.key === key) || {}).value;

describe('ADR-865 §11.12.4 — προϋπολογισμός χρόνου', () => {
  it('το χειρότερο κόστος (όλες οι προσπάθειες σε νεκρό dial) χωρά ΑΥΣΤΗΡΑ στην υπομονή του πελάτη', () => {
    expect(worstCaseDialMs()).toBeLessThan(TRAEFIK_RESILIENCE.clientPatienceMs);
  });

  it('η υπομονή που κρίνουμε δεν είναι πιο χαλαρή από τον έλεγχο «σερβίρει» της γραμμής (§11.11)', () => {
    expect(TRAEFIK_RESILIENCE.clientPatienceMs).toBeLessThanOrEqual(TIMING.requestTimeoutMs);
  });

  it('dialTimeout ≥ αρχικό RTO του TCP (1″) και πολύ κάτω από την προεπιλογή 30″ του Traefik', () => {
    expect(TRAEFIK_RESILIENCE.dialTimeoutMs).toBeGreaterThanOrEqual(1000);
    expect(TRAEFIK_RESILIENCE.dialTimeoutMs).toBeLessThan(30_000);
  });

  it('τουλάχιστον μία ΕΠΑΝΑΛΗΨΗ (attempts μετρά και την 1η προσπάθεια)', () => {
    expect(TRAEFIK_RESILIENCE.attempts).toBeGreaterThanOrEqual(2);
  });
});

describe('ADR-865 §11.12.4 — αρχείο του file provider', () => {
  const yaml = dynamicConfigYaml();

  it('δηλώνει τον transport που ονομάζουν τα labels, με το dialTimeout του SSoT', () => {
    expect(PROVIDER_REF).toBe(`${TRAEFIK_RESILIENCE.transportName}@file`);
    expect(yaml).toMatch(new RegExp(`^ {4}${TRAEFIK_RESILIENCE.transportName}:$`, 'm'));
    expect(yaml).toMatch(new RegExp(`^ {8}dialTimeout: ${TRAEFIK_RESILIENCE.dialTimeoutMs}ms$`, 'm'));
  });

  it('έχει τη δομή http → serversTransports → forwardingTimeouts', () => {
    expect(yaml).toMatch(/^http:\n {2}serversTransports:\n {4}\S+:\n {6}forwardingTimeouts:\n {8}dialTimeout: /m);
  });
});

describe('ADR-865 §11.12.4 — applyResilience στα Labels του Coolify', () => {
  const applied = applyResilience(COOLIFY_LABELS);

  it('αρνητικός μάρτυρας: τα αρχικά Labels έχουν κενά σε ΚΑΘΕ router και service', () => {
    const gaps = findGaps(COOLIFY_LABELS);
    expect(gaps).toEqual(expect.arrayContaining([
      `router http-0-abc: λείπει ο ${TRAEFIK_RESILIENCE.middlewareName}`,
      `router https-0-abc: λείπει ο ${TRAEFIK_RESILIENCE.middlewareName}`,
      expect.stringContaining('service http-0-abc'),
      expect.stringContaining('service https-0-abc'),
      expect.stringContaining('retry.attempts'),
    ]));
  });

  it('μετά την εφαρμογή: μηδέν κενά', () => {
    expect(findGaps(applied)).toEqual([]);
  });

  it('ο retry μπαίνει ΤΕΛΕΥΤΑΙΟΣ, οι υπάρχοντες middlewares μένουν στη θέση τους', () => {
    expect(valueOf(applied, 'traefik.http.routers.https-0-abc.middlewares')).toBe(`gzip,${TRAEFIK_RESILIENCE.middlewareName}`);
    expect(valueOf(applied, 'traefik.http.routers.http-0-abc.middlewares')).toBe(`redirect-to-https,${TRAEFIK_RESILIENCE.middlewareName}`);
  });

  it('κάθε service ονομάζει τον transport του file provider', () => {
    expect(valueOf(applied, 'traefik.http.services.http-0-abc.loadbalancer.serverstransport')).toBe(PROVIDER_REF);
    expect(valueOf(applied, 'traefik.http.services.https-0-abc.loadbalancer.serverstransport')).toBe(PROVIDER_REF);
  });

  it('ορίζει τον middleware με τα attempts του SSoT', () => {
    expect(valueOf(applied, `traefik.http.middlewares.${TRAEFIK_RESILIENCE.middlewareName}.retry.attempts`)).toBe(String(TRAEFIK_RESILIENCE.attempts));
  });

  it('δεν αγγίζει καμία άλλη γραμμή (rule με backticks, tls, caddy)', () => {
    const before = COOLIFY_LABELS.split('\n').filter((l) => l && !/\.middlewares=/.test(l));
    const after = applied.split('\n');
    for (const line of before) expect(after).toContain(line);
  });

  it('ιδεμπότητο: δεύτερη εφαρμογή = ίδιο κείμενο', () => {
    expect(applyResilience(applied)).toBe(applied);
  });

  it('router χωρίς middlewares αποκτά γραμμή μόνο με τον retry', () => {
    const noMw = COOLIFY_LABELS.replace(/^traefik\.http\.routers\.https-0-abc\.middlewares=.*\n/m, '');
    expect(valueOf(applyResilience(noMw), 'traefik.http.routers.https-0-abc.middlewares')).toBe(TRAEFIK_RESILIENCE.middlewareName);
  });

  it('retry σε μέση θέση μετακινείται στο τέλος (findGaps το καταγγέλλει πριν)', () => {
    const mid = COOLIFY_LABELS.replace('middlewares=gzip', `middlewares=${TRAEFIK_RESILIENCE.middlewareName},gzip`);
    expect(findGaps(mid)).toEqual(expect.arrayContaining([expect.stringContaining('τελευταίος')]));
    expect(valueOf(applyResilience(mid), 'traefik.http.routers.https-0-abc.middlewares')).toBe(`gzip,${TRAEFIK_RESILIENCE.middlewareName}`);
  });

  it('λάθος transport/attempts διορθώνονται, δεν διπλασιάζονται', () => {
    const wrong = `${COOLIFY_LABELS}traefik.http.services.https-0-abc.loadbalancer.serverstransport=other@file\ntraefik.http.middlewares.${TRAEFIK_RESILIENCE.middlewareName}.retry.attempts=9\n`;
    const out = applyResilience(wrong);
    expect(findGaps(out)).toEqual([]);
    expect(out.match(/serverstransport=/g)).toHaveLength(2);
    expect(out.match(/retry\.attempts=/g)).toHaveLength(1);
  });

  it('Labels χωρίς router/service ⇒ ρητό σφάλμα, όχι σιωπηλό «τίποτα»', () => {
    expect(() => applyResilience('traefik.enable=true\n')).toThrow(/router και service/);
    expect(findGaps('')).toEqual(expect.arrayContaining([expect.stringContaining('κανένας router')]));
  });
});
