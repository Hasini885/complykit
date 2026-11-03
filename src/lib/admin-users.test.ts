import assert from "node:assert/strict";
import test from "node:test";

import { isAdminEmail, toUserRow, type ClerkUserLike } from "@/lib/admin-users";

const base: ClerkUserLike = {
  id: "u1",
  firstName: null,
  lastName: null,
  unsafeMetadata: { name: "Hasini Sai", mobile: "9876543210" },
  primaryEmailAddressId: "e2",
  emailAddresses: [
    { id: "e1", emailAddress: "old@x.in" },
    { id: "e2", emailAddress: "hasini@x.in" },
  ],
  createdAt: 1000,
  lastSignInAt: 2000,
};

test("name and mobile from sign-up, and the primary email", () => {
  assert.deepEqual(toUserRow(base), {
    id: "u1",
    name: "Hasini Sai",
    mobile: "9876543210",
    email: "hasini@x.in",
    joinedAt: 1000,
    lastSignInAt: 2000,
  });
});

test("accounts made before the mobile was asked for (e.g. Google sign-in)", () => {
  const google = { ...base, unsafeMetadata: {}, firstName: "Ravi", lastName: "Kumar" };
  assert.equal(toUserRow(google).name, "Ravi Kumar");
  assert.equal(toUserRow(google).mobile, "");
});

test("only the owner's emails are admins", () => {
  assert.equal(isAdminEmail("Hasini@X.in", "hasini@x.in, other@y.in"), true);
  assert.equal(isAdminEmail("someone@z.in", "hasini@x.in"), false);
  assert.equal(isAdminEmail("hasini@x.in", undefined), false, "no admins set: nobody");
  assert.equal(isAdminEmail(null, "hasini@x.in"), false);
});
