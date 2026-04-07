import { dataServices } from "../services/dataServices.js";
import { requireAuth } from "../guards/requireAuth.js";
import { sessionStorage } from "../core/storage.js";
import { formatTime } from "../utils/format.js";
import {
  showPopup,
  showQueuedToast,
  confirmAction,
  showFormPopup,
  showToast,
} from "../utils/alert.js";
import { bindLogout } from "../shared/bindLogout.js";

// Giới hạn tần suất gọi hàm khi người dùng nhập liệu
/**
 * Debounce - Hàm giúp giới hạn tần suất gọi một hàm khi người dùng thực hiện các hành động liên tục (như nhập liệu)
 * @param {Function} fn - Hàm cần debounce
 * @param {number} delay - Thời gian chờ sau lần gọi cuối cùng (ms)
 * @returns {Function} Hàm đã được debounce
 */
const debounce = (fn, delay = 250) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// Cập nhật một tham số trên URL hiện tại mà không reload trang
/**
 * updateUrl - Cập nhật tham số trên URL mà không reload trang
 * @param {string} key - Tên tham số cần cập nhật
 * @param {string} value - Giá trị mới của tham số (nếu là falsy hoặc "all" sẽ xóa tham số khỏi URL)
 */
const updateUrl = (key, value) => {
  const url = new URL(window.location);
  if (value && value !== "all") {
    url.searchParams.set(key, value);
  } else {
    url.searchParams.delete(key);
  }
  window.history.pushState({}, "", url);
};

// Tính ID tiếp theo dựa trên mảng đã có
/**
 * getNextId - Tính ID tiếp theo dựa trên mảng đã có
 * @param {Array} arr - Mảng đối tượng có thuộc tính id
 * @returns {number} ID tiếp theo (max ID hiện tại + 1) hoặc 1 nếu mảng rỗng
 */
const getNextId = (arr) =>
  arr.length > 0 ? arr.reduce((max, item) => Math.max(max, item.id), 0) + 1 : 1;

