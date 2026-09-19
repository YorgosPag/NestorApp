'use strict';

/**
 * ADR-757 · ADR-865 §11.9 — Ο **ΕΝΑΣ** πελάτης GitHub REST του CI.
 *
 * Ζούσε **inline** στο `scripts/ci/ci-health-report.js` (`api()`). Η διαδοχή της γραμμής
 * παραγωγής (`scripts/firestore-deploy/succession.js`) χρειάζεται το ίδιο ακριβώς αίτημα
 * (ίδια κεφαλίδα έκδοσης, ίδιο σφάλμα με όνομα) ⇒ εξήχθη εδώ αντί να γραφτεί δεύτερο αντίγραφο.
 *
 * Μόνο built-ins (`fetch`, Node ≥ 18): τα βήματα που το χρησιμοποιούν **δεν** εγκαθιστούν
 * εξαρτήσεις. Σφάλμα HTTP ⇒ **πετά** με μέθοδο, διαδρομή και σώμα — ποτέ σιωπηλό «τίποτα».
 */

const API_URL = 'https://api.github.com';
const API_VERSION = '2022-11-28';

/**
 * @param {{token:string, apiUrl?:string, fetchImpl?:typeof fetch}} options
 * @returns {{request:(method:string, route:string, body?:object)=>Promise<any>}}
 */
function createGitHubApi({ token, apiUrl = API_URL, fetchImpl = fetch }) {
  if (!token) throw new Error('GitHub API: λείπει token (GITHUB_TOKEN)');

  async function request(method, route, body) {
    const response = await fetchImpl(route.startsWith('http') ? route : `${apiUrl}${route}`, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': API_VERSION,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      throw new Error(`${method} ${route} → ${response.status} ${await response.text()}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text === '' ? null : JSON.parse(text);
  }

  return { request };
}

/** Ο πελάτης με τα διαπιστευτήρια του βήματος (`GITHUB_TOKEN` · `GITHUB_API_URL`). */
function githubApiFromEnv(env = process.env, fetchImpl = fetch) {
  return createGitHubApi({ token: env.GITHUB_TOKEN, apiUrl: env.GITHUB_API_URL || API_URL, fetchImpl });
}

module.exports = { createGitHubApi, githubApiFromEnv, API_VERSION };
