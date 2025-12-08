import Order from '../models/order.js';
import Cart from '../models/cart.js';
import Book from '../models/book.js';
import vnpayService from '../config/vnpayConfig.js';
import mongoose from 'mongoose';
import moment from 'moment';
import { createEbookLicense } from './licenseController.js';

/**
 * Tạo đơn hàng mới từ giỏ hàng
 * @route POST /api/orders/create
 * @access Private
 */
export const createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        // Lấy ID người dùng từ middleware auth
        const userId = req.user.id;
        console.log(`📝 [CREATE ORDER] Bắt đầu tạo đơn hàng cho user: ${userId}`);// Kiểm tra số lượng đơn hàng đang chờ thanh toán
        const pendingOrdersCount = await Order.countDocuments({
            user: userId,
            orderStatus: 'pending'
        });

        // Giới hạn tối đa 3 đơn hàng đang chờ thanh toán
        if (pendingOrdersCount >= 3) {
            return res.status(400).json({
                success: false,
                message: 'Bạn đã có 3 đơn hàng đang chờ thanh toán. Vui lòng thanh toán hoặc hủy bớt đơn hàng cũ trước khi tạo đơn mới.'
            });
        }        // Kiểm tra xem người dùng có giỏ hàng không
        const cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.book',
            select: 'title coverImages active ebookOptions'
        });
        
        console.log(`🛒 [CART CHECK] Tìm thấy giỏ hàng với ${cart?.items?.length || 0} sản phẩm`);

        // Nếu giỏ hàng không tồn tại hoặc không có sản phẩm
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Giỏ hàng của bạn đang trống. Vui lòng thêm sản phẩm vào giỏ hàng.'
            });
        }

        // Kiểm tra các sản phẩm trong giỏ hàng
        const validItems = [];
        const invalidItems = [];

        for (const item of cart.items) {
            // Kiểm tra sách có tồn tại và ở trạng thái active không
            if (!item.book || !item.book.active) {
                invalidItems.push({
                    itemId: item._id,
                    bookId: item.book ? item.book._id : null,
                    title: item.book ? item.book.title : 'Sách không tồn tại',
                    reason: item.book ? 'Sách đã bị vô hiệu hóa' : 'Sách không tồn tại'
                });
                continue;
            }

            // Kiểm tra option ebook người dùng chọn có còn hợp lệ không
            const validOption = item.book.ebookOptions.find(
                option => option.duration === item.ebookOption.duration
            );

            if (!validOption) {
                invalidItems.push({
                    itemId: item._id,
                    bookId: item.book._id,
                    title: item.book.title,
                    reason: 'Tùy chọn ebook đã thay đổi'
                });
                continue;
            }

            // Kiểm tra giá có thay đổi không
            if (validOption.price !== item.ebookOption.price) {
                invalidItems.push({
                    itemId: item._id,
                    bookId: item.book._id,
                    title: item.book.title,
                    reason: 'Giá sách đã thay đổi'
                });
                continue;
            }

            // Thêm vào danh sách sản phẩm hợp lệ
            validItems.push({
                book: item.book._id,
                title: item.book.title,
                coverImage: item.book.coverImages && item.book.coverImages.length > 0 ? 
                            item.book.coverImages[0] : null,
                ebookOption: {
                    duration: item.ebookOption.duration,
                    price: item.ebookOption.price
                }
            });
        }        // Nếu không có sản phẩm hợp lệ
        if (validItems.length === 0) {
            await session.abortTransaction();
            session.endSession();
            
            console.log(`❌ [VALIDATION] Không có sản phẩm hợp lệ. Invalid items: ${invalidItems.length}`);
            return res.status(400).json({
                success: false,
                message: 'Không có sản phẩm hợp lệ trong giỏ hàng để tạo đơn hàng',
                invalidItems
            });
        }
        
        console.log(`✅ [VALIDATION] ${validItems.length} sản phẩm hợp lệ, ${invalidItems.length} sản phẩm không hợp lệ`);// Tính tổng tiền từ các sản phẩm hợp lệ
        const totalAmount = validItems.reduce((sum, item) => sum + item.ebookOption.price, 0);// Tạo mã đơn hàng duy nhất với timestamp + số ngẫu nhiên để tránh trùng lặp
        const date = new Date();
        const timestamp = moment(date).format('YYYYMMDDHHmmss');
        const randomDigits = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // Tạo 3 chữ số ngẫu nhiên
        const orderCode = timestamp + randomDigits; // Kết hợp timestamp và số ngẫu nhiên

        // Thiết lập thời gian hết hạn (30 phút)
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);        // Tạo đơn hàng mới
        const newOrder = new Order({
            user: userId,
            orderCode,
            items: validItems,
            totalAmount,
            paymentMethod: 'vnpay',
            orderStatus: 'pending',
            note: req.body.note || '',
            expiresAt: expiresAt
        });        // Lưu đơn hàng
        await newOrder.save({ session });
        
        console.log(`📦 [ORDER CREATED] Đã tạo đơn hàng ${orderCode} với tổng tiền ${totalAmount.toLocaleString('vi-VN')} VNĐ`);// Lấy IP của khách hàng để tạo URL thanh toán
        const ipAddr = req.headers['x-forwarded-for'] || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress || 
                      req.connection.socket?.remoteAddress || 
                      req.ip || 
                      '127.0.0.1';// Xử lý IP address cho VNPay (chỉ hỗ trợ IPv4)
        let processedIp = ipAddr;
        if (ipAddr === '::1' || ipAddr.includes('::ffff:')) {
            processedIp = '127.0.0.1';
        }
        // Tạo URL thanh toán VNPay
        const orderInfo = `Order${orderCode}`;
        
        // KHÔNG sử dụng dynamic returnUrl từ request vì trong Docker/Nginx proxy có thể sai
        // VNPay sẽ sử dụng vnp_ReturnUrl đã cấu hình trong vnpayConfig (từ .env)
        
        // Tạo ngày hết hạn thanh toán (30 phút sau)
        const expireDate = new Date(Date.now() + 30 * 60 * 1000);
        
        // Sử dụng vnpayService để tạo URL thanh toán
        // vnp_ReturnUrl sẽ được tự động lấy từ vnpayConfig đã được cấu hình đúng
        const paymentParams = {
            vnp_TxnRef: orderCode,
            vnp_OrderInfo: orderInfo,
            vnp_OrderType: 'other',
            vnp_Amount: totalAmount, // Sẽ được nhân 100 trong hàm createPaymentUrl
            vnp_IpAddr: processedIp,
            vnp_Locale: 'vn',
            vnp_CreateDate: moment().format('YYYYMMDDHHmmss')
            // KHÔNG truyền vnp_ReturnUrl ở đây, để dùng giá trị mặc định từ config
        };

        const paymentUrl = vnpayService.createPaymentUrl(paymentParams);
        
        console.log(`💳 [PAYMENT URL] Đã tạo URL thanh toán VNPay cho đơn hàng ${orderCode}`);

        // Nếu có sản phẩm không hợp lệ, cảnh báo người dùng nhưng vẫn tạo đơn hàng với sản phẩm hợp lệ
        let message = 'Đơn hàng đã được tạo thành công';
        if (invalidItems.length > 0) {
            message = 'Đơn hàng đã được tạo thành công, nhưng một số sản phẩm không hợp lệ đã bị loại bỏ';

            // Xóa sản phẩm không hợp lệ khỏi giỏ hàng
            for (const item of invalidItems) {
                await Cart.updateOne(
                    { user: userId },
                    { $pull: { items: { _id: item.itemId } } },
                    { session }
                );
            }
        } else {
            // Nếu tất cả sản phẩm đều hợp lệ, xóa giỏ hàng
            await Cart.updateOne(
                { user: userId },
                { $set: { items: [] } },
                { session }
            );
        }        // Cập nhật tổng giá trị giỏ hàng
        await Cart.findOneAndUpdate(
            { user: userId },
            { $set: { totalAmount: 0, totalItems: 0 } },
            { session }
        );        // Commit transaction
        await session.commitTransaction();
        session.endSession();
        
        console.log(`✅ [ORDER SUCCESS] Hoàn thành tạo đơn hàng ${orderCode}. Payment URL ready.`);

        // Trả về thông tin đơn hàng và URL thanh toán
        return res.status(201).json({
            success: true,
            message,
            order: {
                _id: newOrder._id,
                orderCode: newOrder.orderCode,
                totalAmount: newOrder.totalAmount,
                items: newOrder.items.length
            },
            paymentUrl,
            invalidItems: invalidItems.length > 0 ? invalidItems : undefined
        });    } catch (error) {        // Rollback transaction nếu có lỗi
        await session.abortTransaction();
        session.endSession();

        console.error(`❌ [ORDER ERROR] Lỗi khi tạo đơn hàng cho user ${req.user?.id}:`, error.message);
        
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi tạo đơn hàng',
            error: error.message
        });
    }
};

