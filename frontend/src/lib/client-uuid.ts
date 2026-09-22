/**
 * Creates an RFC 4122 version 4 UUID in both secure and non-secure browser
 * contexts. `crypto.randomUUID()` is unavailable on plain HTTP LAN origins,
 * while `crypto.getRandomValues()` remains available there.
 */
export function createClientUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== "function") {
    throw new Error("Browser นี้ไม่รองรับการสร้างรหัสที่ปลอดภัย กรุณาใช้ Browser รุ่นใหม่");
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
