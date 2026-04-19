#!/bin/bash
# Fake scanner that exits non-zero so tests can assert runScanner's error path.
echo "simulated scanner failure" >&2
exit 2
