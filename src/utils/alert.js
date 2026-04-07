/**
 * Không sử dụng trực tiếp Swal để tránh lỗi khi chưa load xong thư viện, đồng thời áp dụng một số cấu hình chung cho popup và toast.
 * @returns {Swal} Swal instance
 */
const getSwal = () => {
  if (!window.Swal) {
    throw new Error(
      "SweetAlert2 is not loaded. Add CDN script before module scripts.",
    );
  }
  return window.Swal;
};

let _popupInstance = null;
/**
 * Tạo và lưu lại một instance của Swal với cấu hình chung cho popup. Nếu đã tồn tại instance thì trả về instance đó.
 * @returns {Swal} Swal instance đã được cấu hình sẵn cho popup
 */
const getPopup = () => {
  if (_popupInstance) return _popupInstance;
  const Swal = getSwal();
  _popupInstance = Swal.mixin({
    heightAuto: false,
    background: "#ffffff",
    color: "#0f172a",
    buttonsStyling: false,
    customClass: {
      popup:
        "font-['Poppins',sans-serif]! antialiased! rounded-2xl! border! border-slate-100! shadow-xl!",
      title: "text-slate-900! text-2xl! font-bold! tracking-tight!",
      htmlContainer: "text-slate-500! text-sm!",
      confirmButton:
        "inline-flex justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all active:scale-[0.98]",
      cancelButton:
        "inline-flex justify-center rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2 transition-all active:scale-[0.98] mr-4",
    },
  });
  return _popupInstance;
};

let _toastInstance = null;
/**
 * Tạo và lưu lại một instance của Swal với cấu hình chung cho toast. Nếu đã tồn tại instance thì trả về instance đó.
 * @returns {Swal} Swal instance đã được cấu hình sẵn cho toast
 */
const getToast = () => {
  if (_toastInstance) return _toastInstance;
  const Swal = getSwal();
  _toastInstance = Swal.mixin({
    toast: true,
    position: "top-end",
    background: "#ffffff",
    color: "#0f172a",
    showConfirmButton: false,
    timer: 1800,
    timerProgressBar: true,
    customClass: {
      popup:
        "font-['Poppins',sans-serif]! antialiased! rounded-xl! border! border-slate-100! shadow-md! mt-4!",
      title: "text-slate-900! font-medium! text-sm!",
    },
  });
  return _toastInstance;
};

/**
 *  Hiển thị một toast với icon và title. Sử dụng instance đã được cấu hình sẵn cho toast.
 * @param {string} icon - loại icon (success, error, warning, info, question)
 * @param {string} title - nội dung hiển thị trong toast
 * @returns {Promise} Promise của Swal.fire() để có thể xử lý sau khi toast kết thúc nếu cần
 */
export const showToast = (icon, title) => {
  const toast = getToast();
  return toast.fire({
    icon,
    title,
  });
};

/**
 * Đặt một toast vào hàng đợi để hiển thị sau.
 * @param {string} icon - loại icon (success, error, warning, info, question)
 * @param {string} title - nội dung hiển thị trong toast
 */
export const queueToast = (icon, title) => {
  sessionStorage.setItem("_queuedToast", JSON.stringify({ icon, title }));
};

/**
 * Kiểm tra nếu có toast nào trong hàng đợi và hiển thị nó. Sau khi hiển thị, xóa toast khỏi hàng đợi.
 */
export const showQueuedToast = () => {
  const raw = sessionStorage.getItem("_queuedToast");
  if (!raw) return;
  sessionStorage.removeItem("_queuedToast");
  try {
    const { icon, title } = JSON.parse(raw);
    showToast(icon, title);
  } catch {}
};

/**
 * Hiển thị một popup với icon, title và text. Sử dụng instance đã được cấu hình sẵn cho popup.
 * @param {string} icon - loại icon (success, error, warning, info, question)
 * @param {string} title - tiêu đề của popup
 * @param {string} text - nội dung của popup
 * @returns {Promise} của Swal.fire() để có thể xử lý sau khi popup kết thúc nếu cần
 */
