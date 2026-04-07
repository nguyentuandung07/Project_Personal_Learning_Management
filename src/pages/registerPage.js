import { authServices } from "../services/authServices.js";
import { requireAuth } from "../guards/requireAuth.js";
import { queueToast, showQueuedToast } from "../utils/alert.js";

if (requireAuth("../../pages/loginPage.html", true)) {
  showQueuedToast();

  // --- DOM Elements ---
  const registerForm = document.getElementById("register-form");
  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const checkPolicy = document.getElementById("check-policy");
  const policiesAndTermsLink = document.getElementById("policies-and-terms");
  const togglePasswordBtn = document.getElementById("toggle-password");
  const iconEyePassword = document.getElementById("icon-eye-password");
  const iconEyeOffPassword = document.getElementById("icon-eye-off-password");
  const toggleConfirmBtn = document.getElementById("toggle-confirm-password");
  const iconEyeConfirm = document.getElementById("icon-eye-confirm");
  const iconEyeOffConfirm = document.getElementById("icon-eye-off-confirm");

  // Error elements
  const errorFirstName = document.getElementById("error-firstName");
  const errorLastName = document.getElementById("error-lastName");
  const errorEmail = document.getElementById("error-email");
  const errorPassword = document.getElementById("error-password");
  const errorConfirmPassword = document.getElementById("error-confirmPassword");
  const errorPolicy = document.getElementById("error-policy");

  policiesAndTermsLink?.addEventListener("click", (e) => e.preventDefault());

  const showFieldError = (errorEl, message, inputEl) => {
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove("hidden");
    }
    if (inputEl) inputEl.classList.add("border-red-400");
  };

  const clearErrors = () => {
    [
      errorFirstName,
      errorLastName,
      errorEmail,
      errorPassword,
      errorConfirmPassword,
      errorPolicy,
    ].forEach((el) => {
      if (el) {
        el.textContent = "";
        el.classList.add("hidden");
      }
    });
    [
      firstNameInput,
      lastNameInput,
      emailInput,
      passwordInput,
      confirmPasswordInput,
    ].forEach((el) => el?.classList.remove("border-red-400"));
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    clearErrors();

    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    // Validate từng field — dừng nếu có lỗi
    let hasError = false;
    if (!firstName) {
      showFieldError(
        errorFirstName,
        "Họ và tên đệm không được để trống",
        firstNameInput,
      );
      hasError = true;
    }
    if (!lastName) {
      showFieldError(errorLastName, "Tên không được để trống", lastNameInput);
      hasError = true;
    }
    if (!email) {
      showFieldError(errorEmail, "Email không được để trống", emailInput);
      hasError = true;
    }
    if (!password) {
      showFieldError(
        errorPassword,
        "Mật khẩu không được để trống",
        passwordInput,
      );
      hasError = true;
    }
    if (!confirmPassword) {
      showFieldError(
        errorConfirmPassword,
        "Xác nhận mật khẩu không được để trống",
        confirmPasswordInput,
      );
      hasError = true;
    }
    if (!checkPolicy.checked) {
      showFieldError(
        errorPolicy,
        "Bạn phải đồng ý với chính sách để đăng ký tài khoản",
      );
      hasError = true;
    }
    if (hasError) return;

    try {
      const result = await authServices.register(
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
      );

      if (!result.ok) {
        const msg = result.message || "Đăng ký thất bại";
        const msgLower = msg.toLowerCase();
        if (msgLower.includes("email")) {
          showFieldError(errorEmail, msg, emailInput);
        } else if (
          msgLower.includes("mật khẩu") ||
          msgLower.includes("password")
        ) {
          showFieldError(errorPassword, msg, passwordInput);
        } else if (
          msgLower.includes("xác nhận") ||
          msgLower.includes("confirm")
        ) {
          showFieldError(errorConfirmPassword, msg, confirmPasswordInput);
        } else if (msgLower.includes("họ và tên đệm")) {
          showFieldError(errorFirstName, msg, firstNameInput);
        } else if (msgLower.includes("tên")) {
          showFieldError(errorLastName, msg, lastNameInput);
        } else {
          showFieldError(errorEmail, msg, emailInput);
        }
        return;
      }

      registerForm.reset();
      queueToast("success", "Đăng ký tài khoản thành công!");
      window.location.href = "../../pages/loginPage.html";
    } catch (error) {
      console.error("Register error:", error);
      showFieldError(errorEmail, "Đã xảy ra lỗi khi đăng ký tài khoản");
    }
  };

  togglePasswordBtn?.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    iconEyePassword.classList.toggle("hidden", isPassword);
    iconEyeOffPassword.classList.toggle("hidden", !isPassword);
  });

  toggleConfirmBtn?.addEventListener("click", () => {
    const isPassword = confirmPasswordInput.type === "password";
    confirmPasswordInput.type = isPassword ? "text" : "password";
    iconEyeConfirm.classList.toggle("hidden", isPassword);
    iconEyeOffConfirm.classList.toggle("hidden", !isPassword);
  });

  registerForm?.addEventListener("submit", handleRegisterSubmit);
}
