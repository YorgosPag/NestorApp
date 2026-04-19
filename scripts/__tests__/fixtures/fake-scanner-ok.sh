#!/bin/bash
# Fake scanner used by the Jest suite — echoes the minimal fixture so runScanner
# succeeds without spawning the real ~4-minute ssot-discover.sh.
DIR="$(cd "$(dirname "$0")" && pwd)"
cat "$DIR/ssot-discover-output.minimal.txt"
exit 0
