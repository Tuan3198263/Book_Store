import api from './api.js';

/**
 * Reader Service - Quản lý các chức năng reader
 * Bao gồm: Reading Progress, Bookmarks, Highlights, Notes
 */

class ReaderService {
  constructor() {
    // Removed auto-save properties for reading progress
  }

  // ======================= READER DATA =======================

  /**
   * Lấy thông tin sách cho reader
   * @param {String} bookId - ID của sách
   * @returns {Promise} - Trả về thông tin sách và license
   */
  async getReaderData(bookId) {
    try {
      const response = await api.get(`/reader/data/${bookId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting reader data:', error);
      throw error;
    }
  }

  /**
   * Lấy URL để stream file ebook
   * @param {String} bookId - ID của sách
   * @param {String} format - Định dạng file (epub/pdf)
   * @returns {Promise} - Trả về URL và thông tin file
   */
  async getEbookFileUrl(bookId, format) {
    try {
      console.log("📡 Calling API for ebook file URL:", { bookId, format });
      const response = await api.get(`/reader/stream/${bookId}/${format}`);
      console.log("📡 API Response:", response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting ebook file URL:', error);
      console.error('Error details:', error.response?.data);
      throw error;
    }
  }

  /**
   * Lấy URL proxy để tải file EPUB trực tiếp (bypass CORS)
   * @param {String} bookId - ID của sách
   * @param {String} format - Định dạng file (chỉ epub)
   * @returns {String} - URL proxy
   */
  getEbookProxyUrl(bookId, format) {
    if (format !== 'epub') {
      throw new Error('Chỉ hỗ trợ định dạng EPUB cho proxy');
    }
    // Sử dụng relative path để hoạt động với cả localhost và production
    // Nginx sẽ proxy /api đến backend:3000
    return `/api/reader/proxy/${bookId}/${format}`;
  }

  // ======================= PDF DOWNLOAD =======================

  /**
   * Lấy URL tải xuống PDF
   * @param {String} bookId - ID của sách
   * @returns {Promise} - Trả về URL download PDF
   */
  async getPdfDownloadUrl(bookId) {
    try {
      console.log("📡 Calling API for PDF download URL:", { bookId });
      const response = await api.get(`/reader/pdf-download/${bookId}`);
      console.log("📡 PDF download API Response:", response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting PDF download URL:', error);
      console.error('Error details:', error.response?.data);
      throw error;
    }
  }

  // ======================= FUTURE: BOOKMARKS =======================
  // Placeholder cho các chức năng sẽ implement sau

  async saveBookmark(bookId, bookmarkData) {
    // TODO: Implement bookmark functionality
    console.log('🔖 Save bookmark (TODO):', { bookId, bookmarkData });
  }

  async getBookmarks(bookId) {
    // TODO: Implement get bookmarks
    console.log('🔖 Get bookmarks (TODO):', bookId);
  }

  // ======================= FUTURE: HIGHLIGHTS =======================

  async saveHighlight(bookId, highlightData) {
    // TODO: Implement highlight functionality
    console.log('🖍️ Save highlight (TODO):', { bookId, highlightData });
  }

  async getHighlights(bookId) {
    // TODO: Implement get highlights
    console.log('🖍️ Get highlights (TODO):', bookId);
  }

  // ======================= FUTURE: NOTES =======================

  async saveNote(bookId, noteData) {
    // TODO: Implement notes functionality
    console.log('📝 Save note (TODO):', { bookId, noteData });
  }

  async getNotes(bookId) {
    // TODO: Implement get notes
    console.log('📝 Get notes (TODO):', bookId);
  }
}

// Export singleton instance
const readerService = new ReaderService();
export default readerService;
