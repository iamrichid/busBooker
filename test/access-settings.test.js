import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { authenticateAdminCredentials, authenticateFinanceCredentials } from "../src/http.js";
import {
  ensureDataFiles,
  normalizeAccessSettings,
  saveAccessSettings,
} from "../src/storage.js";

const accessSettingsFile = path.join(process.cwd(), "data", "access-settings.json");

test("normalizeAccessSettings falls back to env defaults when settings are missing", () => {
  const originalAdminLoginName = process.env.ADMIN_LOGIN_NAME;
  const originalFinanceLoginName = process.env.FINANCE_LOGIN_NAME;
  const originalAdminAccessCode = process.env.ADMIN_ACCESS_CODE;
  const originalFinanceAccessCode = process.env.FINANCE_ACCESS_CODE;

  process.env.ADMIN_LOGIN_NAME = "Desk Admin";
  process.env.FINANCE_LOGIN_NAME = "Desk Finance";
  process.env.ADMIN_ACCESS_CODE = "admin-123456";
  process.env.FINANCE_ACCESS_CODE = "finance-123456";

  try {
    assert.deepEqual(normalizeAccessSettings(null), {
      admin: {
        accessCode: "admin-123456",
        name: "Desk Admin",
      },
      finance: {
        accessCode: "finance-123456",
        name: "Desk Finance",
      },
    });
  } finally {
    process.env.ADMIN_LOGIN_NAME = originalAdminLoginName;
    process.env.FINANCE_LOGIN_NAME = originalFinanceLoginName;
    process.env.ADMIN_ACCESS_CODE = originalAdminAccessCode;
    process.env.FINANCE_ACCESS_CODE = originalFinanceAccessCode;
  }
});

test("desk authentication uses the saved name and access code settings", async () => {
  await ensureDataFiles();

  let originalSettings;

  try {
    originalSettings = await readFile(accessSettingsFile, "utf8");
  } catch {
    originalSettings = null;
  }

  try {
    await saveAccessSettings({
      admin: {
        accessCode: "admin-654321",
        name: "Configured Admin",
      },
      finance: {
        accessCode: "finance-654321",
        name: "Configured Finance",
      },
    });

    await assert.doesNotReject(() =>
      authenticateAdminCredentials("admin-654321", "Configured Admin"),
    );
    await assert.doesNotReject(() =>
      authenticateFinanceCredentials("finance-654321", "Configured Finance"),
    );
    await assert.rejects(
      () => authenticateAdminCredentials("admin-654321", "Wrong Admin"),
      /Invalid admin name/,
    );
    await assert.rejects(
      () => authenticateFinanceCredentials("finance-654321", "Wrong Finance"),
      /Invalid finance officer name/,
    );
  } finally {
    if (originalSettings === null) {
      await saveAccessSettings(normalizeAccessSettings(null));
    } else {
      await writeFile(accessSettingsFile, originalSettings, "utf8");
    }
  }
});
