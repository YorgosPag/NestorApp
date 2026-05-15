# Firebase Storage Infrastructure

This directory holds **config-as-code** for the Firebase Storage bucket
`gs://pagonis-87766.firebasestorage.app`.

> 📘 **Architectural decision**: see [ADR-351 — Firebase Storage CORS Policy](../../docs/centralized-systems/reference/adrs/ADR-351-firebase-storage-cors-policy.md).

---

## Contents

| File | Purpose |
|------|---------|
| `cors.json` | CORS policy applied to the bucket — controls which web origins may read/write storage objects |

The bucket also has two more pieces of config that live elsewhere in the repo:

- **Security rules**: `storage.rules` (repo root) — deployed via `firebase deploy --only storage`
- **CORS**: this folder — applied via `gcloud storage buckets update`

---

## Apply / Verify CORS

### Prerequisites

- `gcloud` CLI installed and authenticated as a user with `roles/storage.admin` on project `pagonis-87766`
- Active project set: `gcloud config set project pagonis-87766`

### Apply

```bash
pnpm firebase-storage:cors:apply
```

This wraps:
```
gcloud storage buckets update gs://pagonis-87766.firebasestorage.app \
  --cors-file=infrastructure/firebase-storage/cors.json
```

Effect is **immediate** — no deploy, no cache invalidation, no service restart.

### Verify

```bash
pnpm firebase-storage:cors:verify
```

Prints the live CORS config currently in effect on the bucket. Compare with
`cors.json` to confirm drift-free state.

---

## When to update `cors.json`

Add a new origin to the `origin` array whenever a **new domain** needs to read
or upload to Storage from a browser. Examples:

- A new production domain (e.g. `https://app2.nestorconstruct.gr`)
- A staging deployment (e.g. `https://staging.nestorconstruct.gr`)
- A preview environment (e.g. `https://*.vercel.app` — for Vercel preview deploys)

> ⚠️ **Wildcards** are partially supported. `*.vercel.app` does NOT work as an
> origin pattern — list specific preview URLs or use the exact production URL.
> Use `origin: ["*"]` only for fully public buckets (we do not).

After editing `cors.json`, run `pnpm firebase-storage:cors:apply` and commit
the change to the repo.

---

## Why is this not in Terraform?

The infrastructure footprint is small (one bucket, no IAM custom roles, no VPC,
no DNS-managed-zones), and the only operational concerns are storage rules
(already in `storage.rules`) and CORS (this folder). A full Terraform module
adds friction without payoff at this scale. If the surface grows
(multi-bucket, KMS, IAM bindings), revisit and migrate to Terraform per
ADR-351 §Future work.
