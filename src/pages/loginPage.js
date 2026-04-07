import { authServices } from "../services/authServices.js";
import { requireAuth } from "../guards/requireAuth.js";
import { queueToast, showQueuedToast } from "../utils/alert.js";

if (requireAuth("../../pages/loginPage.html", true)) {
  showQueuedToast();

  // --- DOM Elements ---
  const loginForm = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const rememberMeCheckbox = document.getElementById("remember-me");
  const errorEmail = document.getElementById("error-email");
  const errorPassword = document.getElementById("error-password");
  const togglePasswordBtn = document.getElementById("toggle-password");
  const iconEye = document.getElementById("icon-eye");
  const iconEyeOff = document.getElementById("icon-eye-off");

  /**
   * Hiển thị lỗi inline dưới ô input
   * @param {HTMLElement} el - Phần tử hiển thị lỗi
   * @param {string} message - Nội dung lỗi
   */
  const showFieldError = (el, message) => {
    if (!el) return;
    el.textContent = message;
    el.classList.remove("hidden");
  };

  /**
   * Ẩn tất cả các lỗi inline
   */
  const clearErrors = () => {
    [errorEmail, errorPassword].forEach((el) => {
      if (el) {
        el.textContent = "";
        el.classList.add("hidden");
      }
    });
    [emailInput, passwordInput].forEach((el) => {
      if (el) el.classList.remove("border-red-400");
    });
  };

  /**
   * Xử lý sự kiện submit của form đăng nhập
   * @param {Event} e - Sự kiện submit
   * @returns {Promise<void>}
   */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    clearErrors();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    try {
      const result = await authServices.login(email, password);

      // Nếu đăng nhập thất bại, hiển thị lỗi inline và dừng quá trình
      if (!result.ok) {
        showFieldError(errorEmail, result.message);
        emailInput.classList.add("border-red-400");
        return;
      }

      // Nếu đăng nhập thành công, lưu thông tin nếu "Remember Me" được chọn
      if (rememberMeCheckbox.checked) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("savedEmail", email);
        localStorage.setItem("savedPassword", btoa(password));
      } else {
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("savedEmail");
        localStorage.removeItem("savedPassword");
      }

      queueToast("success", "Đăng nhập thành công");
      window.location.href = "../../pages/mainPage.html";
    } catch (error) {
      // Log lỗi chi tiết để dễ dàng debug
      console.error("Login error:", error);
      showFieldError(errorPassword, "Không thể đăng nhập, vui lòng thử lại");
    }
  };

  const init = () => {
    const rememberMe = localStorage.getItem("rememberMe") === "true";
    // Nếu người dùng đã chọn "Remember Me" trước đó, tự động điền thông tin đăng nhập và đánh dấu checkbox
    if (rememberMe) {
      rememberMeCheckbox.checked = true;
      if (emailInput)
        emailInput.value = localStorage.getItem("savedEmail") || "";
      if (passwordInput)
        passwordInput.value = atob(localStorage.getItem("savedPassword") || "");
    }

    // Toggle hiển thị / ẩn mật khẩu
    togglePasswordBtn?.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      iconEye.classList.toggle("hidden", isPassword);
      iconEyeOff.classList.toggle("hidden", !isPassword);
    });

    // Đăng ký sự kiện submit cho form đăng nhập
    if (loginForm && emailInput && passwordInput) {
      loginForm.addEventListener("submit", handleLoginSubmit);
    }
  };

  init();
}