export const showPopup = (icon, title, text = "") => {
  const popup = getPopup();
  return popup.fire({
    icon,
    title,
    text,
    confirmButtonText: "Đóng",
  });
};

/**
 * Hiển thị một popup xác nhận với tiêu đề và nội dung.
 * @param {string} title - tiêu đề của popup
 * @param {string} text - nội dung của popup
 * @returns {Promise<boolean>} - true nếu người dùng nhấn đồng ý, false nếu nhấn hủy
 */
export const confirmAction = async (title, text) => {
  const popup = getPopup();
  const result = await popup.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: "Đồng ý",
    cancelButtonText: "Hủy",
    reverseButtons: true,
  });
  return result.isConfirmed;
};

/**
 * Hiển thị một popup với form nhập liệu.
 * @param {string} title - tiêu đề của popup
 * @param {Array} fields - mảng các trường nhập liệu
 * @param {Object} options - các tùy chọn cho popup
 * @returns {Promise} - promise chứa kết quả sau khi đóng popup
 */
export const showFormPopup = async (title, fields, options = {}) => {
  const popup = getPopup();

  /**
   * Hàm phụ để tạo HTML cho từng trường nhập liệu dựa trên loại của nó. Hỗ trợ các loại: text, number, password, email, select và radio.
   * @param {Array} field - đối tượng trường nhập liệu với các thuộc tính như id, label, type, placeholder, value, options, required, validator và errorMessage
   * @returns {string} - HTML string cho trường nhập liệu đó, bao gồm cả phần hiển thị lỗi nếu có
   */
  const generateFieldHTML = (field) => {
    let inputHTML = "";
    const baseInputClass =
      "block w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all sm:text-sm shadow-sm";
    const errorClass =
      "hidden text-xs text-red-500 mt-1.5 text-left font-medium";

    switch (field.type) {
      case "text":
      case "number":
      case "password":
      case "email":
        inputHTML = `<input type="${field.type}" id="swal-input-${field.id}" class="${baseInputClass}" placeholder="${field.placeholder || ""}" value="${field.value !== undefined ? field.value : ""}" />`;
        break;
      case "select":
        const optionsHTML = (field.options || [])
          .map(
            (opt) =>
              `<option value="${opt.value}" ${opt.value == field.value ? "selected" : ""}>${opt.text}</option>`,
          )
          .join("");
        inputHTML = `<select id="swal-input-${field.id}" class="${baseInputClass}">
          ${field.placeholder ? `<option value="" disabled ${field.value === undefined ? "selected" : ""}>${field.placeholder}</option>` : ""}
          ${optionsHTML}
        </select>`;
        break;
      case "radio":
        const radioHTML = (field.options || [])
          .map(
            (opt) => `
          <label class="inline-flex items-center mr-5 cursor-pointer group">
            <input type="radio" name="swal-input-${field.id}" value="${opt.value}" class="peer sr-only" ${opt.value == field.value ? "checked" : ""} />
            <div class="h-4 w-4 rounded-full border border-slate-300 peer-checked:border-[4.5px] peer-checked:border-blue-600 transition-all group-hover:border-blue-400 bg-white shadow-sm"></div>
            <span class="ml-2.5 text-sm text-slate-700 font-medium">${opt.text}</span>
          </label>
        `,
          )
          .join("");
        inputHTML = `<div class="flex items-center mt-2" id="swal-input-${field.id}-group">${radioHTML}</div>`;
        break;
    }

    return `
      <div class="mb-5 text-left">
        <label class="block text-sm font-medium text-slate-700 mb-2">${field.label}</label>
        <div class="relative">
          ${inputHTML}
        </div>
        <div id="swal-error-${field.id}" class="${errorClass}"></div>
      </div>
    `;
  };

  const htmlContent = fields.map(generateFieldHTML).join("");

  /**
   * Hàm preConfirm để validate dữ liệu nhập vào khi người dùng nhấn đồng ý. Kiểm tra các trường bắt buộc và áp dụng validator nếu có. Nếu có lỗi, hiển thị lỗi và không đóng popup. Nếu tất cả hợp lệ, trả về một object chứa giá trị của tất cả các trường.
   * @returns {Object|boolean} - object chứa giá trị của các trường nếu hợp lệ, false nếu có lỗi
   */
  const result = await popup.fire({
    title: title,
    html: `<div class="mt-2">${htmlContent}</div>`,
    showCancelButton: true,
    showCloseButton: true,
    confirmButtonText: options.confirmButtonText || "Thêm",
    cancelButtonText: options.cancelButtonText || "Hủy",
    reverseButtons: true,
    focusConfirm: false,
    customClass: {
      popup:
        "font-['Poppins',sans-serif]! antialiased! rounded-2xl! bg-white! border! border-slate-100! shadow-xl! p-8! w-[500px]!",
      title:
        "text-slate-900! text-2xl! font-bold! tracking-tight! text-center! w-full! m-0! pb-6!",
      htmlContainer: "m-0! p-0!",
      actions:
        "w-full flex! justify-end! mt-8! pt-6! border-t! border-slate-100!",
      confirmButton:
        "inline-flex justify-center flex-1 sm:flex-none rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all active:scale-[0.98]",
      cancelButton:
        "inline-flex justify-center flex-1 sm:flex-none rounded-xl bg-white border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2 transition-all active:scale-[0.98] mr-4",
      closeButton:
        "focus:outline-none! absolute! top-6! right-6! text-slate-400! hover:text-slate-600! bg-white! border! border-slate-200! rounded-lg! p-1.5! hover:bg-slate-50! transition-colors!",
    },
    preConfirm: () => {
      const values = {};
      let hasError = false;

      fields.forEach((field) => {
        let val;
        let inputEl;

        if (field.type === "radio") {
          const checkedRadio = document.querySelector(
            `input[name="swal-input-${field.id}"]:checked`,
          );
          val = checkedRadio ? checkedRadio.value : "";
          inputEl = document.getElementById(`swal-input-${field.id}-group`);
        } else {
          inputEl = document.getElementById(`swal-input-${field.id}`);
          val = inputEl ? inputEl.value : "";
        }

        const errorEl = document.getElementById(`swal-error-${field.id}`);

        if (inputEl && field.type !== "radio") {
          inputEl.classList.remove(
            "border-red-500",
            "focus:ring-red-500",
            "text-red-900",
          );
          inputEl.classList.add("border-slate-200", "focus:ring-blue-500");
        }
        if (errorEl) {
          errorEl.classList.add("hidden");
        }

        if (field.required && (!val || !val.toString().trim())) {
          hasError = true;
          if (inputEl && field.type !== "radio") {
            inputEl.classList.remove("border-slate-200", "focus:ring-blue-500");
            inputEl.classList.add(
              "border-red-500",
              "focus:ring-red-500",
              "text-red-900",
            );
          }
          if (errorEl) {
            errorEl.classList.remove("hidden");
            errorEl.innerText =
              field.errorMessage || `${field.label} không được để trống`;
          }
        } else if (field.validator) {
          const isValid = field.validator(val);
          if (isValid !== true) {
            hasError = true;
            if (inputEl && field.type !== "radio") {
              inputEl.classList.remove(
                "border-slate-200",
                "focus:ring-blue-500",
              );
              inputEl.classList.add(
                "border-red-500",
                "focus:ring-red-500",
                "text-red-900",
              );
            }
            if (errorEl) {
              errorEl.classList.remove("hidden");
              errorEl.innerText =
                typeof isValid === "string"
                  ? isValid
                  : field.errorMessage || "Giá trị không hợp lệ";
            }
          }
        }

        values[field.id] = val;
      });

      if (hasError) {
        return false;
      }

      return values;
    },
  });

  return result;
};
