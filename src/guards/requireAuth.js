import { sessionStorage } from "../core/storage.js";

/**
 * Kiểm tra xem người dùng đã được xác thực hay chưa và chuyển hướng đến trang đăng nhập nếu chưa.
 * @param {string} loginPath - Đường dẫn đến trang đăng nhập.
 * @param {boolean} check - Nếu true, sẽ chuyển hướng đến trang chính nếu người dùng đã đăng nhập.
 * @returns {boolean} Trả về true nếu người dùng đã được xác thực, ngược lại trả về false và chuyển hướng đến trang đăng nhập.
 */
export const requireAuth = (
  loginPath = "../../pages/loginPage.html",
  check = false,
) => {
  const token = sessionStorage.getSession();
  // Nếu không có token và check là false, chuyển hướng đến trang đăng nhập
  // Nếu có token và check là true, chuyển hướng đến trang chính
  if (!token && !check) {
    window.location.href = loginPath;
    return false;
  } else if (check && token) {
    window.location.href = "../../pages/mainPage.html";
    return false;
  }
  return true;
};
