import express from "express";
import Order from "../models/Order.js";
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// **📌 دریافت همه سفارشات (فقط ادمین‌ها)**
router.get("/all", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ دسترسی غیرمجاز" });
  }

  try {
      const orders = await Order.find().populate("userId", "fname lname email");
      res.json(orders);
  } catch (error) {
      console.error('Error fetching all orders:', error);
      res.status(500).json({ 
        error: "❌ دریافت سفارشات ادمین ناموفق بود.",
        details: error.message 
      });
  }
});

// **📌 دریافت یک سفارش خاص**
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("userId", "fname lname email");
    if (!order) {
      return res.status(404).json({ error: "سفارش یافت نشد" });
    }
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: "❌ خطا در دریافت اطلاعات سفارش" });
  }
});

// **📌 ثبت سفارش جدید**
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { items, totalAmount } = req.body;
    const userId = req.user.id;

    // اعتبارسنجی داده‌های ورودی
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'سبد خرید نامعتبر است' });
    }

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: 'مبلغ کل نامعتبر است' });
    }

    // ایجاد سفارش جدید
    const newOrder = new Order({
      userId,
      items: items.map(item => ({
        id: item.productId,
        name: item.title,
        quantity: item.quantity,
        price: item.price,
        img: item.img
      })),
      totalAmount,
      status: 'pending',
      trackingCode: Math.random().toString(36).substring(2, 15).toUpperCase()
    });

    await newOrder.save();

    res.status(201).json({
      success: true,
      message: 'سفارش با موفقیت ثبت شد',
      orderId: newOrder._id,
      trackingCode: newOrder.trackingCode
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ 
      error: 'خطا در ثبت سفارش',
      details: error.message 
    });
  }
});

// **📌 دریافت سفارشات کاربر**
router.get("/", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: "❌ دریافت سفارشات ناموفق بود." });
  }
});

// **📌 بروزرسانی وضعیت سفارش (فقط برای ادمین)**
router.put("/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "❌ دسترسی غیرمجاز" });

  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id, 
      { status: req.body.status }, 
      { new: true }
    ).populate("userId", "fname lname email");

    if (!updatedOrder) {
      return res.status(404).json({ error: "سفارش یافت نشد" });
    }

    res.json({ 
      message: "✅ وضعیت سفارش بروزرسانی شد", 
      order: updatedOrder 
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ 
      error: "❌ خطا در بروزرسانی سفارش",
      details: error.message 
    });
  }
});

// دریافت سفارش‌های کاربر
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'خطا در دریافت سفارش‌ها' });
  }
});

// **📌 حذف سفارش (فقط برای ادمین)**
router.delete("/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "❌ دسترسی غیرمجاز" });

  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "✅ سفارش با موفقیت حذف شد" });
  } catch (error) {
    res.status(500).json({ error: "❌ حذف سفارش ناموفق بود." });
  }
});

export default router;
