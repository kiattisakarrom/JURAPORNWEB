import test from "node:test";
import assert from "node:assert/strict";
import { createClientUuid } from "../src/lib/client-uuid.ts";

test("creates a valid v4 UUID when randomUUID is unavailable on an HTTP LAN origin", () => {
  const previousCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues(bytes) {
        for (let index = 0; index < bytes.length; index += 1) bytes[index] = index;
        return bytes;
      },
    },
  });

  try {
    assert.equal(createClientUuid(), "00010203-0405-4607-8809-0a0b0c0d0e0f");
  } finally {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: previousCrypto });
  }
});
