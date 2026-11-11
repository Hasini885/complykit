import assert from "node:assert/strict";
import test from "node:test";

import {
  amountInput,
  indianAmount,
  cinInput,
  companyNameInput,
  dinInput,
  emailInput,
  mobileInput,
  personNameInput,
  srnInput,
} from "@/lib/input-filters";
import { normaliseMobile } from "@/lib/portfolio/mobile";

test("mobile: ten digits, pasted +91 or 0 dropped, shown 5 + 5", () => {
  assert.equal(mobileInput("98765abc43210999"), "98765 43210");
  assert.equal(mobileInput("+91 98765 43210"), "98765 43210");
  assert.equal(mobileInput("098765-43210"), "98765 43210");
  assert.equal(mobileInput("987"), "987");
  assert.equal(normaliseMobile(mobileInput("+91 98765 43210")), "9876543210", "still valid after filtering");
});

test("CIN, LLPIN, DIN and SRN keep only what they can hold", () => {
  assert.equal(cinInput("u62099ka 2019-ptc128740XYZ", false), "U62099KA2019PTC128740");
  assert.equal(cinInput("aab-1234-99", true), "AAB-1234");
  assert.equal(dinInput("1234 5678 9"), "12345678");
  assert.equal(srnInput("ab-123 4567"), "AB1234567");
});

test("names and emails", () => {
  assert.equal(personNameInput("Asha  Rao 123!"), "Asha Rao ");
  assert.equal(personNameInput("D'Souza-Pai Jr."), "D'Souza-Pai Jr.");
  assert.equal(companyNameInput("A&B (India) Pvt. Ltd. #1"), "A&B (India) Pvt. Ltd. 1");
  assert.equal(emailInput(" Office @IGPL.in "), "office@igpl.in");
});

test("amounts: digits only", () => {
  assert.equal(amountInput("₹ 10,00,000"), 1000000);
  assert.equal(amountInput(""), 0);
});

test("rupee amounts show in Indian grouping", () => {
  assert.equal(indianAmount(1_000_000), "10,00,000");
  assert.equal(indianAmount(100_000), "1,00,000");
  assert.equal(indianAmount(12_34_56_789), "12,34,56,789");
  assert.equal(indianAmount(999), "999");
  assert.equal(indianAmount(0), "");
  assert.equal(amountInput("10,00,000"), 1_000_000, "commas typed or shown are ignored when saving");
});
