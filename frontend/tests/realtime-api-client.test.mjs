import test from "node:test";
import assert from "node:assert/strict";
import { apiGet } from "../src/lib/api-client.ts";

test("resolves a relative API base against the browser origin", async () => {
  const previousBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  let requestedUrl = "";

  process.env.NEXT_PUBLIC_API_BASE_URL = "/backend-api/api/v1";
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "http://192.168.1.177:3000" } },
  });
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response("{}", { headers: { "content-type": "application/json" } });
  };

  try {
    await apiGet("/realtime/changes", { query: { cursor: "test" } });
    assert.equal(
      requestedUrl,
      "http://192.168.1.177:3000/backend-api/api/v1/realtime/changes?cursor=test",
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow === undefined) delete globalThis.window;
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    if (previousBaseUrl === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previousBaseUrl;
  }
});
