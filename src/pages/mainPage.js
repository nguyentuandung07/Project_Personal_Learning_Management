import { dataServices } from "../services/dataServices.js";
import { requireAuth } from "../guards/requireAuth.js";
import { showPopup, showQueuedToast } from "../utils/alert.js";
import { sessionStorage } from "../core/storage.js";
import { bindLogout } from "../shared/bindLogout.js";

if (requireAuth("../../pages/loginPage.html")) {
  showQueuedToast();

  // --- DOM Elements ---
  const subjectContainer = document.querySelector("#subjects-container");
  const searchInput = document.querySelector("#search-input");
  const navSubjects = document.querySelector("#nav-subjects");
  const navLessons = document.querySelector("#nav-lessons");
  const completedTab = document.querySelector("#completed-tab");
  const incompleteTab = document.querySelector("#incomplete-tab");
  const allTab = document.querySelector("#all-tab");
  const profileBtn = document.querySelector("#profile-btn");
  const profileDropdown = document.querySelector("#profile-dropdown");
  const profileName = document.querySelector("#profile-name");
  const profileImg = document.querySelector("#profile-img");

  // --- Constants & State ---
  const BATCH_SIZE = 15;
  const SKELETON_COUNT = 3;
  const ANIMATION_STAGGER_MS = 80;
  const SKELETON_DISPLAY_MS = 300;
  const MAX_VISIBLE_LESSONS = 6;
  const DEBOUNCE_MS = 300;

  let currentIndex = 0;
  let isLoading = false;
  let allCards = [];
  let masterCards = [];
  let debounceTimer = null;
  let scrollObserver = null;
  let currentTab = "all";

  const ACTIVE_TAB_CLASS =
    "border-blue-500 text-blue-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm";
  const INACTIVE_TAB_CLASS =
    "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors cursor-pointer";

  /**
   * Tạo HTML cho thẻ card dựa trên dữ liệu của môn học
   * @param {Object} param0 - Dữ liệu của môn học
   * @param {string} param0.subject_id - ID của môn học
   * @param {string} param0.subject_name - Tên của môn học
   * @param {Array} param0.lessons - Danh sách bài học của môn học
   * @returns {string} HTML chuỗi đại diện cho thẻ card
   */
  const createCardHTML = ({ subject_id, subject_name, lessons }) => {
    // Trạng thái khi không có bài tập nào cho môn học này
    const emptyState = `
      <div class="flex-grow flex flex-col justify-center items-center h-full text-slate-400 py-10">
        <svg class="w-12 h-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p class="text-sm font-medium">Chưa có bài tập nào</p>
      </div>`;

    // Trạng thái hiển thị danh sách bài học, tối đa hiển thị MAX_VISIBLE_LESSONS bài học, nếu có nhiều hơn sẽ hiển thị nút "Xem thêm"
    const lessonList = `
      <div class="flex-grow flex flex-col gap-3 text-sm text-slate-600 mb-6 font-sans">
        ${lessons
          .slice(0, MAX_VISIBLE_LESSONS)
          .map(
            (lesson) => `
          <div class="flex items-center gap-2">
            <div class="w-1.5 h-1.5 rounded-full ${lesson.status === "completed" ? "bg-[#4CAF50]" : "bg-[#FF9800]"}"></div>
            <p class="hover:underline cursor-pointer">${`Session ${lessons.indexOf(lesson) + 1}: ${lesson.lesson_name}`}</p>
          </div>`,
          )
          .join("")}
      </div>`;

    // Nút "Xem thêm" chỉ hiển thị khi số lượng bài học vượt quá MAX_VISIBLE_LESSONS
    const viewMoreBtn =
      lessons.length > MAX_VISIBLE_LESSONS
        ? `<button
            class="btn-view-more w-full py-2.5 px-4 bg-slate-50 hover:bg-blue-50 text-blue-600 font-medium rounded-xl border border-slate-200 hover:border-blue-200 transition-colors mt-auto text-sm cursor-pointer"
            data-subject-id="${subject_id}"
          >
            Xem thêm
          </button>`
        : "";

    return `
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all p-6 flex flex-col h-full group">
        <h2 class="text-xl font-bold text-slate-900 mb-4 group-hover:text-blue-600 transition-colors">
          ${subject_name}
        </h2>
        ${lessons.length === 0 ? emptyState : lessonList}
        ${viewMoreBtn}
      </div>`;
  };

  /**
   * Tạo HTML cho thẻ skeleton loading
   * @returns {string} HTML chuỗi đại diện cho thẻ skeleton loading
   */
  const createSkeletonHTML = () => `
    <div class="skeleton-card">
      <div class="skeleton-line h-5 w-3/4"></div>
      <div class="skeleton-line w-full"></div>
      <div class="skeleton-line w-full"></div>
      <div class="skeleton-line w-1/2"></div>
    </div>`;

  /**
   * Lấy phần tử sentinel dùng để theo dõi khi người dùng cuộn đến cuối danh sách
   * @returns {Element|null} Phần tử sentinel hoặc null nếu không tìm thấy
   */
  const getSentinel = () => document.querySelector("#scroll-sentinel");

  /**
   * Hiển thị các thẻ skeleton loading tạm thời trong khi chờ dữ liệu được tải về
   * @param {number} count - Số lượng thẻ skeleton cần hiển thị
   * @returns {string[]} Danh sách ID của các phần tử skeleton
   */
  const showSkeletons = (count = SKELETON_COUNT) => {
    const ids = [];
    // Tạo và chèn các thẻ skeleton vào DOM, đồng thời lưu lại ID của chúng để có thể xóa sau khi dữ liệu được tải về
    for (let i = 0; i < count; i++) {
      // Tạo ID duy nhất cho mỗi thẻ skeleton để dễ dàng quản lý và xóa sau này
      const id = `skeleton-${Date.now()}-${i}`;
      const wrapper = document.createElement("div");
      wrapper.id = id;
      wrapper.innerHTML = createSkeletonHTML();

      // Chèn thẻ skeleton vào trước phần tử sentinel nếu nó tồn tại, hoặc vào cuối container nếu không có sentinel
      const sentinel = getSentinel();
      if (sentinel) {
        subjectContainer.insertBefore(wrapper, sentinel);
      } else {
        subjectContainer.appendChild(wrapper);
      }
      // Lưu lại ID của thẻ skeleton để có thể xóa sau khi dữ liệu được tải về
      ids.push(id);
    }
    return ids;
  };

  /**
   * Xóa các thẻ skeleton loading
   * @param {string[]} ids - Danh sách ID của các phần tử skeleton cần xóa
   */
  const removeSkeletons = (ids) => {
    // Duyệt qua danh sách ID và xóa từng phần tử skeleton khỏi DOM nếu nó tồn tại
    for (const id of ids) {
      document.getElementById(id)?.remove();
    }
  };

  /**
   * Áp dụng hiệu ứng động cho thẻ card khi nó được thêm vào
   * @param {object} card - Phần tử card cần áp dụng hiệu ứng
   */
  const applyEntryAnimation = (card) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(20px)";
    card.style.transition = "opacity 0.4s ease, transform 0.4s ease";
  };

  /**
   * Áp dụng hiệu ứng động cho tất cả các thẻ card đang có trong container, với độ trễ giữa các thẻ để tạo hiệu ứng xếp chồng
   */
  const animateCardsIn = () => {
    // Sử dụng requestAnimationFrame để đảm bảo rằng các thẻ đã được thêm vào DOM trước khi áp dụng hiệu ứng động
    // sau đó áp dụng hiệu ứng cho từng thẻ với độ trễ dựa trên chỉ số của chúng để tạo hiệu ứng xếp chồng
    requestAnimationFrame(() => {
      const cards = subjectContainer.querySelectorAll('[style*="opacity: 0"]');
      cards.forEach((card, idx) => {
        setTimeout(() => {
          card.style.opacity = "1";
          card.style.transform = "translateY(0)";
        }, idx * ANIMATION_STAGGER_MS);
      });
    });
  };

  /**
   * Tạo HTML cho trạng thái khi không tìm thấy môn học nào khớp với từ khóa tìm kiếm hoặc khi không có bài tập nào hoàn thành/chưa hoàn thành
   * @param {string} header - Tiêu đề chính của trạng thái rỗng
   * @param {string} title - Mô tả chi tiết hơn về trạng thái rỗng
   * @param {string} type - Loại trạng thái rỗng (ví dụ: "search" để hiển thị biểu tượng tìm kiếm)
   * @returns {string} HTML chuỗi đại diện cho trạng thái rỗng
   */
  const createEmptyCardHTML = (header, title, type = "") => `
    <div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
      ${
        type === "search"
          ? `<svg class="w-16 h-16 mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>`
          : ""
      }
      <p class="text-lg font-semibold text-slate-500">${header}</p>
      <p class="text-sm mt-1"> ${title}</p>
    </div>`;

  /**
   * Hiển thị tất cả các thẻ card dựa trên dữ liệu đã lọc (ví dụ: sau khi tìm kiếm hoặc thay đổi tab), thay thế hoàn toàn nội dung hiện tại trong container
   * @param {Array<object>} cards - Mảng các đối tượng card cần hiển thị
   * @returns
   */
  const renderAllCards = (cards) => {
    subjectContainer.innerHTML = "";

    // Nếu không có thẻ card nào khớp với từ khóa tìm kiếm hoặc tab đã chọn
    // hiển thị trạng thái rỗng phù hợp với loại trạng thái
    // (ví dụ: "Không tìm thấy môn học" cho tìm kiếm, hoặc "Bạn chưa hoàn thành bài tập nào" cho tab đã hoàn thành)
    if (cards.length === 0) {
      subjectContainer.innerHTML = createEmptyCardHTML(
        "Không tìm thấy môn học",
        'Không có môn học nào khớp với "' + searchInput.value.trim() + '"',
        "search",
      );
      return;
    }

    // Tạo và chèn tất cả các thẻ card mới vào DOM, đồng thời áp dụng hiệu ứng động cho chúng khi chúng xuất hiện
    const fragment = document.createDocumentFragment();
    for (const cardData of cards) {
      const html = createCardHTML(cardData).trim();
      if (!html) continue;

      const temp = document.createElement("div");
      temp.innerHTML = html;
      const card = temp.firstElementChild;
      if (card) {
        applyEntryAnimation(card);
        fragment.appendChild(card);
      }
    }

    subjectContainer.appendChild(fragment);
    animateCardsIn();
  };

  /**
   * Hiển thị một batch các thẻ card mới khi người dùng cuộn đến cuối danh sách, sử dụng hiệu ứng skeleton loading trong khi chờ dữ liệu được tải về
   */
  const renderBatch = () => {
    // Nếu đang trong quá trình tải hoặc đã hiển thị hết tất cả các thẻ card
    // không thực hiện gì cả để tránh việc gọi renderBatch nhiều lần liên tiếp khi người dùng cuộn nhanh đến cuối danh sách
    if (isLoading || currentIndex >= allCards.length) return;
    isLoading = true;

    const remaining = allCards.length - currentIndex;
    const skeletonCount = Math.min(SKELETON_COUNT, remaining);
    const skeletonIds = showSkeletons(skeletonCount);

    // Sử dụng setTimeout để giả lập thời gian tải dữ liệu
    // sau đó xóa các thẻ skeleton và hiển thị batch mới các thẻ card, đồng thời áp dụng hiệu ứng động cho chúng khi chúng xuất hiện
    setTimeout(() => {
      removeSkeletons(skeletonIds);

      // Tạo và chèn batch mới các thẻ card vào DOM, đồng thời áp dụng hiệu ứng động cho chúng khi chúng xuất hiện
      const fragment = document.createDocumentFragment();
      const end = Math.min(currentIndex + BATCH_SIZE, allCards.length);

      // Duyệt qua batch mới của các thẻ card cần hiển thị
      // tạo HTML cho từng thẻ card
      // áp dụng hiệu ứng động và thêm chúng vào fragment để chèn vào DOM một lần duy nhất sau khi đã tạo xong tất cả các thẻ card trong batch
      for (let i = currentIndex; i < end; i++) {
        const html = createCardHTML(allCards[i]).trim();
        // Nếu HTML rỗng hoặc không hợp lệ, bỏ qua thẻ card này để tránh lỗi khi tạo phần tử DOM
        if (!html) continue;

        const temp = document.createElement("div");
        temp.innerHTML = html;
        // Lấy phần tử card đầu tiên từ HTML đã tạo, áp dụng hiệu ứng động và thêm nó vào fragment để chèn vào DOM sau khi đã tạo xong tất cả các thẻ card trong batch
        const card = temp.firstElementChild;
        if (card) {
          applyEntryAnimation(card);
          fragment.appendChild(card);
        }
      }

      // Chèn batch mới các thẻ card vào trước phần tử sentinel nếu nó tồn tại, hoặc vào cuối container nếu không có sentinel
      const sentinel = getSentinel();
      if (sentinel) {
        subjectContainer.insertBefore(fragment, sentinel);
      } else {
        subjectContainer.appendChild(fragment);
      }

      animateCardsIn();

      currentIndex = end;
      isLoading = false;

      // Nếu đã hiển thị hết tất cả các thẻ card, xóa phần tử sentinel để ngăn việc gọi renderBatch thêm khi người dùng cuộn đến cuối danh sách
      if (currentIndex >= allCards.length) sentinel?.remove();
    }, SKELETON_DISPLAY_MS);
  };

  /**
   * Cập nhật giao diện để hiển thị các thẻ card phù hợp với tab đã chọn (tất cả, đã hoàn thành, chưa hoàn thành), đồng thời đặt lại trạng thái tìm kiếm và cuộn về đầu danh sách
   * @param {string} tab - Tên của tab đã chọn ("all", "completed", "incomplete")
   */
  const setActiveTab = (tab) => {
    const tabs = {
      all: allTab,
      completed: completedTab,
      incomplete: incompleteTab,
    };
    // Cập nhật lớp CSS cho các tab để hiển thị tab đã chọn với kiểu dáng khác biệt so với các tab không được chọn, giúp người dùng dễ dàng nhận biết tab nào đang được kích hoạt
    for (const [key, el] of Object.entries(tabs)) {
      if (el)
        el.className = key === tab ? ACTIVE_TAB_CLASS : INACTIVE_TAB_CLASS;
    }
  };

  /**
   * Cập nhật giao diện và dữ liệu hiển thị dựa trên tab đã chọn, lọc lại danh sách thẻ card từ masterCards và đặt lại trạng thái tìm kiếm, sau đó khởi động lại cơ chế cuộn vô hạn để hiển thị các thẻ card mới
   * @param {string} tab - Tên của tab đã chọn ("all", "completed", "incomplete")
   */
  const updateUIForTab = (tab) => {
    currentTab = tab;
    setActiveTab(tab);

    // Lọc lại danh sách thẻ card từ masterCards dựa trên tab đã chọn
    // sau đó đặt lại trạng thái tìm kiếm và khởi động lại cơ chế cuộn vô hạn để hiển thị các thẻ card mới phù hợp với tab đã chọn
    if (tab === "all") {
      // Nếu tab "Tất cả" được chọn, hiển thị tất cả các thẻ card mà không cần lọc lại, vì masterCards đã chứa tất cả các thẻ card từ dữ liệu gốc
      allCards = [...masterCards];
    } else if (tab === "completed") {
      // Nếu tab "Đã hoàn thành" được chọn
      // lọc lại danh sách thẻ card từ masterCards để chỉ giữ lại những thẻ card mà tất cả các bài học của chúng đều có trạng thái "completed"
      // nếu không có thẻ card nào khớp với tiêu chí này, hiển thị trạng thái rỗng phù hợp
      allCards = masterCards.filter(
        (card) =>
          card.lessons.length > 0 &&
          card.lessons.every((lesson) => lesson.status === "completed"),
      );
      if (allCards.length === 0) {
        subjectContainer.innerHTML = createEmptyCardHTML(
          "Bạn chưa hoàn thành bài tập nào",
          "Hãy hoàn thành một số bài tập để chúng xuất hiện ở đây!",
        );
        return;
      }
    } else if (tab === "incomplete") {
      // Nếu tab "Chưa hoàn thành" được chọn
      // lọc lại danh sách thẻ card từ masterCards để chỉ giữ lại những thẻ card mà có ít nhất một bài học có trạng thái "incomplete"
      // nếu không có thẻ card nào khớp với tiêu chí này, hiển thị trạng thái rỗng phù hợp
      allCards = masterCards.filter(
        (card) =>
          card.lessons.length > 0 &&
          card.lessons.some((lesson) => lesson.status === "incomplete"),
      );
      if (allCards.length === 0) {
        subjectContainer.innerHTML = createEmptyCardHTML(
          "Bạn đã hoàn thành tất cả bài tập",
          "Hãy tiếp tục duy trì thói quen học tập tốt nhé!",
        );
        return;
      }
    }

    // Đặt lại trạng thái tìm kiếm và khởi động lại cơ chế cuộn vô hạn để hiển thị các thẻ card mới phù hợp với tab đã chọn
    if (searchInput) searchInput.value = "";
    resetInfiniteScroll();
  };

  /**
   * Thiết lập cơ chế cuộn vô hạn bằng cách tạo một phần tử sentinel ở cuối danh sách và sử dụng IntersectionObserver để theo dõi khi người dùng cuộn đến phần tử này, từ đó gọi hàm renderBatch để tải thêm thẻ card mới
   */
  const setupInfiniteScroll = () => {
    const sentinel = document.createElement("div");
    sentinel.id = "scroll-sentinel";
    subjectContainer.appendChild(sentinel);

    // Nếu đã có một observer cũ đang hoạt động
    // ngắt kết nối nó trước khi tạo một observer mới để tránh việc có nhiều observer cùng theo dõi phần tử sentinel
    // điều này có thể dẫn đến việc gọi renderBatch nhiều lần không mong muốn khi người dùng cuộn đến phần tử sentinel
    scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isLoading) {
          renderBatch();
        }
      },
      //root - null có nghĩa là sử dụng viewport của trình duyệt làm vùng quan sát
      //rootMargin - "0px" có nghĩa là không có khoảng cách nào được thêm vào vùng quan sát, phần tử sẽ được coi là intersecting ngay khi nó chạm
      //threshold - 0 có nghĩa là callback sẽ được gọi ngay khi bất kỳ phần nào của phần tử chạm vào vùng quan sát, kể cả một pixel nhỏ
      { root: null, rootMargin: "0px", threshold: 0 },
    );

    scrollObserver.observe(sentinel);
  };

  /**
   * Đặt lại cơ chế cuộn vô hạn về trạng thái ban đầu, bao gồm ngắt kết nối observer cũ, đặt lại chỉ số và trạng thái tải, xóa nội dung hiện tại trong container và thiết lập lại cơ chế cuộn vô hạn để hiển thị các thẻ card mới từ đầu
   */
  const resetInfiniteScroll = () => {
    // Nếu đã có một observer cũ đang hoạt động
    // ngắt kết nối nó để tránh việc có nhiều observer cùng theo dõi phần tử sentinel khi thiết lập lại cơ chế cuộn vô hạn
    if (scrollObserver) {
      scrollObserver.disconnect();
      scrollObserver = null;
    }
    currentIndex = 0;
    isLoading = false;
    subjectContainer.innerHTML = "";
    setupInfiniteScroll();
    renderBatch();
  };

  /**
   * Chuẩn bị danh sách thẻ card từ dữ liệu môn học và bài học
   * @param {Array} subjects - Danh sách môn học
   * @param {Array} lessons - Danh sách bài học
   */
  const prepareCards = (subjects, lessons) => {
    // Tạo danh sách thẻ card từ dữ liệu môn học và bài học, chỉ bao gồm những môn học có trạng thái "active"
    // mỗi thẻ card sẽ chứa thông tin về môn học và danh sách bài học tương ứng, được lọc từ dữ liệu bài học dựa trên subject_id của môn học
    masterCards = subjects
      .filter((s) => s.status === "active")
      .map((subject) => ({
        subject_id: subject.id,
        subject_name: subject.subject_name,
        lessons: lessons.filter((l) => l.subject_id === subject.id),
      }));
    allCards = [...masterCards];
  };

  if (searchInput) {
    // Thêm sự kiện input với debounce để xử lý tìm kiếm khi người dùng nhập vào ô tìm kiếm, tránh việc gọi renderAllCards quá nhiều lần khi người dùng gõ nhanh
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const searchTerm = e.target.value.trim().toLowerCase();

        if (!searchTerm) {
          allCards = [...masterCards];
          resetInfiniteScroll();
          return;
        }

        const filteredCards = masterCards.filter((card) =>
          card.subject_name.toLowerCase().includes(searchTerm),
        );
        allCards = filteredCards;
        renderAllCards(filteredCards);
      }, DEBOUNCE_MS);
    });
  }

  if (navSubjects) {
    navSubjects.addEventListener("click", () =>
      localStorage.setItem("currentTab", "subject"),
    );
  }

  if (navLessons) {
    navLessons.addEventListener("click", () =>
      localStorage.setItem("currentTab", "lesson"),
    );
  }

  subjectContainer.addEventListener("click", (e) => {
    const viewMoreBtn = e.target.closest(".btn-view-more");
    // Nếu người dùng click vào nút "Xem thêm" trên thẻ card
    // lấy subject_id từ thuộc tính data của nút
    // lưu tab hiện tại vào localStorage và chuyển hướng đến trang studyTracker với query parameter là subjectId để hiển thị chi tiết bài học của môn học đó
    if (viewMoreBtn) {
      const subjectId = viewMoreBtn.dataset.subjectId;
      localStorage.setItem("currentTab", "lesson");
      window.location.href = `./studyTracker.html?subjectId=${subjectId}`;
    }
  });

  [allTab, completedTab, incompleteTab].forEach((tab) => {
    if (!tab) return;
    // Thêm sự kiện click cho mỗi tab để cập nhật giao diện và dữ liệu hiển thị dựa trên tab đã chọn
    // đồng thời tránh việc gọi updateUIForTab nhiều lần khi người dùng click liên tục vào cùng một tab
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const tabName = tab.id.replace("-tab", "");
      if (tabName !== currentTab) updateUIForTab(tabName);
    });
  });

  if (profileBtn && profileDropdown) {
    // Thêm sự kiện click cho nút profile để hiển thị hoặc ẩn dropdown menu, đồng thời ngăn việc click vào dropdown menu làm ẩn nó đi khi người dùng tương tác với nó
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle("hidden");
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
      const user = await dataServices.getCurrentUser();
      if (user) {
        const fullName = `${user.first_name} ${user.last_name}`;
        const avatarUrl = user.avatar;
        if (profileName) profileName.textContent = fullName;
        if (profileImg) profileImg.src = avatarUrl;

        const headerProfileImg = document.querySelector("#profile-btn img");
        if (headerProfileImg) headerProfileImg.src = avatarUrl;

        const [subjects, lessons] = await Promise.all([
          dataServices.getSubjectDataByUserId(user.id),
          dataServices.getLessonDataByUserId(user.id),
        ]);

        prepareCards(subjects, lessons);
      }
      subjectContainer.innerHTML = "";
      setupInfiniteScroll();
      updateUIForTab("all");
      renderBatch();
    } catch (error) {
      console.error("Failed to load data:", error);
      showPopup("error", "Lỗi tải dữ liệu", "Vui lòng thử tải lại trang.");
    }
  };

  init();
}
