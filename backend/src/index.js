// ẩn tắt cả cánh báo
process.removeAllListeners('warning');
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";

// Load biến môi trường từ file .env TRƯỚC KHI import các module khác
dotenv.config();

// In thông tin debug về biến môi trường
console.log("DB_URI trong index.js:", process.env.DB_URI ? "Exists" : "Not found");

// Sau khi đã nạp biến môi trường, mới import DB
import connectToDatabase from "./db.js";
// import { initSocketIO } from './utils/socketManager.js';  // Comment out Socket.IO import

const app = express();

// Kết nối tới MongoDB
connectToDatabase();

// Middlewares - đặt trước tất cả các routes
app.use(express.json());  // Thay vì bodyParser.json()
app.use(cors()); // Cho phép cross-origin requests


// Định nghĩa route mặc định
app.get("/", (req, res) => {
    res.send("Server is running!");
});



// Định nghĩa cổng
const PORT = process.env.PORT || 3000;

// Khởi động server
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Comment out Socket.IO initialization
/*
// Khởi tạo Socket.IO
const io = initSocketIO(server);

// Chạy listener để lắng nghe sự kiện
require("./events/notificationListener.js"); 
*/

// Comment out SmeeIO client initialization
/*
(async () => {
    try {
        const { default: SmeeClient } = await import('smee-client');
        
        const smee = new SmeeClient({
            source: 'https://smee.io/DC5tmeYA0vSSFNIV',
            target: `http://localhost:${PORT}/api/order/webhook`,
            logger: console
        });
        
        smee.start();
        console.log('Smee client started successfully');
    } catch (error) {
        console.error('Failed to initialize Smee client:', error);
    }
})();
*/


