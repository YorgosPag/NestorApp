// ============================================================================
// ADR-413 — BIM PBR Texture uploader (Firebase Storage)
// ============================================================================
// LICENSE: Textures are CC0 (Poly Haven). No attribution required. See ADR-409.
//
// Uploads the local working copies produced by download-textures.mjs:
//   C:\Nestor_Pagonis\.tex-lib\<slug>\<map>.jpg
// to the Firebase Storage bucket:
//   gs://pagonis-87766.firebasestorage.app
// at path:
//   bim-texture-library/<slug>/<map>.jpg   (content-type image/jpeg)
//
// AUTH (one of):
//   - Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path, OR
//   - Run in an environment with Application Default Credentials, OR
//   - Pass a service-account path as the SERVICE_ACCOUNT env var.
//
// USAGE:
//   # 1) download working copies first
//   node tools/bim-textures/download-textures.mjs
//   # 2) authenticate, then upload
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json   (PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS=...)
//   node tools/bim-textures/upload-textures.mjs
//
// firebase-admin is already a project dependency (^12.x) — no extra install.
// Idempotent-ish: re-uploading overwrites the same object (same path).
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TEX_LIB = path.join(REPO_ROOT, '.tex-lib');
const BUCKET = 'pagonis-87766.firebasestorage.app';
const STORAGE_PREFIX = 'bim-texture-library';

const SLUGS = ['concrete', 'brick', 'plaster', 'wood', 'tile', 'stone', 'metal'];
const MAPS = ['albedo', 'normal', 'roughness', 'ao'];

function initAdmin() {
  if (admin.apps.length > 0) {
    return;
  }
  const saPath = process.env.SERVICE_ACCOUNT;
  if (saPath && fs.existsSync(saPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: BUCKET,
    });
    return;
  }
  // Falls back to GOOGLE_APPLICATION_CREDENTIALS / ADC.
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: BUCKET,
  });
}

async function uploadOne(bucket, slug, mapName, report) {
  const local = path.join(TEX_LIB, slug, `${mapName}.jpg`);
  if (!fs.existsSync(local)) {
    report.missing.push(`${slug}/${mapName}.jpg`);
    return;
  }
  const destination = `${STORAGE_PREFIX}/${slug}/${mapName}.jpg`;
  try {
    await bucket.upload(local, {
      destination,
      contentType: 'image/jpeg',
      metadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' },
    });
    report.uploaded.push(destination);
    console.log(`uploaded gs://${BUCKET}/${destination}`);
  } catch (err) {
    report.failed.push({ destination, reason: err.message });
    console.error(`FAILED ${destination}: ${err.message}`);
  }
}

(async () => {
  try {
    initAdmin();
  } catch (err) {
    console.error('Failed to initialise firebase-admin credentials.');
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS or SERVICE_ACCOUNT to a service-account JSON.');
    console.error(err.message);
    process.exit(1);
  }

  const bucket = admin.storage().bucket();
  const report = { uploaded: [], missing: [], failed: [] };

  for (const slug of SLUGS) {
    for (const mapName of MAPS) {
      await uploadOne(bucket, slug, mapName, report);
    }
  }

  console.log('\n=== UPLOAD SUMMARY ===');
  console.log(`Uploaded: ${report.uploaded.length}`);
  console.log(`Missing:  ${report.missing.length}${report.missing.length ? ' -> ' + report.missing.join(', ') : ''}`);
  console.log(`Failed:   ${report.failed.length}`);
  if (report.failed.length > 0) {
    console.log(JSON.stringify(report.failed, null, 2));
    process.exitCode = 1;
  }
})();
