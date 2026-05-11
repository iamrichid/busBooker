import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_HIRING_ROUTES, mergeHiringRatesSubmission } from "../src/hiring-rates.js";

test("mergeHiringRatesSubmission accepts valid rate updates", () => {
  const input = DEFAULT_HIRING_ROUTES.map((row) => ({
    id: row.id,
    rateGhs: row.rateGhs + 50,
    km: row.km,
  }));
  const merged = mergeHiringRatesSubmission(input);

  assert.equal(merged.ok, true);
  assert.equal(merged.routes.find((r) => r.id === "kasoa").rateGhs, 1050);
});

test("mergeHiringRatesSubmission rejects invalid rate", () => {
  const input = DEFAULT_HIRING_ROUTES.map((row) => ({
    id: row.id,
    rateGhs: row.id === "kasoa" ? 0 : row.rateGhs,
    km: row.km,
  }));
  const merged = mergeHiringRatesSubmission(input);

  assert.equal(merged.ok, false);
  assert.ok(merged.errors["rate_kasoa"]);
});
