import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkspaceHref,
  parseWorkspaceNavigation,
  popupCloseMode,
  workspaceScreenFromPathname,
} from "../src/lib/workspace-navigation.ts";

const date = "2026-09-07";
const workflowId = "4B5DCE1C-3D22-4C8E-A87E-FAEF0CC6D309";
const packageId = "b7fcb90a-79d5-49d1-a1ce-3f3708f1cc91";

test("maps supported workspace paths without accepting unknown routes", () => {
  assert.equal(workspaceScreenFromPathname("/verify"), "verify");
  assert.equal(workspaceScreenFromPathname("/me-report/"), "me");
  assert.equal(workspaceScreenFromPathname("/unknown"), null);
});

test("builds a canonical Verify URL with tab and date range", () => {
  assert.equal(
    buildWorkspaceHref({ screen: "verify", tab: "picking", fromDate: date, toDate: "2026-09-08" }),
    "/verify?tab=picking&from=2026-09-07&to=2026-09-08",
  );
});

test("does not carry Verify tab or popup state into another workspace route", () => {
  assert.equal(
    buildWorkspaceHref({
      screen: "matching",
      tab: "pending",
      fromDate: date,
      toDate: date,
      popup: { kind: "package", id: packageId, pn: "02" },
    }),
    "/matching?from=2026-09-07&to=2026-09-07",
  );
});

test("round-trips workflow popup state without patient or lock data", () => {
  const href = buildWorkspaceHref({
    screen: "verify",
    tab: "verify",
    fromDate: date,
    toDate: date,
    popup: { kind: "workflow", id: workflowId, pn: "01" },
  });
  assert.equal(href.includes("HN"), false);
  assert.equal(href.includes("lock"), false);
  const parsed = parseWorkspaceNavigation(href.split("?")[1], date);
  assert.deepEqual(parsed.popup, { kind: "workflow", id: workflowId.toLowerCase(), pn: "01" });
});

test("round-trips package popup state", () => {
  const href = buildWorkspaceHref({
    screen: "verify",
    tab: "checking",
    fromDate: date,
    toDate: date,
    popup: { kind: "package", id: packageId, pn: "02" },
  });
  const parsed = parseWorkspaceNavigation(href.split("?")[1], date);
  assert.deepEqual(parsed.popup, { kind: "package", id: packageId, pn: "02" });
  assert.equal(parsed.tab, "checking");
});

test("falls back safely and requests cleanup for malformed query values", () => {
  const parsed = parseWorkspaceNavigation(
    "tab=unsafe&from=2026-02-30&to=2026-01-01&workflow=bad&package=bad&pn=&patient=secret",
    date,
  );
  assert.equal(parsed.tab, "verify");
  assert.equal(parsed.fromDate, date);
  assert.equal(parsed.toDate, date);
  assert.equal(parsed.popup, null);
  assert.equal(parsed.needsCleanup, true);
});

test("uses Back only for popups opened from the current web history", () => {
  assert.equal(popupCloseMode(true), "back");
  assert.equal(popupCloseMode(false), "replace");
});

test("round-trips the three Dispensing tabs and removes invalid tab values", () => {
  for (const dispensingTab of ["station", "assist", "history"]) {
    const href = buildWorkspaceHref({ screen: "dispensing", dispensingTab, fromDate: date, toDate: date });
    assert.equal(href, `/dispensing?tab=${dispensingTab}&from=${date}&to=${date}`);
    const parsed = parseWorkspaceNavigation(href.split("?")[1], date);
    assert.equal(parsed.dispensingTab, dispensingTab);
  }
  const invalid = parseWorkspaceNavigation(`tab=outside&from=${date}&to=${date}`, date);
  assert.equal(invalid.dispensingTab, "station");
  assert.equal(invalid.needsCleanup, true);
});