/**
 * Lấy danh sách đơn hàng của người dùng hiện tại
 * @route GET /api/orders
 * @access Private
 * @description Trả về toàn bộ đơn hàng của user (không phân trang, client-side handling)
 */
export const getUserOrders = async (req, res) => {
    try {
        const userId = req.user.id;

        // Tìm tất cả đơn hàng của user, sắp xếp theo thời gian tạo (mới nhất trước)
        const orders = await Order.find({ user: userId })
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            orders: orders || [],
            total: orders.length
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách đơn hàng:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi lấy danh sách đơn hàng',
            error: error.message
        });
    }
};

/**
 * Lấy thông tin chi tiết đơn hàng
 * @route GET /api/orders/:id
 * @access Private
 */
export const getOrderDetails = async (req, res) => {
    try {
        const identifier = req.params.id; // Có thể là _id hoặc orderCode
        const userId = req.user.id;

        // Kiểm tra xem identifier có phải là ObjectId hợp lệ không
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
        
        let query;
        if (isObjectId) {
            // Tìm theo _id
            query = { _id: identifier, user: userId };
        } else {
            // Tìm theo orderCode
            query = { orderCode: identifier, user: userId };
        }

        // Tìm đơn hàng theo query và userId để đảm bảo người dùng chỉ có thể xem đơn hàng của mình
        const order = await Order.findOne(query);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn hàng'
            });
        }

        return res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        console.error('Lỗi khi lấy thông tin đơn hàng:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi lấy thông tin đơn hàng',
            error: error.message
        });
    }
};

