const text = (v) => (typeof v === "string" ? v.trim() : "");

export function toUserRow(u) {
  const meta = u.unsafeMetadata ?? {};
  const email =
    u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
    u.emailAddresses[0]?.emailAddress ??
    "";
  const name = text(meta.name) || [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  const mobile = text(meta.mobile) || (u.phoneNumbers?.[0]?.phoneNumber ?? "").replace(/^\+91/, "");
  return { id: u.id, name, mobile, email, joinedAt: u.createdAt, lastSignInAt: u.lastSignInAt };
}

/** Whether this email is one of the site owner's (ADMIN_EMAILS, comma separated). */
export function isAdminEmail(email, adminEmails) {
  if (!email || !adminEmails) return false;
  const list = adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
