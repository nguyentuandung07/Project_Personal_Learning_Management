import { SECRET_KEY } from "../../config.js";

/**
 * Mã hóa chuỗi bằng Base64 (không thêm ký tự đệm, an toàn cho URL).
 * @param {string} str  - chuỗi đầu vào để mã hóa
 * @returns {string}  chuỗi được mã hóa bằng Base64url
 */
const b64url = (str) =>
  btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

/**
 * Mã hóa Base64url một mảng byte (không có phần đệm, an toàn cho URL).
 * @param {Uint8Array} bytes  - mảng byte đầu vào cần mã hóa
 * @returns {string} Chuỗi được mã hóa bằng Base64url
 */
const b64urlFromBytes = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

/**
 * Giải mã một chuỗi Base64url thành chuỗi gốc.
 * @param {string} str - chuỗi Base64url cần giải mã
 * @returns {string}  chuỗi đã giải mã
 */
const b64urlDecode = (str) => {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
};

let _cachedKey = null;
/**
 * Nhập khóa bí mật từ cấu hình và chuẩn bị CryptoKey cho HMAC-SHA256.
 * @returns {Promise<CryptoKey>}  Đối tượng CryptoKey đã được nhập và sẵn sàng sử dụng
 */
const getKeyMaterial = async () => {
  if (_cachedKey) return _cachedKey;
  const enc = new TextEncoder();
  _cachedKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return _cachedKey;
};

export const jwt = {
  /**
   * Tạo một JWT mới với payload tùy ý và TTL có thể cấu hình (mặc định 24 giờ).
   * @param {object} payload  - bất kỳ đối tượng có thể chuyển đổi sang JSON
   * @param {number} [expiresIn=86400] - TTL trong giây (mặc định 24 giờ)
   */
  async sign(payload, expiresIn = 86400) {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);

    const claims = {
      ...payload,
      iat: now,
      exp: now + expiresIn,
    };

    const headerB64 = b64url(JSON.stringify(header));
    const payloadB64 = b64url(JSON.stringify(claims));
    const signingInput = `${headerB64}.${payloadB64}`;

    const key = await getKeyMaterial();
    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signingInput),
    );

    const sigB64 = b64urlFromBytes(sigBuffer);
    return `${signingInput}.${sigB64}`;
  },

  /**
   * Xác minh một JWT và trả về payload của nó, hoặc null nếu không hợp lệ/hết hạn.
   * @param {string} token
   */
  async verify(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const [headerB64, payloadB64, sigB64] = parts;
      const signingInput = `${headerB64}.${payloadB64}`;

      // Decode signature
      const sigStr = b64urlDecode(sigB64);
      const sigBytes = Uint8Array.from(sigStr, (c) => c.charCodeAt(0));

      const key = await getKeyMaterial();
      const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        sigBytes,
        new TextEncoder().encode(signingInput),
      );

      if (!valid) return null;

      // Parse payload
      const payload = JSON.parse(b64urlDecode(payloadB64));

      // Check expiry
      if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
        return null; // expired
      }

      return payload;
    } catch {
      return null;
    }
  },

  /**
   * Ký chuỗi mật khẩu thô và trả về mã thông báo JWT để lưu trữ.
   * Payload: { pwd: "<password>" }
   */
  async hashPassword(plainPassword) {
    return this.sign({ pwd: plainPassword }, 10 * 365 * 24 * 3600); // 10-year TTL (static credential)
  },

  /**
   * Xác thực mật khẩu so với mã thông báo JWT đã lưu trữ.
   * @returns {Promise<boolean>} true nếu mật khẩu hợp lệ, false nếu không hợp lệ hoặc token hết hạn
   */
  async checkPassword(plainPassword, storedToken) {
    const payload = await this.verify(storedToken);
    return payload !== null && payload.pwd === plainPassword;
  },
};
