import { test } from "node:test";
import assert from "node:assert/strict";
test("mobile aggregation handles month boundaries and separate sports", async () => {
  const { report, movePeriod } = await import("./stats.js");
  const rows = [
    {
      sport: "running",
      value: 7,
      duration: 2520,
      occurredAt: new Date(2026, 9, 22, 7).toISOString(),
    },
    {
      sport: "swimming",
      value: 1500,
      duration: 2000,
      occurredAt: new Date(2026, 9, 22, 8).toISOString(),
    },
  ];
  const r = report(rows, "running", "week", new Date(2026, 9, 22));
  assert.equal(r.total, 7);
  assert.equal(r.rows.length, 1);
  assert.equal(r.bars[3].value, 7);
  assert.equal(
    report([], "running", "month", new Date(2024, 1, 3)).bars.length,
    29,
  );
  assert.equal(movePeriod(new Date(2026, 0, 31), "month", 1).getMonth(), 1);
});
