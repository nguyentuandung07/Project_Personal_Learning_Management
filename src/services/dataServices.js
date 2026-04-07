import { USER_KEY, SUBJECT_KEY, LESSON_KEY } from "../../config.js";
import { sessionStorage } from "../core/storage.js";

const jsonHeaders = {
  "Content-Type": "application/json",
};

const _cache = {};

/**
 * Một dịch vụ quản lý dữ liệu người dùng, môn học và bài học với bộ nhớ đệm và localStorage.
 * Nó cung cấp các phương thức để lấy dữ liệu từ các tệp JSON, truy xuất dữ liệu được lưu trong bộ nhớ đệm và lưu dữ liệu vào localStorage.
 */
export const dataServices = {
  async _getGenericData(key, filepath) {
    if (_cache[key]) return _cache[key];
    const localData = localStorage.getItem(key);
    if (localData) {
      try {
        _cache[key] = JSON.parse(localData);
        return _cache[key];
      } catch {
        localStorage.removeItem(key);
      }
    }
    const response = await fetch(filepath, { headers: jsonHeaders });
    const fileData = await response.json();
    localStorage.setItem(key, JSON.stringify(fileData));
    _cache[key] = fileData;
    return fileData;
  },

  _saveGenericData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    _cache[key] = data;
  },

  async getUserData() {
    return this._getGenericData(USER_KEY, "../../database/users.json");
  },

  saveUserData(userData) {
    this._saveGenericData(USER_KEY, userData);
  },

  /**
   * Trích xuất thông tin người dùng hiện tại từ session token.
   */
  async getCurrentUser() {
    const token = sessionStorage.getSession();
    if (!token) return null;

    try {
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(base64));
      const users = await this.getUserData();
      return users.find((u) => u.email === payload.sub) || null;
    } catch (err) {
      console.error("Failed to parse user session", err);
      return null;
    }
  },

  async getSubjectData() {
    return this._getGenericData(SUBJECT_KEY, "../../database/subjects.json");
  },

  saveSubjectData(subjectData) {
    this._saveGenericData(SUBJECT_KEY, subjectData);
  },

  async getSubjectDataByUserId(userId) {
    const allSubjects = await this.getSubjectData();
    // Gán user_id: 1 cho dữ liệu cũ nếu thiếu user_id để đảm bảo tính tương thích
    return allSubjects
      .map((s) => (s.user_id ? s : { ...s, user_id: 1 }))
      .filter((s) => s.user_id === userId);
  },

  async saveSubjectDataByUserId(userId, userSubjects) {
    const allSubjects = await this.getSubjectData();
    const otherUsersSubjects = allSubjects.filter(
      (s) => (s.user_id || 1) !== userId,
    );
    this.saveSubjectData([...otherUsersSubjects, ...userSubjects]);
  },

  async getLessonData() {
    return this._getGenericData(LESSON_KEY, "../../database/lessons.json");
  },

  saveLessonData(lessonData) {
    this._saveGenericData(LESSON_KEY, lessonData);
  },

  async getLessonDataByUserId(userId) {
    const allLessons = await this.getLessonData();
    // Gán user_id: 1 cho dữ liệu cũ nếu thiếu user_id
    return allLessons
      .map((l) => (l.user_id ? l : { ...l, user_id: 1 }))
      .filter((l) => l.user_id === userId);
  },

  async saveLessonDataByUserId(userId, userLessons) {
    const allLessons = await this.getLessonData();
    const otherUsersLessons = allLessons.filter(
      (l) => (l.user_id || 1) !== userId,
    );
    this.saveLessonData([...otherUsersLessons, ...userLessons]);
  },
};