if (requireAuth("../../pages/loginPage.html")) {
  showQueuedToast();

  // --- DOM Elements ---
  const listTableBody = document.querySelector("#list-table-body");
  const profileBtn = document.querySelector("#profile-btn");
  const profileDropdown = document.querySelector("#profile-dropdown");
  const profileCloseBtn = document.querySelector("#profile-close-btn");
  const profileName = document.querySelector("#profile-name");
  const profileImg = document.querySelector("#profile-img");
  const searchInput = document.querySelector("#search-input");
  const filterInput = document.querySelector("#filter-input");
  const addBtn = document.querySelector("#add-btn");
  const navBar = document.querySelector("#nav-bar");
  const subjectPageBtn = document.querySelector("#subject-page");
  const lessonPageBtn = document.querySelector("#lesson-page");
  const pageTitle = document.querySelector("#page-title");
  const nameHeader = document.querySelector("#name-header");
  const durationHeader = document.querySelector("#duration-header");
  const checkCompleteHeader = document.querySelector("#check-complete-header");
  const logo = document.querySelector("#logo");

  // --- State Variables ---
  let subjects = [];
  let lessons = [];
  let currentUser = null;
  let currentTab = localStorage.getItem("currentTab") || "subject";
  let currentPage = 1;
  let currentSort = { field: null, order: "asc" };
  const itemsPerPage = 10;

  const STATUS_CONFIG = {
    active: {
      label: "Đang hoạt động",
      bg: "bg-[#E8F5E9] text-[#2E7D32]",
      dot: "bg-[#4CAF50]",
    },
    completed: {
      label: "Đã hoàn thành",
      bg: "bg-[#E8F5E9] text-[#2E7D32]",
      dot: "bg-[#4CAF50]",
    },
    inactive: {
      label: "Ngừng hoạt động",
      bg: "bg-[#FFF3E0] text-[#E65100]",
      dot: "bg-[#FF9800]",
    },
    incomplete: {
      label: "Chưa hoàn thành",
      bg: "bg-[#FFF3E0] text-[#E65100]",
      dot: "bg-[#FF9800]",
    },
  };

  // Hàm tạo HTML cho trạng thái với màu sắc và nhãn tương ứng
  const getStatusHTML = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
    return `
      <span class="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-[11px] font-semibold ${config.bg}">
        <span class="w-1.5 h-1.5 rounded-full ${config.dot}"></span>
        ${config.label}
      </span>
    `;
  };

  // Hàm tạo HTML cho các nút hành động (sửa, xóa) với data-id để dễ dàng xử lý sự kiện
  const createActionButtons = (id) => `
    <div class="flex items-center justify-center gap-4">
      <button class="delete-btn text-red-500 hover:text-red-700 transition-colors" data-id="${id}" aria-label="Xóa">
        <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
      </button>
      <button class="edit-btn text-orange-400 hover:text-orange-500 transition-colors" data-id="${id}" aria-label="Sửa">
        <i data-lucide="pencil" class="w-4 h-4 pointer-events-none"></i>
      </button>
    </div>
  `;

  // Hàm tạo HTML cho mỗi dòng trong bảng, tùy thuộc vào tab hiện tại (môn học hay bài học) và trạng thái của bài học
  const createCardHTML = (item) => {
    const isSubject = currentTab === "subject";
    const name = isSubject ? item.subject_name : item.lesson_name;

    return `
      <tr class="border-b border-gray-100 ${!isSubject ? (item.status === "completed" ? "bg-green-50" : item.status === "incomplete" ? "bg-orange-50" : "") : ""}">
        ${!isSubject ? `<td class="py-3 px-3 text-center"><input type="checkbox" ${item.status === "completed" ? "checked" : ""} class="check h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 accent-green-500" ${"data-id=" + `"${item.id}"`}></td>` : ""}
        <td class="subject-name py-3 px-3 font-medium text-gray-700 hover:underline cursor-pointer" ${isSubject ? "data-id=" + `"${item.id}"` : ""}>${name}</td>
        ${!isSubject ? `<td class="py-3 px-3 font-medium text-gray-700 hover:underline cursor-pointer text-center">${formatTime(item.time) || "00:00"}</td>` : ""}
        <td class="py-3 px-3 text-center">${getStatusHTML(item.status)}</td>
        <td class="py-3 px-3 text-center">${createActionButtons(item.id)}</td>
      </tr>
    `;
  };

  // Hàm tạo mảng số trang để hiển thị phân trang, với logic ẩn hiện các trang khi có nhiều trang
  const generatePagination = (current, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
    if (current >= total - 3)
      return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
  };

  // Hàm render lại dữ liệu và phân trang dựa trên trạng thái hiện tại, từ khóa tìm kiếm, bộ lọc và sắp xếp
  const renderPages = (totalPages) => {
    const pagesContainer = document.querySelector("#page-container");
    if (!pagesContainer) return;

    if (totalPages <= 0) {
      pagesContainer.innerHTML = "";
      return;
    }

    const pageNumbers = generatePagination(currentPage, totalPages);
    pagesContainer.innerHTML = `
      <button class="prev-page w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage === 1 ? "disabled" : ""}>
        <i data-lucide="arrow-left" class="w-4 h-4 pointer-events-none"></i>
      </button>
      ${pageNumbers
        .map((page) => {
          if (page === "...") {
            return `<span class="w-8 h-8 flex items-center justify-center text-gray-400">...</span>`;
          }
          const isActive = page === currentPage;
          return `
          <button class="page-btn w-8 h-8 flex items-center justify-center rounded border ${isActive ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"} text-sm" data-page="${page}">
            ${page}
          </button>
        `;
        })
        .join("")}
      <button class="next-page w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage === totalPages ? "disabled" : ""}>
        <i data-lucide="arrow-right" class="w-4 h-4 pointer-events-none"></i>
      </button>
    `;
  };

  // Hàm render lại dữ liệu dựa trên tab hiện tại, từ khóa tìm kiếm, bộ lọc và sắp xếp. Nếu resetPage=true sẽ đặt lại trang về 1
  const renderData = (resetPage = false) => {
    if (resetPage) currentPage = 1;

    const keyword = searchInput.value.toLowerCase().trim();
    const filterValue = filterInput.value;
    const isSubject = currentTab === "subject";

    let dataToRender = isSubject ? subjects : lessons;

    // Lọc theo từ khóa tìm kiếm nếu có và chỉ áp dụng cho tab môn học
    if (keyword && isSubject) {
      dataToRender = dataToRender.filter((item) =>
        (isSubject ? item.subject_name : item.lesson_name)
          .toLowerCase()
          .includes(keyword),
      );
    }

    // Lọc theo trạng thái hoặc môn học nếu có
    if (filterValue && filterValue !== "all") {
      dataToRender = dataToRender.filter((item) =>
        isSubject
          ? item.status === filterValue
          : String(item.subject_id) === filterValue,
      );
    }

    // Sắp xếp dữ liệu nếu có trường sắp xếp được chọn
    if (currentSort.field) {
      dataToRender.sort((a, b) => {
        let valA, valB;
        if (currentSort.field === "name") {
          valA = (isSubject ? a.subject_name : a.lesson_name).toLowerCase();
          valB = (isSubject ? b.subject_name : b.lesson_name).toLowerCase();
        } else if (currentSort.field === "time" && !isSubject) {
          valA = Number(a.time) || 0;
          valB = Number(b.time) || 0;
        } else {
          return 0;
        }
        // Nếu là sắp xếp theo tên thì so sánh chuỗi, nếu là sắp xếp theo thời gian thì so sánh số
        // Trả về -1, 0, 1 tùy theo thứ tự và hướng sắp xếp
        // - 1 nếu a đứng trước b, 1 nếu a đứng sau b, 0 nếu bằng nhau
        if (valA < valB) return currentSort.order === "asc" ? -1 : 1;
        if (valA > valB) return currentSort.order === "asc" ? 1 : -1;
        return 0;
      });
    }

    const totalItems = dataToRender.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = dataToRender.slice(
      startIndex,
      startIndex + itemsPerPage,
    );

    listTableBody.innerHTML = paginatedData.map(createCardHTML).join("");
    renderPages(totalPages);
    updateSortHeaders();

    if (window.lucide) lucide.createIcons({ nodes: [listTableBody] });
  };

  // Hàm cập nhật lại tiêu đề cột sắp xếp với biểu tượng mũi tên lên/xuống tùy theo trạng thái sắp xếp hiện tại
  const updateSortHeaders = () => {
    const isSubject = currentTab === "subject";
    const renderSortIcon = (field) => {
      if (currentSort.field !== field)
        return `<i data-lucide="arrow-down-up" class="w-3.5 h-3.5 text-gray-400"></i>`;
      return currentSort.order === "asc"
        ? `<i data-lucide="arrow-up" class="w-3.5 h-3.5 text-blue-500"></i>`
        : `<i data-lucide="arrow-down" class="w-3.5 h-3.5 text-blue-500"></i>`;
    };

    if (nameHeader) {
      nameHeader.innerHTML = `<span class="cursor-pointer flex items-center justify-center gap-1 hover:text-blue-500 transition-colors">${isSubject ? "Tên môn học" : "Tên bài học"} ${renderSortIcon("name")}</span>`;
    }

    if (durationHeader) {
      durationHeader.innerHTML = `<div class="flex justify-center items-center gap-1 cursor-pointer hover:text-blue-500 transition-colors">Thời gian học ${renderSortIcon("time")}</div>`;
    }
    if (window.lucide)
      lucide.createIcons({ nodes: [nameHeader, durationHeader] });
  };

  // Hàm cập nhật giao diện khi chuyển tab giữa môn học và bài học, bao gồm thay đổi tiêu đề, nút thêm mới, placeholder tìm kiếm, ẩn hiện cột và bộ lọc tương ứng
  const updateUIForTab = (resetPage = false) => {
    const isSubject = currentTab === "subject";
    const activeBtn = isSubject ? subjectPageBtn : lessonPageBtn;
    const inactiveBtn = isSubject ? lessonPageBtn : subjectPageBtn;

    activeBtn.classList.add("bg-[#E6F0FF]", "text-blue-600");
    activeBtn.classList.remove("text-gray-600", "hover:bg-gray-200/50");
    activeBtn.querySelector("div").classList.add("text-blue-600");

    inactiveBtn.classList.add("text-gray-600", "hover:bg-gray-200/50");
    inactiveBtn.classList.remove("bg-[#E6F0FF]", "text-blue-600");
    inactiveBtn.querySelector("div").classList.remove("text-blue-600");

    if (pageTitle) pageTitle.textContent = isSubject ? "Môn học" : "Bài học";
    if (addBtn)
      addBtn.textContent = isSubject ? "Thêm mới môn học" : "Thêm mới bài học";
    if (searchInput) {
      searchInput.placeholder = isSubject
        ? "Tìm kiếm môn học theo tên..."
        : "Tìm kiếm bài học theo tên...";
      searchInput.classList.toggle("hidden", !isSubject);
    }

    durationHeader?.classList.toggle("hidden", isSubject);
    checkCompleteHeader?.classList.toggle("hidden", isSubject);

    filterInput.innerHTML = isSubject
      ? `
        <option value="" class="hidden">Lọc theo trạng thái</option>
        <option value="all">Tất cả</option>
        <option value="active">Đang hoạt động</option>
        <option value="inactive">Ngừng hoạt động</option>
      `
      : `
        <option value="" class="hidden">Lọc theo môn học</option>
        <option value="all">Tất cả</option>
        ${subjects.map((s) => `<option value="${s.id}">${s.subject_name}</option>`).join("")}
      `;

    renderData(resetPage);
  };

  // Hàm xử lý khi người dùng nhấn nút xóa, sẽ hiển thị popup xác nhận và nếu đồng ý sẽ xóa môn học hoặc bài học tương ứng, đồng thời cập nhật lại dữ liệu và giao diện
  const handleDeleteItem = async (id) => {
    const isSubject = currentTab === "subject";
    const confirmed = await confirmAction(
      `Bạn có chắc chắn muốn xóa ${isSubject ? "môn học" : "bài học"} này?`,
    );
    if (!confirmed) return;

    if (isSubject) {
      subjects = subjects.filter((s) => s.id !== id);
      dataServices.saveSubjectDataByUserId(currentUser.id, subjects);
      // Khi xóa môn học, bài học liên quan thường được xử lý ở đây nếu chúng ta lưu tất cả lessons
      // Tuy nhiên, lessons ở đây chỉ là lessons của user hiện tại.
      lessons = lessons.filter((l) => l.subject_id !== id);
      dataServices.saveLessonDataByUserId(currentUser.id, lessons);
    } else {
      lessons = lessons.filter((l) => l.id !== id);
      dataServices.saveLessonDataByUserId(currentUser.id, lessons);
    }
    showToast("success", "Xóa thành công!");
    renderData();
  };

  const generateFormFields = (isSubject, isEdit = false, item = null) => {
    return isSubject
      ? [
          {
            id: "itemName",
            label: "Tên môn học",
            type: "text",
            value: isEdit ? item.subject_name : undefined,
            required: true,
            errorMessage: "Tên môn học không được để trống",
            validator: (val) => {
              if (
                subjects.some(
                  (s) =>
                    s.subject_name.toLowerCase() === val.toLowerCase() &&
                    (!isEdit || s.id !== item.id),
                )
              ) {
                return "Tên môn học đã tồn tại";
              }
              return true;
            },
          },
          {
            id: "status",
            label: "Trạng thái",
            type: "radio",
            options: [
              { text: "Đang hoạt động", value: "active" },
              { text: "Ngừng hoạt động", value: "inactive" },
            ],
            value: isEdit ? item.status : "active",
          },
        ]
      : [
          {
            id: "itemName",
            label: "Tên bài học",
            type: "text",
            value: isEdit ? item.lesson_name : undefined,
            required: true,
            errorMessage: "Tên bài học không được để trống",
            validator: (val) => {
              if (
                lessons.some(
                  (l) =>
                    l.lesson_name.toLowerCase() === val.toLowerCase() &&
                    (!isEdit || l.id !== item.id),
                )
              ) {
                return "Tên bài học đã tồn tại";
              }
              return true;
            },
          },
          {
            id: "subjectId",
            label: "Thuộc môn học",
            type: "select",
            options: subjects.map((s) => ({
              text: s.subject_name,
              value: String(s.id),
            })),
            value: isEdit ? String(item.subject_id) : undefined,
            required: true,
            errorMessage: "Vui lòng chọn môn học",
          },
          {
            id: "itemTime",
            label: "Thời gian",
            type: "number",
            value: isEdit ? item.time : undefined,
            required: true,
            errorMessage: "Thời gian không được để trống",
            validator: (val) => {
              const time = Number(val);
              if (isNaN(time) || time <= 0) return "Thời gian phải lớn hơn 0";
              return true;
            },
          },
        ];
  };

  // Hàm xử lý khi người dùng nhấn nút sửa, sẽ hiển thị popup với form để chỉnh sửa thông tin môn học hoặc bài học, sau đó cập nhật lại dữ liệu và giao diện nếu có thay đổi
  const handleEditItem = async (id) => {
    const isSubject = currentTab === "subject";
    const item = isSubject
      ? subjects.find((s) => s.id === id)
      : lessons.find((l) => l.id === id);

    if (!item) return;

    const formFields = generateFormFields(isSubject, true, item);

    const formValues = await showFormPopup(
      `Sửa ${isSubject ? "môn học" : "bài học"}`,
      formFields,
      { confirmButtonText: "Cập nhật", cancelButtonText: "Hủy" },
    );

    if (formValues) {
      if (isSubject) {
        Object.assign(item, {
          subject_name: formValues.value.itemName,
          status: formValues.value.status,
        });
        dataServices.saveSubjectDataByUserId(currentUser.id, subjects);
      } else {
        Object.assign(item, {
          lesson_name: formValues.value.itemName,
          subject_id: parseInt(formValues.value.subjectId, 10),
          time: formValues.value.itemTime,
        });
        dataServices.saveLessonDataByUserId(currentUser.id, lessons);
      }

      showToast("success", "Cập nhật thành công!");
      if (isSubject && currentTab === "lesson") updateUIForTab(true);
      renderData();
    }
  };

  // Hàm xử lý khi người dùng nhấn nút thêm mới, sẽ hiển thị popup với form để nhập thông tin môn học hoặc bài học mới, sau đó thêm vào dữ liệu và cập nhật giao diện
  const handleAddItem = async () => {
    const isSubject = currentTab === "subject";

    if (!isSubject && subjects.length === 0) {
      return showPopup(
        "warning",
        "Chưa có môn học",
        "Vui lòng thêm môn học trước khi thêm bài học.",
      );
    }

    const formFields = generateFormFields(isSubject, false);

    // Hiển thị form popup để nhập thông tin mới, nếu có giá trị trả về thì thêm vào dữ liệu và cập nhật giao diện
    const formValues = await showFormPopup(
      `Thêm mới ${isSubject ? "môn học" : "bài học"}`,
      formFields,
      { confirmButtonText: "Thêm", cancelButtonText: "Hủy" },
    );

    if (formValues) {
      if (isSubject) {
        subjects.unshift({
          id: getNextId(subjects),
          user_id: currentUser.id,
          subject_name: formValues.value.itemName,
          status: formValues.value.status,
          created_at: new Date().toISOString(),
        });
        dataServices.saveSubjectDataByUserId(currentUser.id, subjects);
      } else {
        lessons.unshift({
          id: getNextId(lessons),
          user_id: currentUser.id,
          subject_id: parseInt(formValues.value.subjectId, 10),
          lesson_name: formValues.value.itemName,
          time: formValues.value.itemTime || "00:00",
          status: "incomplete",
          created_at: new Date().toISOString(),
          duration: "00:00",
        });
        dataServices.saveLessonDataByUserId(currentUser.id, lessons);
      }

      showToast("success", "Thêm mới thành công!");
      if (isSubject && currentTab === "lesson") updateUIForTab(true);
      renderData();
    }
  };

  // --- Event Listeners ---
  // Xử lý sự kiện khi người dùng nhấn vào thanh điều hướng để chuyển tab giữa môn học và bài học
  // đồng thời reset trạng thái sắp xếp và cập nhật URL để xóa các tham số liên quan đến bộ lọc khi chuyển tab
  navBar.addEventListener("click", (e) => {
    if (e.target.closest("#subject-page")) {
      currentTab = "subject";
    } else if (e.target.closest("#lesson-page")) {
      currentTab = "lesson";
    } else {
      return;
    }
    currentSort = { field: null, order: "asc" };
    const url = new URL(window.location);
    url.searchParams.delete("subjectId");
    window.history.pushState({}, "", url);
    localStorage.setItem("currentTab", currentTab);
    updateUIForTab(true);
  });

  // Xử lý sự kiện khi người dùng nhấn vào các nút trong bảng
  // bao gồm checkbox để đánh dấu hoàn thành bài học, tên môn học để xem chi tiết bài học, nút xóa và nút sửa
  listTableBody.addEventListener("click", (e) => {
    const isSubject = currentTab === "subject";
    const deleteBtn = e.target.closest(".delete-btn");
    const editBtn = e.target.closest(".edit-btn");

    if (!isSubject) {
      const checkBox = e.target.closest(".check");
      if (checkBox) {
        const lessonId = parseInt(checkBox.dataset.id, 10);
        const lesson = lessons.find((l) => l.id === lessonId);
        if (lesson) {
          lesson.status = checkBox.checked ? "completed" : "incomplete";
          dataServices.saveLessonDataByUserId(currentUser.id, lessons);
          renderData();
        }
        return;
      }
    } else {
      const nameCell = e.target.closest(".subject-name");
      if (nameCell) {
        const subjectId = parseInt(nameCell.dataset.id, 10);
        currentTab = "lesson";
        currentSort = { field: null, order: "asc" };
        localStorage.setItem("currentTab", currentTab);
        updateUrl("subjectId", String(subjectId));
        updateUIForTab(true);
        filterInput.value = String(subjectId);
        renderData(true);
        return;
      }
    }

    if (deleteBtn) {
      handleDeleteItem(parseInt(deleteBtn.dataset.id, 10));
    } else if (editBtn) {
      handleEditItem(parseInt(editBtn.dataset.id, 10));
    }
  });

  // Hàm xử lý khi người dùng nhấn vào tiêu đề cột để sắp xếp dữ liệu theo tên hoặc thời gian
  // sẽ toggle giữa sắp xếp tăng dần và giảm dần nếu nhấn cùng một cột, hoặc chuyển sang sắp xếp theo cột mới nếu nhấn cột khác
  const handleSort = (field) => {
    if (currentSort.field === field) {
      currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
    } else {
      currentSort.field = field;
      currentSort.order = "asc";
    }
    renderData();
  };

  if (nameHeader) {
    nameHeader.addEventListener("click", () => handleSort("name"));
  }

  if (durationHeader) {
    durationHeader.addEventListener("click", () => handleSort("time"));
  }

  logo.addEventListener("click", () => {
    window.location.href = "../../index.html";
  });

  if (addBtn) addBtn.addEventListener("click", handleAddItem);

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce(() => renderData(true), 250),
    );
  }

  if (filterInput) {
    filterInput.addEventListener("change", (e) => {
      const key = currentTab === "lesson" ? "subjectId" : "status";
      updateUrl(key, e.target.value);
      renderData(true);
    });
  }

  // Xử lý sự kiện khi người dùng nhấn vào phân trang để chuyển trang, bao gồm nút trang cụ thể, nút trang trước và nút trang sau
  const pagesContainer = document.querySelector("#page-container");
  if (pagesContainer) {
    pagesContainer.addEventListener("click", (e) => {
      const pageBtn = e.target.closest(".page-btn");
      const prevBtn = e.target.closest(".prev-page");
      const nextBtn = e.target.closest(".next-page");

      if (pageBtn) {
        currentPage = parseInt(pageBtn.dataset.page, 10);
      } else if (prevBtn && currentPage > 1) {
        currentPage--;
      } else if (nextBtn) {
        currentPage++;
      } else {
        return;
      }
      renderData();
    });
  }

  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle("hidden");
    });

    profileCloseBtn?.addEventListener("click", () => {
      profileDropdown.classList.add("hidden");
    });

    document.addEventListener("click", (e) => {
      if (
        !profileBtn.contains(e.target) &&
        !profileDropdown.contains(e.target)
      ) {
        profileDropdown.classList.add("hidden");
      }
    });
  }

  bindLogout("#logout-btn");

  const init = async () => {
    try {
      currentUser = await dataServices.getCurrentUser();
      if (currentUser) {
        const fullName = `${currentUser.first_name} ${currentUser.last_name}`;
        const avatarUrl = currentUser.avatar;
        if (profileName) profileName.textContent = fullName;
        if (profileImg) profileImg.src = avatarUrl;

        const headerProfileImg = document.querySelector("#profile-btn img");
        if (headerProfileImg) headerProfileImg.src = avatarUrl;

        [subjects, lessons] = await Promise.all([
          dataServices.getSubjectDataByUserId(currentUser.id),
          dataServices.getLessonDataByUserId(currentUser.id),
        ]);
      }

      const urlParams = new URLSearchParams(window.location.search);
      const subjectIdParam = urlParams.get("subjectId");
      const statusParam = urlParams.get("status");

      if (subjectIdParam) {
        currentTab = "lesson";
        localStorage.setItem("currentTab", "lesson");
        updateUIForTab(true);
        filterInput.value = subjectIdParam;
        renderData(true);
      } else if (statusParam) {
        currentTab = "subject";
        localStorage.setItem("currentTab", "subject");
        updateUIForTab(true);
        filterInput.value = statusParam;
        renderData(true);
      } else {
        updateUIForTab(true);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      showPopup("error", "Lỗi tải dữ liệu", "Vui lòng thử tải lại trang.");
    }
  };

  init();
}
