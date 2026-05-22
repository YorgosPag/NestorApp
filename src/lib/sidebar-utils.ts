export function getBadgeVariant(badge: string) {
  if (badge === "AI") {
    return "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0"
  }
  if (badge === "PRO") {
    return "bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0"
  }
  if (!isNaN(Number(badge))) {
    return "bg-destructive text-destructive-foreground border-0"
  }
  return ""
}