/**
 * Hủy đơn hàng
 * @route PUT /api/orders/:id/cancel
 * @access Private
 */
export const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user.id;

        // Tìm đơn hàng theo ID và userId
        const order = await Order.findOne({
            _id: orderId,
            user: userId
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn hàng'
            });
        }        // Chỉ cho phép hủy đơn hàng ở trạng thái pending
        if (order.orderStatus !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Không thể hủy đơn hàng này do đã được xử lý'
            });
        }

        // Cập nhật trạng thái đơn hàng
        order.orderStatus = 'canceled';
        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Đơn hàng đã được hủy thành công',
            order
        });
    } catch (error) {
        console.error('Lỗi khi hủy đơn hàng:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi hủy đơn hàng',
            error: error.message
        });
    }
};

/**
 * Hủy đơn hàng hết hạn
 * Hàm này được gọi bởi cron job
 */
export const cancelExpiredOrders = async () => {
    try {
        const now = new Date();
          // Tìm các đơn hàng đã hết hạn nhưng vẫn ở trạng thái pending
        const expiredOrders = await Order.find({
            expiresAt: { $lt: now },
            orderStatus: 'pending'
        });
        
        console.log(`Tìm thấy ${expiredOrders.length} đơn hàng hết hạn cần hủy`);
        
        // Cập nhật trạng thái các đơn hàng hết hạn
        if (expiredOrders.length > 0) {
            const orderIds = expiredOrders.map(order => order._id);
              const result = await Order.updateMany(
                { _id: { $in: orderIds } },
                { 
                    $set: { 
                        orderStatus: 'canceled'
                    } 
                }
            );
            
            console.log(`Đã hủy ${result.modifiedCount} đơn hàng hết hạn`);
        }
        
        return {
            success: true,
            canceled: expiredOrders.length
        };
    } catch (error) {
        console.error('Lỗi khi hủy đơn hàng hết hạn:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Kiểm tra trạng thái thanh toán của đơn hàng
 * @route GET /api/orders/check-payment-status/:orderCode
 * @access Private
 */
export const checkPaymentStatus = async (req, res) => {
    try {
        const { orderCode } = req.params;
        const userId = req.user.id;        // Tìm đơn hàng theo orderCode và userId
        const order = await Order.findOne({
            orderCode: orderCode,
            user: userId
        }).select('orderStatus paymentDetails totalAmount createdAt');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn hàng'
            });
        }        return res.status(200).json({
            success: true,
            data: {
                orderCode: order.orderCode,
                orderStatus: order.orderStatus,
                totalAmount: order.totalAmount,
                createdAt: order.createdAt,
                paymentDetails: order.paymentDetails
            }
        });
    } catch (error) {
        console.error('Lỗi khi kiểm tra trạng thái thanh toán:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi kiểm tra trạng thái thanh toán',
            error: error.message
        });
    }
};



// ====================== ADMIN METHODS ======================

/**
 * Admin: Lấy danh sách tất cả đơn hàng
 * @route GET /api/admin/orders
 * @access Admin
 * @description Trả về toàn bộ đơn hàng (không phân trang, client-side handling)
 */
