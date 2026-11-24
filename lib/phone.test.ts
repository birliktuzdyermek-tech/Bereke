// Run with: pnpm test.
import test from "node:test";
import assert from "node:assert/strict";
import { formatKzPhone } from "./phone.ts";

test("formats Kazakhstan numbers as +7 (747) 477-47-47", () => {
  assert.equal(formatKzPhone("7474774747"), "+7 (747) 477-47-47");
  assert.equal(formatKzPhone("+77474774747"), "+7 (747) 477-47-47");
  assert.equal(formatKzPhone("87474774747"), "+7 (747) 477-47-47");
  assert.equal(formatKzPhone("+7 (747) 477-47-47"), "+7 (747) 477-47-47");
});

test("formats progressively and ignores extra digits", () => {
  assert.equal(formatKzPhone(""), "");
  assert.equal(formatKzPhone("7"), "+7 (7");
  assert.equal(formatKzPhone("747"), "+7 (747)");
  assert.equal(formatKzPhone("74747"), "+7 (747) 47");
  assert.equal(formatKzPhone("774747747479"), "+7 (747) 477-47-47");
  assert.equal(formatKzPhone("+7 (7"), "+7 (7");
});

test("deleting does not bring the closing bracket back", () => {
  assert.equal(formatKzPhone("+7 (747", true), "+7 (747");
  assert.equal(formatKzPhone("+7 (747) 4", true), "+7 (747) 4");
});

test("international numbers are left as typed", () => {
  assert.equal(formatKzPhone("+1 202 555 0100"), "+1 202 555 0100");
  assert.equal(formatKzPhone("+44 20 7946 0958"), "+44 20 7946 0958");
});
