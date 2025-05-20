import multer from 'multer';
import path from 'path';

// Thiết lập lưu trữ ảnh trong bộ nhớ (MemoryStorage)
const storage = multer.memoryStorage(); // Lưu trữ ảnh trực tiếp trong bộ nhớ

// Chỉ chấp nhận file ảnh
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|jfif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ cho phép các định dạng ảnh: JPEG, JPG, PNG, GIF.'));
  }
};

// Middleware Multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn kích thước file 5MB
});

export default upload;
