// config/cloudinaryConfig.js
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Tạo __dirname tương thích với ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đảm bảo rằng biến môi trường được tải từ .env
dotenv.config();

// Đọc trực tiếp từ file .env nếu biến môi trường chưa được thiết lập
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    try {
        const envPath = path.resolve(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const cloudName = envContent.match(/CLOUDINARY_CLOUD_NAME=(.+)/);
            const apiKey = envContent.match(/CLOUDINARY_API_KEY=(.+)/);
            const apiSecret = envContent.match(/CLOUDINARY_API_SECRET=(.+)/);
            
            if (cloudName && cloudName[1]) process.env.CLOUDINARY_CLOUD_NAME = cloudName[1];
            if (apiKey && apiKey[1]) process.env.CLOUDINARY_API_KEY = apiKey[1];
            if (apiSecret && apiSecret[1]) process.env.CLOUDINARY_API_SECRET = apiSecret[1];
        }
    } catch (error) {
        console.error('Lỗi khi đọc file .env:', error.message);
    }
}

// Cấu hình Cloudinary với các thông tin từ .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export default cloudinary;
