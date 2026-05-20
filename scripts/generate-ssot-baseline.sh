#!/bin/bash
# =============================================================================
# ENTERPRISE: Regenerate SSoT Violations Baseline (Ratchet Pattern)
# =============================================================================
# Thin wrapper around the Node engine (worker_threads + content-hash cache).
# Cold scan ~15s, warm scan ~2s (vs ~2min for the legacy bash impl).
#
# Run AFTER successful commits that reduce violation counts:
#   npm run ssot:baseline
#
# Engine source: scripts/ssot-baseline-engine.js
# =============================================================================

set -e
exec node "$(dirname "$0")/ssot-baseline-engine.js" --write "$@"
