/**
 * Chuyển đổi giá trị thời gian tính bằng giây thành chuỗi ký tự theo định dạng "MM:SS".
 * @param {string|number} time - Thời gian tính bằng giây.
 * @returns {string} Chuỗi thời gian đã được định dạng theo kiểu "MM:SS".
 */
export const formatTime = (time) => {
  const minutes = Math.floor(parseInt(time) / 60);
  const seconds = parseInt(time) % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};
