import test from "node:test";
import assert from "node:assert/strict";

import { formatGhanaPhoneForSms } from "../src/notifications.js";
import { normalizeNotificationSettings } from "../src/storage.js";

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

test("normalizeNotificationSettings falls back safely when storage returns null", () => {
  const originalAdminPhones = process.env.ADMIN_NOTIFICATION_PHONES;
  const originalFinancePhones = process.env.FINANCE_NOTIFICATION_PHONES;

  process.env.ADMIN_NOTIFICATION_PHONES = "0241234567";
  process.env.FINANCE_NOTIFICATION_PHONES = "0551234567";

  try {
    assert.deepEqual(normalizeNotificationSettings(null), {
      adminPhones: ["0241234567"],
      financePhones: ["0551234567"],
    });
  } finally {
    process.env.ADMIN_NOTIFICATION_PHONES = originalAdminPhones;
    process.env.FINANCE_NOTIFICATION_PHONES = originalFinancePhones;
  }
});
