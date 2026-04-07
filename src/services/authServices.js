import { sessionStorage } from "../core/storage.js";
import { dataServices } from "./dataServices.js";
import { jwt } from "../utils/jwt.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

const validateBasicCredentials = (email, password) => {
  if (!email || !password) return "Email và mật khẩu không được để trống";
  if (!emailRegex.test(email)) return "Email không hợp lệ";
  if (password.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự";
  if (!passwordRegex.test(password)) return "Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ cái và số";
  return "";
};

export const authServices = {
  /**
   * Xác thực định dạng email và mật khẩu cho Login
   * @param {string} email
   * @param {string} password
   */
  validateCredentialsForLogin(email, password) {
    return validateBasicCredentials(email, password);
  },

  /**
   * Xác thực form Register
   */
  validateCredentialsForRegister(email, password, confirmPassword, firstName, lastName) {
    if (!firstName) return "Họ và tên đệm không được để trống";
    if (!lastName) return "Tên không được để trống";
    
    // Explicit checks before running base validation
    if (!email) return "Email không được để trống";
    if (!password) return "Mật khẩu không được để trống";

    const baseError = validateBasicCredentials(email, password);
    if (baseError) return baseError;

    if (password !== confirmPassword) return "Mật khẩu và xác nhận mật khẩu không khớp";
    return "";
  },

  /**
   * Đăng nhập người dùng.
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    const validationError = this.validateCredentialsForLogin(email, password);
    if (validationError) return { ok: false, message: validationError };

    const userData = await dataServices.getUserData();
    const matchedAdmin = userData.find((admin) => admin.email === email);

    if (!matchedAdmin) return { ok: false, message: "Sai email hoặc mật khẩu" };

    const passwordValid = await jwt.checkPassword(password, matchedAdmin.password);
    if (!passwordValid) return { ok: false, message: "Sai email hoặc mật khẩu" };

    const sessionToken = await jwt.sign(
      { sub: matchedAdmin.email, name: matchedAdmin.last_name },
      8 * 3600,
    );
    sessionStorage.setSession(sessionToken, { name: matchedAdmin.last_name });

    return { ok: true };
  },

  /**
   * Đăng ký người dùng mới.
   */
  async register(email, password, confirmPassword, firstName, lastName) {
    const validationError = this.validateCredentialsForRegister(
      email, password, confirmPassword, firstName, lastName
    );
    if (validationError) return { ok: false, message: validationError };

    const userData = await dataServices.getUserData();
    if (!Array.isArray(userData)) return { ok: false, message: "Lỗi hệ thống" };
    if (userData.some((user) => user.email === email)) return { ok: false, message: "Email đã tồn tại" };

    const hashedPassword = await jwt.hashPassword(password);
    const fullName = `${firstName} ${lastName}`;
    const randomColor = Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=${randomColor}&color=fff`;

    const newUser = {
      id: userData.length > 0 ? userData[userData.length - 1].id + 1 : 1,
      first_name: firstName,
      last_name: lastName,
      avatar: avatarUrl,
      email,
      password: hashedPassword,
      created_at: new Date().toISOString(),
    };

    userData.push(newUser);
    dataServices.saveUserData(userData);
    return { ok: true };
  },

  logout() {
    sessionStorage.clearSession();
  },
};
