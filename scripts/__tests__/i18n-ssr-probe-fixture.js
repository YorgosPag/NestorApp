'use strict';
/**
 * =============================================================================
 * CHECK 3.51 Χ — Ο ΚΟΙΝΟΣ FIXTURE SERVER ΤΩΝ ΑΓΚΥΡΩΝ ΤΟΥ ΧΡΗΣΜΟΥ
 * =============================================================================
 *
 * ⚠️ **ΔΕΝ ΕΙΝΑΙ ΑΡΧΕΙΟ TEST** — και το όνομα είναι **συμβόλαιο, όχι γούστο**:
 * χωρίς κατάληξη `.test.`/`.spec.` (α) το jest **δεν** το ιδιοκτητεί ως σουίτα
 * (θα απέτυχε με «Your test suite must contain at least one test»), και (β) δεν
 * μπαίνει καν στο σύμπαν του CHECK 3.47, που κρίνει **μόνο** το όνομα αρχείου
 * (`scripts/lib/jest-partition/census.js`).
 *
 * 🔑 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: το ίδιο `http.createServer` ήταν γραμμένο **τρεις φορές**
 * (`i18n-ssr-backend-contract.test.js`, και **δύο** φορές μέσα στο
 * `check-i18n-ssr-oracle.test.js` ως `serving` + `servingWith`). Ένα τέταρτο
 * αντίγραφο για τις άγκυρες της ανακατεύθυνσης θα ήταν ακριβώς το sibling clone
 * που απαγορεύει ο N.18. ⚠️ Το `jscpd` **δεν** θα το είχε πιάσει — σαρώνει μόνο
 * `src/`, και στα δύο του στρώματα. Η εξαγωγή γίνεται γιατί είναι **σωστή**, όχι
 * επειδή την επέβαλε πύλη.
 *
 * ⚠️ Κάθε καταναλωτής πρέπει να δηλώνει `@jest-environment node`: στο jsdom το
 * `fetch` αποτυγχάνει και ο χρησμός πέφτει σε `route-unreachable` **για λάθος
 * λόγο** — τεκμηριωμένο ψευδώς-πράσινο.
 * =============================================================================
 */

const http = require('node:http');

/**
 * Σηκώνει εφήμερο server, τον δίνει στο `fn` ως `baseUrl`, και τον κλείνει
 * **πάντα** — ακόμη κι αν το `fn` πετάξει.
 *
 * @param {(request: http.IncomingMessage, response: http.ServerResponse) => void} handler
 * @param {(baseUrl: string) => Promise<unknown>} fn
 */
async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

/** Ο server απαντά **πάντα** το ίδιο: ένας κωδικός, ένα σώμα. */
async function serving(status, html, fn) {
  return withServer((_request, response) => {
    response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  }, fn);
}

/**
 * Server **πολλών διαδρομών**, με **μάρτυρα**: κάθε διεύθυνση που ζητήθηκε
 * καταγράφεται στο `requested`.
 *
 * 🔑 Ο μάρτυρας είναι ο λόγος ύπαρξης αυτής της συνάρτησης. Η ερώτηση «ακολούθησε
 * ο χρησμός την ανακατεύθυνση;» απαντιέται **οριστικά** μόνο από **γεγονός
 * δικτύου** — «ζητήθηκε ποτέ ο προορισμός;» — και **ποτέ** από το πόρισμα, που
 * εξαρτάται από όλη τη λογική ταξινόμησης κατάντη.
 *
 * @param {Record<string, {status: number, headers?: Record<string,string>, body?: string}>} routes
 * @param {(baseUrl: string, requested: string[]) => Promise<unknown>} fn
 */
async function servingRoutes(routes, fn) {
  const requested = [];
  return withServer((request, response) => {
    requested.push(request.url);
    const answer = routes[request.url];
    if (!answer) {
      response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      response.end('');
      return;
    }
    response.writeHead(answer.status, {
      'content-type': 'text/html; charset=utf-8',
      ...(answer.headers || {}),
    });
    response.end(answer.body || '');
  }, (baseUrl) => fn(baseUrl, requested));
}

module.exports = { withServer, serving, servingRoutes };
