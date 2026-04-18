let count = 0

export function nextToastKey() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

// Back-compat alias — zero consumer in src but preserved for safety
export { nextToastKey as generateToastId };
