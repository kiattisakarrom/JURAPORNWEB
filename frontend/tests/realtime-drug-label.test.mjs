import test from "node:test";
import assert from "node:assert/strict";
import { buildDrugLabelPrintHtml } from "../src/lib/drug-label-print.ts";

const template = {
  TEMPLATE_ID: "11111111-1111-1111-1111-111111111111",
  TEMPLATE_NAME: "Test", VERSION_NO: 1, TEMPLATE_STATUS: "ACTIVE",
  WIDTH_MM: 101.6, HEIGHT_MM: 76.2, LOGO_DATA_URL: "/assets/juraporn-hospital-label-logo.png",
  UPDATED_BY: null, UPDATED_AT: "2026-09-25T00:00:00.000Z", PUBLISHED_AT: null, ROW_VERSION: "MTIzNDU2Nzg=",
  DEFINITION: { schemaVersion: 1, elements: [
    { id: "name", type: "field", dataKey: "patientName", xMm: 1, yMm: 1, widthMm: 40, heightMm: 8, zIndex: 1 },
    { id: "missing", type: "field", dataKey: "doctorName", xMm: 1, yMm: 10, widthMm: 40, heightMm: 8, zIndex: 2 },
    { id: "qr", type: "qr", dataKey: "qrToken", xMm: 60, yMm: 10, widthMm: 20, heightMm: 20, zIndex: 3 },
  ] },
};

test("renders an exact 4x3-inch page, QR, bundled Sarabun and missing values as dash", async () => {
  const html = await buildDrugLabelPrintHtml(template, { patientName: "Patient A", qrToken: "QR-001" });
  assert.match(html, /@page\{size:101\.6mm 76\.2mm;margin:0\}/);
  assert.match(html, /sarabun-thai-400-normal\.woff2/);
  assert.match(html, /data:image\/png;base64/);
  assert.match(html, /Patient A/);
  assert.match(html, />—<\/div>/);
});
