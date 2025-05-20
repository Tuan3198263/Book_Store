//src/config/emailConfig.js
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Tạo __dirname tương thích với ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load biến môi trường
dotenv.config();

// Đọc trực tiếp từ file .env nếu biến môi trường chưa được thiết lập
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    try {
        const envPath = path.resolve(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const emailUser = envContent.match(/EMAIL_USER=(.+)/);
            const emailPass = envContent.match(/EMAIL_PASS=(.+)/);
            
            if (emailUser && emailUser[1]) process.env.EMAIL_USER = emailUser[1];
            if (emailPass && emailPass[1]) process.env.EMAIL_PASS = emailPass[1];
        }
    } catch (error) {
        console.error('Lỗi khi đọc file .env:', error.message);
    }
}

const transporter = nodemailer.createTransport({
    service: 'gmail',  // Đây phải là "gmail", không phải "Mail"
    port: 465, // hoặc 587
    secure: true, // true nếu dùng port 465, false nếu dùng 587
    auth: {
        user: process.env.EMAIL_USER,  // Địa chỉ email của bạn
        pass: process.env.EMAIL_PASS,  // Mật khẩu ứng dụng của bạn
  },
});

export default transporter;