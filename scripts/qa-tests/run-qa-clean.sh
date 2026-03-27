#!/bin/bash
# =============================================================================
# QA Clean Runner — Restarts emulator + dev server, then runs QA tests
# =============================================================================
# Usage: bash scripts/qa-tests/run-qa-clean.sh
#
# What it does:
#   1. Kills any process on ports 8080 (emulator) and 3000 (dev server)
#   2. Starts Firebase emulator (clean state, no leftover data)
#   3. Starts Next.js dev server in emulator mode
#   4. Waits for both to be ready
#   5. Runs QA tests
#   6. Cleans up on exit (kills emulator + dev server)

set -e

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

# ── Cleanup function ──
cleanup() {
  echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
  # Kill background processes
  if [ -n "$EMULATOR_PID" ]; then kill "$EMULATOR_PID" 2>/dev/null || true; fi
  if [ -n "$DEV_PID" ]; then kill "$DEV_PID" 2>/dev/null || true; fi
  # Kill anything still on ports
  npx kill-port 8080 3000 2>/dev/null || true
  echo -e "${GREEN}✅ Cleanup done${NC}"
}
trap cleanup EXIT

# ── Step 1: Kill existing processes ──
echo -e "${CYAN}🔄 Step 1: Killing existing processes on ports 8080 & 3000...${NC}"
npx kill-port 8080 3000 2>/dev/null || true
sleep 2

# ── Step 2: Start Firebase emulator ──
echo -e "${CYAN}🔥 Step 2: Starting Firebase emulator...${NC}"
npx firebase emulators:start --only firestore,auth,storage --project pagonis-87766 &
EMULATOR_PID=$!

# Wait for emulator
echo -e "${YELLOW}⏳ Waiting for emulator (port 8080)...${NC}"
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:8080/ 2>/dev/null; then
    echo -e "${GREEN}✅ Emulator ready${NC}"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo -e "${RED}❌ Emulator failed to start${NC}"
    exit 1
  fi
  sleep 2
done

# ── Step 3: Start dev server ──
echo -e "${CYAN}🚀 Step 3: Starting Next.js dev server (emulator mode)...${NC}"
FIRESTORE_EMULATOR_HOST=localhost:8080 \
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true \
NODE_OPTIONS=--max-old-space-size=8192 \
npx next dev --turbopack &
DEV_PID=$!

# Wait for dev server
echo -e "${YELLOW}⏳ Waiting for dev server (port 3000, max 2min)...${NC}"
for i in $(seq 1 24); do
  if curl -s -o /dev/null http://127.0.0.1:3000/ 2>/dev/null; then
    echo -e "${GREEN}✅ Dev server ready${NC}"
    break
  fi
  if [ "$i" -eq 24 ]; then
    echo -e "${RED}❌ Dev server failed to start${NC}"
    exit 1
  fi
  sleep 5
done

# ── Step 4: Run QA tests ──
echo -e "\n${CYAN}🧪 Step 4: Running QA tests...${NC}\n"
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/qa-tests/contact-individual.qa.ts
QA_EXIT=$?

if [ "$QA_EXIT" -eq 0 ]; then
  echo -e "\n${GREEN}✅ QA tests completed successfully${NC}"
else
  echo -e "\n${YELLOW}⚠️ QA tests finished with failures (exit code: $QA_EXIT)${NC}"
fi

exit $QA_EXIT
