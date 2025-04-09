import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../models/Product.js';

const router = express.Router();

// تبدیل __dirname برای ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تنظیمات Multer برای ذخیره فایل‌ها
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // ذخیره در پوشه uploads
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // تغییر نام فایل
    }
});

const upload = multer({ storage: storage });

// گرفتن همه محصولات
router.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const products = await Product.find({ category });

        res.json(products);
    } catch (err) {
        res.status(500).json({ message: 'خطا در دریافت محصولات', error: err });
    }
});

// اضافه کردن محصول جدید + آپلود عکس
router.post('/products', upload.single('img'), async (req, res) => {
    console.log('📥 Body:', req.body);
    console.log('📸 File:', req.file);
    
    try {
        const { title, price, weight, description, category } = req.body;

        if (!req.file || !title || !price || !weight || !description || !category) {
            return res.status(400).json({ message: 'اطلاعات محصول ناقص است!' });
        }

        const newProduct = new Product({
            img: req.file.filename, // Store only the filename
            title,
            price,
            weight,
            description,
            category
        });

        await newProduct.save();
        res.status(201).json({ message: '✅ محصول با موفقیت ذخیره شد!', product: newProduct });
    } catch (err) {
        res.status(500).json({ message: '❌ خطا در ذخیره محصول', error: err.message });
    }
});

// حذف محصول
router.delete('/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'محصول حذف شد!' });
    } catch (err) {
        res.status(500).json({ message: 'خطا در حذف محصول', error: err });
    }
});

export default router;
