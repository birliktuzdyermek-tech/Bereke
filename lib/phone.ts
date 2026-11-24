/** Kazakhstan mask: +7 (747) 477-47-47. Other international numbers (+1, +44…) are left as typed. */
export function formatKzPhone(raw: string, deleting = false) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.trim().startsWith("+") && !digits.startsWith("7")) return raw;
  // "+7…", "8…" and 11+ digits start with the country code; a bare 10-digit "747…" is already the national part.
  const hasCode = raw.trim().startsWith("+") || digits[0] === "8" || digits.length > 10;
  const rest = (hasCode ? digits.slice(1) : digits).slice(0, 10);
  let out = "+7";
  if (rest.length) out += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) out += ")";
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
  return deleting ? out.replace(/[\s()-]+$/, "") : out; // while deleting, do not put the closing bracket back
}
