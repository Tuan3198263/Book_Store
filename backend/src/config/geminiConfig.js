import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Tạo __dirname tương thích với ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load biến môi trường
dotenv.config();

// Lấy API key từ biến môi trường hoặc đọc từ file .env
let API_KEY = process.env.GEMINI_API_KEY;

// Đọc trực tiếp từ file .env nếu không có sẵn
if (!API_KEY) {
    try {
        const envPath = path.resolve(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const apiKeyMatch = envContent.match(/GEMINI_API_KEY=(.+)/);
            if (apiKeyMatch && apiKeyMatch[1]) {
                API_KEY = apiKeyMatch[1];
            }
        }
    } catch (error) {
        console.error('Lỗi khi đọc file .env:', error.message);
    }
}

// Khởi tạo Google Generative AI với API key
const genAI = new GoogleGenerativeAI(API_KEY);

// Cấu hình model Gemini - chỉ sử dụng model gemini-pro
const getGeminiModel = () => {
  return genAI.getGenerativeModel({
    model: "gemini-2.0-flash", 
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048, // Giảm xuống để tránh vượt quá giới hạn
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ],
  });
};

export { getGeminiModel };
