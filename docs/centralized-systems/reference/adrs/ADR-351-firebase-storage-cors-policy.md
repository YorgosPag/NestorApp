# ADR-351: Firebase Storage CORS Policy

**Status:** ✅ APPROVED & APPLIED
**Date:** 2026-05-15
**Domain:** Infrastructure — Firebase Storage
**Bucket:** `gs://pagonis-87766.firebasestorage.app`
**Companion files:** `infrastructure/firebase-storage/cors.json`, `infrastructure/firebase-storage/README.md`

---

## Context

The DXF viewer subapp persists every loaded floor plan to Firebase Storage as
a serialized `*.scene.json` blob (see ADR-040, ADR-292, ADR-293). When the
canvas mounts on any client, `useLevelSceneLoader` reads
`dxf_viewer_levels/{levelId}.sceneFileId` from Firestore and fetches the
scene blob directly from
`https://firebasestorage.googleapis.com/v0/b/pagonis-87766.firebasestorage.app/o/...`
using the Firebase Storage SDK (XHR under the hood).

Browser XHR requests to a third-party origin (`firebasestorage.googleapis.com`)
are subject to the CORS preflight check. The bucket must respond with
`Access-Control-Allow-Origin: <calling-origin>` headers, or the browser
silently rejects the response — visible only in DevTools as a CORS error
while the network tab shows `200 OK net::ERR_FAILED`.

### Incident — 2026-05-15

Floor plans loaded on `localhost:3000` were visible on Vercel
(`nestor-app.vercel.app`) but invisible on the Netcup production deployment
(`nestorconstruct.gr`). DevTools on Netcup revealed:

```
Access to XMLHttpRequest at
'https://firebasestorage.googleapis.com/.../file_xxx.scene.json'
from origin 'https://nestorconstruct.gr' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

Root cause: the bucket's CORS allowlist contained
`https://nestor-app.vercel.app`, `http://localhost:3000`, and
`http://localhost:3001` — but **not** `https://nestorconstruct.gr`.

---

## Decision

The Firebase Storage CORS policy is now **versioned in the repo** as
`infrastructure/firebase-storage/cors.json` and applied via `gcloud storage`
using the npm scripts `firebase-storage:cors:apply` and
`firebase-storage:cors:verify`.

### Allowed origins (current)

| Origin | Purpose |
|--------|---------|
| `https://nestorconstruct.gr` | Production (Netcup) |
| `https://www.nestorconstruct.gr` | Production (Netcup, `www` host) |
| `https://nestor-app.vercel.app` | Production (Vercel) |
| `http://localhost:3000` | Local dev (`pnpm dev`) |
| `http://localhost:3001` | Local dev (alt port) |

### Allowed methods

`GET`, `HEAD`, `PUT`, `POST` — covers both download (DXF scene reads) and
direct browser uploads (used by the floorplan import wizard via the Firebase
Storage SDK).

### Response headers exposed to the browser

`Content-Type`, `Content-Length`, `Authorization`, `x-goog-meta-*` — the
last covers custom Google Cloud Storage object metadata.

### Preflight cache

`maxAgeSeconds: 3600` (1h) — preflight `OPTIONS` requests are cached for an
hour to avoid round-tripping every range request the browser makes when
streaming large scene JSON blobs.

---

## Rationale

1. **Config-as-code over click-ops.** Before this ADR, the bucket CORS was
   set out-of-band via `gsutil cors set` against a local `cors.json` that
   was not versioned. The Netcup origin was forgotten when the bucket was
   first configured, and there was no diff to review or PR to gate the
   change. Versioning the CORS config makes drift detectable
   (`firebase-storage:cors:verify` against committed `cors.json`) and PR-gated.

2. **No Terraform yet.** Our cloud infrastructure footprint is small
   (one Firebase project, one bucket, one Firestore database). The cost of
   introducing Terraform — provider setup, state backend, CI integration,
   onboarding — outweighs the benefit of declarative drift detection at this
   scale. The npm scripts + this ADR are the right level of formalism for
   the current size. Revisit if the bucket count grows past ~3 or IAM custom
   roles enter the picture.

3. **No wildcards for production origins.** Firebase Storage CORS supports
   wildcard origins (`*`), but using one would also expose authenticated
   user data to any malicious site that obtained a download URL. We
   enumerate origins explicitly even when this means re-applying CORS each
   time we add a domain.

4. **`PUT` + `POST` are included.** ADR-292 + ADR-293 split the floorplan
   upload pipeline so that the binary upload to Storage is performed
   **directly from the browser** via the Firebase Storage SDK
   (`uploadBytesResumable`). That call uses `PUT` against the bucket. The
   server-side API only mints the signed upload URL and the FileRecord
   document. Allowing `PUT`/`POST` is therefore a hard requirement, not a
   future-proofing nicety.

---

## Implementation

```
infrastructure/
  firebase-storage/
    cors.json       ← single source of truth for the bucket CORS policy
    README.md       ← operator runbook (apply / verify / when to update)
```

```jsonc
// package.json — scripts section
{
  "scripts": {
    "firebase-storage:cors:apply":
      "gcloud storage buckets update gs://pagonis-87766.firebasestorage.app --cors-file=infrastructure/firebase-storage/cors.json",
    "firebase-storage:cors:verify":
      "gcloud storage buckets describe gs://pagonis-87766.firebasestorage.app --format=\"value(cors_config)\""
  }
}
```

### Operator workflow

1. Edit `infrastructure/firebase-storage/cors.json` (e.g. add a new origin).
2. Run `pnpm firebase-storage:cors:apply` (requires
   `roles/storage.admin` on `pagonis-87766`).
3. Verify with `pnpm firebase-storage:cors:verify` — output must equal the
   committed JSON.
4. Commit `cors.json` + reference the change in a PR.

### Why `gcloud storage` instead of `gsutil`

`gsutil` requires Python 3.8–3.12 and breaks on Python 3.13 (current dev
machine has 3.13). `gcloud storage` is the modern replacement: same project
auth, no Python compat issues, and supersedes `gsutil cors set` 1:1 via
`gcloud storage buckets update --cors-file`.

---

## Related ADRs

- **ADR-040** — Preview Canvas Performance (cross-references the scene-blob
  persistence path used by the DXF viewer)
- **ADR-292** — Floorplan Upload Consolidation Map (defines the
  client-direct-to-storage upload pattern that requires `PUT` CORS)
- **ADR-293** — Canonical Scene Path (defines the storage path structure of
  the `*.scene.json` blobs covered by this CORS policy)

---

## Future work

- **Terraform migration.** If we grow to 3+ buckets, custom IAM bindings, or
  multi-project setups, migrate this folder to a Terraform module
  (`terraform/firebase-storage/`) and replace the npm script with
  `terraform apply`. Keep the same `cors.json` shape so the migration is
  mechanical.
- **CI drift check.** A nightly GitHub Action that runs
  `firebase-storage:cors:verify` and fails if its output diverges from
  the committed `cors.json`. Cheap insurance against out-of-band edits via
  the Google Cloud Console.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-15 | **ADR created + applied.** Added `https://nestorconstruct.gr` and `https://www.nestorconstruct.gr` to the CORS allowlist (previously absent — root cause of the 2026-05-15 incident). Extended methods from `[GET, HEAD]` to `[GET, HEAD, PUT, POST]`. Added `Authorization` and `x-goog-meta-*` to exposed response headers. Versioned the CORS config in `infrastructure/firebase-storage/cors.json` and wired npm scripts. |
