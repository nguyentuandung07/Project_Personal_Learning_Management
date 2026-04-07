import { SESSION_KEY } from "../../config.js";

let _sessionCache = undefined;

/**
 * Quản lý lưu trữ phiên bằng localStorage.
 * Phiên được lưu vào bộ nhớ đệm để truy cập nhanh hơn.
 */
export const sessionStorage = {
  // Lưu phiên vào localStorage và bộ nhớ đệm.
  setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    _sessionCache = session;
  },

  // Lấy phiên từ bộ nhớ đệm nếu có, nếu không thì từ localStorage.
  getSession() {
    if (_sessionCache !== undefined) return _sessionCache;
    const sessionStr = localStorage.getItem(SESSION_KEY);
    _sessionCache = sessionStr ? JSON.parse(sessionStr) : null;
    return _sessionCache;
  },

  // Xóa phiên khỏi localStorage và bộ nhớ đệm.
  clearSession() {
    localStorage.removeItem(SESSION_KEY);
    _sessionCache = undefined;
  },
};
