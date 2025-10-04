let count = 0

export function generateToastId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}