export const getAllOrders = async (req, res) => {
    try {        // Lấy tất cả đơn hàng, populate thông tin user và book
        const orders = await Order.find({})
            .populate('user', 'name email faculty major role')
            .populate({
                path: 'items.book',
                select: 'title authors',
                populate: {
                    path: 'authors',
                    model: 'Author',
                    select: 'name'
                }
            })
            .sort({ createdAt: -1 })
            .lean();

        // Thống kê tổng quan
        const stats = {
            total: orders.length,
            pending: orders.filter(order => order.orderStatus === 'pending').length,
            completed: orders.filter(order => order.orderStatus === 'completed').length,
            failed: orders.filter(order => order.orderStatus === 'failed').length,
            canceled: orders.filter(order => order.orderStatus === 'canceled').length,
            refunded: orders.filter(order => order.orderStatus === 'refunded').length
        };        return res.status(200).json({
            success: true,
            orders: orders || [],
            stats
        });
    } catch (error) {
        console.error('❌ [ADMIN] Lỗi khi lấy danh sách đơn hàng:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi lấy danh sách đơn hàng',
            error: error.message
        });
    }
};

/**
 * Admin: Lấy thông tin chi tiết đơn hàng
 * @route GET /api/admin/orders/:id
 * @access Admin
 */
export const getAdminOrderDetails = async (req, res) => {
    try {
        const identifier = req.params.id; // Có thể là _id hoặc orderCode

        // Kiểm tra xem identifier có phải là ObjectId hợp lệ không
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
        
        let query;
        if (isObjectId) {
            query = { _id: identifier };
        } else {
            query = { orderCode: identifier };
        }            // Tìm đơn hàng với thông tin đầy đủ
        const order = await Order.findOne(query)
            .populate('user', 'name email faculty major role dateOfBirth avatar')
            .populate({
                path: 'items.book',
                select: 'title authors coverImages description publisher publicationYear isbn language pages',
                populate: {
                    path: 'authors',
                    model: 'Author',
                    select: 'name bio'
                }
            });if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn hàng'
            });
        }

        return res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        console.error('❌ [ADMIN] Lỗi khi lấy thông tin đơn hàng:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi lấy thông tin đơn hàng',
            error: error.message
        });
    }
};

/**
 * Admin: Cập nhật trạng thái đơn hàng
 * @route PUT /api/admin/orders/:id/status
 * @access Admin
 */
export const updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { orderStatus, note } = req.body;
        const adminId = req.user.id;

        // Validate trạng thái mới
        const validStatuses = ['pending', 'completed', 'failed', 'canceled', 'refunded'];
        if (!validStatuses.includes(orderStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái đơn hàng không hợp lệ'
            });
        }

        // Tìm đơn hàng
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn hàng'
            });
        }

        // Logic nghiệp vụ: không cho phép thay đổi từ trạng thái completed
        if (order.orderStatus === 'completed' && orderStatus !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Không thể thay đổi trạng thái của đơn hàng đã hoàn thành'
            });
        }

        // Logic nghiệp vụ: không cho phép thay đổi từ refunded
        if (order.orderStatus === 'refunded' && orderStatus !== 'refunded') {
            return res.status(400).json({
                success: false,
                message: 'Không thể thay đổi trạng thái của đơn hàng đã hoàn tiền'
            });
        }

        const oldStatus = order.orderStatus;

        // Cập nhật trạng thái
        order.orderStatus = orderStatus;
        if (note) {
            order.note = note;
        }        await order.save();

        // Nếu cập nhật thành completed, tự động tạo bản quyền ebook
        if (orderStatus === 'completed' && oldStatus !== 'completed') {            try {
                const licenseResult = await createEbookLicense(order._id, true); // isBackup = true để phân biệt với tạo tự động
                // Tạo license thành công, không cần log chi tiết
            } catch (licenseError) {
                // Log lỗi để debug nếu cần
                console.error('Error creating ebook license:', licenseError);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Đã cập nhật trạng thái đơn hàng thành công từ "${oldStatus}" thành "${orderStatus}"`,
            order: {
                _id: order._id,
                orderCode: order.orderCode,
                orderStatus: order.orderStatus,
                note: order.note,
                updatedAt: order.updatedAt
            }
        });

    } catch (error) {
        console.error('❌ [ADMIN] Lỗi khi cập nhật trạng thái đơn hàng:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi cập nhật trạng thái đơn hàng',
            error: error.message
        });
    }
};

/**
 * Admin: Xóa đơn hàng
 * @route DELETE /api/admin/orders/:id
 * @access Admin
 */
export const deleteOrder = async (req, res) => {
    try {
        const orderId = req.params.id;

        // Tìm đơn hàng
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn hàng'
            });
        }

        // Chỉ cho phép xóa đơn hàng có trạng thái canceled
        if (order.orderStatus !== 'canceled') {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể xóa đơn hàng đã bị hủy',
                currentStatus: order.orderStatus
            });
        }        // Xóa đơn hàng
        await Order.findByIdAndDelete(orderId);

        return res.status(200).json({
            success: true,
            message: `Đã xóa đơn hàng ${order.orderCode} thành công`
        });

    } catch (error) {
        console.error('Error deleting order:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi xóa đơn hàng',
            error: error.message
        });
    }
};


