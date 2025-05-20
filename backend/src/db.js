import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Tạo __dirname tương thích với ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đọc trực tiếp từ file .env
let uri;
try {
    const envPath = path.resolve(__dirname, '../.env');
    
    // Kiểm tra xem file có tồn tại không
    if (fs.existsSync(envPath)) {
        console.log('File .env tồn tại, đang đọc...');
        
        // Đọc và parse file .env
        const envContent = fs.readFileSync(envPath, 'utf8');
        const dbUriMatch = envContent.match(/DB_URI=(.+)/);
        
        if (dbUriMatch && dbUriMatch[1]) {
            uri = dbUriMatch[1];
            console.log('Đã đọc DB_URI từ file .env thành công');
        } else {
            console.error('Không tìm thấy biến DB_URI trong file .env');
        }
    } else {
        console.error('File .env không tồn tại tại đường dẫn:', envPath);
    }
} catch (error) {
    console.error('Lỗi khi đọc file .env:', error.message);
}

// Sử dụng biến môi trường từ process.env nếu không đọc được từ file
if (!uri && process.env.DB_URI) {
    uri = process.env.DB_URI;
    console.log('Sử dụng DB_URI từ biến môi trường');
}

// Kiểm tra URI trước khi kết nối
if (!uri) {
    console.error('❌ MongoDB URI không được định nghĩa trong file .env hoặc biến môi trường');
    process.exit(1);
}

async function connectToDatabase() {
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB successfully');
    } catch (err) {
        console.error('❌ Could not connect to MongoDB:', err.message);
        process.exit(1);
    }
}

export default connectToDatabase;
