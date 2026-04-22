import test from "node:test";
import assert from "node:assert/strict";

import { formatGhanaPhoneForSms } from "../src/notifications.js";

test("formatGhanaPhoneForSms converts local Ghana numbers to 233 format", () => {
  assert.equal(formatGhanaPhoneForSms("0241234567"), "233241234567");
});

test("formatGhanaPhoneForSms keeps 233 format numbers unchanged", () => {
  assert.equal(formatGhanaPhoneForSms("233241234567"), "233241234567");
});

test("formatGhanaPhoneForSms strips spaces and punctuation", () => {
  assert.equal(formatGhanaPhoneForSms("+233 24 123 4567"), "233241234567");
});

test("formatGhanaPhoneForSms rejects invalid numbers", () => {
  assert.equal(formatGhanaPhoneForSms("241234567"), "");
});
