import { authServices } from "../services/authServices.js";
import { confirmAction, queueToast } from "../utils/alert.js";

/**
 * Liên kết chức năng đăng xuất với một nút được chỉ định bởi bộ chọn.
 * Khi nút được nhấp, hệ thống sẽ yêu cầu xác nhận trước khi đăng xuất người dùng và chuyển hướng họ đến trang đăng nhập.
 * @param {string} selector - Bộ chọn CSS để xác định nút đăng xuất.
 * @param {string} loginPath - Đường dẫn đến trang đăng nhập (mặc định là "../../pages/loginPage.html").
 */
export const bindLogout = (
  selector,
  loginPath = "../../pages/loginPage.html",
) => {
  const btn = document.querySelector(selector);
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const confirmed = await confirmAction(
      "Đăng xuất?",
      "Bạn sẽ cần đăng nhập lại để tiếp tục.",
    );
    if (!confirmed) return;

    authServices.logout();
    queueToast("success", "Đã đăng xuất");
    window.location.href = loginPath;
  });
};
