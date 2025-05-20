//middleware/authMiddleware
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Tạo __dirname tương thích với ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đọc JWT_SECRET từ file .env nếu không có sẵn trong biến môi trường
if (!process.env.JWT_SECRET) {
    try {
        const envPath = path.resolve(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const jwtMatch = envContent.match(/JWT_SECRET=(.+)/);
            if (jwtMatch && jwtMatch[1]) {
                process.env.JWT_SECRET = jwtMatch[1];
            }
        }
    } catch (error) {
        console.error('Lỗi khi đọc JWT_SECRET từ file .env:', error.message);
    }
}

const authMiddleware = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Lấy token từ header Authorization
    
    if (!token) {
        return res.status(403).json({ message: 'Không có token, truy cập bị từ chối.' });
    }

    try {
        // Verify token
        const user = await jwt.verify(token, process.env.JWT_SECRET);
        req.user = user; // Lưu thông tin người dùng vào request
        next(); // Tiến hành tiếp tục đến route handler
    } catch (err) {
        console.log("Token verification error:", err.message); // Log lỗi token không hợp lệ
        return res.status(403).json({ message: 'Token không hợp lệ.' });
    }
};

export default authMiddleware;

