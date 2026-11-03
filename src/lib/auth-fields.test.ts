import assert from "node:assert/strict";
import test from "node:test";

import { checkEmail, checkSignUp, otpInput } from "@/lib/auth-fields";

test("sign-up needs a name, a valid mobile (mandatory) and a valid email", () => {
  assert.deepEqual(checkSignUp({ name: "Hasini Sai", mobile: "98765 43210", email: "a@b.in" }), {});
  const missing = checkSignUp({ name: "", mobile: "", email: "" });
  assert.ok(missing.name && missing.mobile && missing.email);
  assert.match(checkSignUp({ name: "Hasini", mobile: "12345", email: "a@b.in" }).mobile ?? "", /10-digit/);
  assert.match(checkSignUp({ name: "Hasini", mobile: "9876543210", email: "a@b" }).email ?? "", /not valid/);
});

test("sign-in email and the 6-digit code", () => {
  assert.equal(checkEmail("x@y.com"), null);
  assert.ok(checkEmail(""));
  assert.equal(otpInput("12a 34-567"), "123456");
});

test("sign-up password: any length the user likes, typed the same twice", () => {
  const ok = { name: "Hasini Sai", mobile: "9876543210", email: "a@b.in" };
  assert.deepEqual(checkSignUp({ ...ok, password: "longenough", confirm: "longenough" }), {});
  assert.deepEqual(checkSignUp({ ...ok, password: "abc1", confirm: "abc1" }), {});
  assert.ok(checkSignUp({ ...ok, password: "", confirm: "" }).password);
  assert.ok(checkSignUp({ ...ok, password: "longenough", confirm: "different" }).confirm);
});
