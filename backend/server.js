import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";

import productRoutes from "./routes/productRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import User from "./models/User.js";
import orderRoutes from './routes/orderRoutes.js';
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// ✅ داینامیک و امن کردن CORS
const whitelist = [
  'https://rosegoldgalleryy.vercel.app',
  'https://rose-gold-gallery.vercel.app',
  'https://rose-gold-gallery-nhbbnv04y-sabas-projects-edc52f08.vercel.app',
  'https://rose-gold-gallery-sabas-projects-edc52f08.vercel.app',
  'https://rose-gold-xi.vercel.app',
  'https://rose-gold-sabas-projects-edc52f08.vercel.app',
  'https://rose-gold-git-main-sabas-projects-edc52f08.vercel.app',
  'http://localhost:3000',
  'https://rose-gold-galery.vercel.app',
'rose-gold-gal.vercel.app',
  'rose-gold-gallery-ts.vercel.app',
  'https://rose-gold-gallery-ts.vercel.app'

  
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`🚫 Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));

// 📦 Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use("/uploads", express.static("uploads"));

// 📦 Routes
app.use("/api", productRoutes);
app.use("/api", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/user", userRoutes);

// 🌐 MongoDB اتصال
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

// 🌐 تست سرور
app.get("/", (req, res) => {
  res.send("Server is running...");
});

// 📁 File Upload با multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images are allowed!"), false);
    }
    cb(null, true);
  }
});

// 🧾 Register
app.post("/api/register", async (req, res) => {
  try {
    const { fname, lname, email, mobile, pass, img, city, street, age } = req.body;

    if (!fname || !lname || !email || !mobile || !pass || !city || !street || !age) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.email === email ? "Email already exists" : "Mobile number already exists" 
      });
    }

    const hashedPass = await bcrypt.hash(pass, 10);

    const newUser = new User({
      fname, lname, email, mobile,
      pass: hashedPass,
      img: img || '',
      city, street,
      age: Number(age),
      role: 'user'
    });

    const validationError = newUser.validateSync();
    if (validationError) {
      return res.status(400).json({ error: "Validation failed", details: validationError.errors });
    }

    await newUser.save();
    res.status(201).json({ success: true, message: "User registered successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Registration failed", details: error.message });
  }
});

// 🔐 Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, pass } = req.body;
    const user = await User.findOne({ email }).select('-__v');

    if (!user) return res.status(404).json({ error: "User not found!" });

    const isMatch = await bcrypt.compare(pass, user.pass);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const userData = {
      id: user._id,
      fname: user.fname,
      lname: user.lname,
      email: user.email,
      mobile: user.mobile,
      city: user.city,
      street: user.street,
      age: user.age,
      role: user.role,
      img: user.img
    };

    res.json({ token, user: userData });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// 🔐 Middleware Auth
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token missing or malformed" });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ error: "Invalid token" });
      req.user = decoded;
      next();
    });
  } catch (error) {
    res.status(500).json({ error: "Authentication error" });
  }
};

// 🔐 فقط ادمین
app.get("/api/admin", authMiddleware, (req, res) => {
  if (req.user.status !== "Main Admin") {
    return res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
  res.json({ message: "Welcome to Admin Dashboard" });
});

// 👤 Get User Profile
app.get("/api/login", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-pass');
    if (!user) {
      return res.status(404).json({ error: "کاربر یافت نشد" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "خطا در دریافت اطلاعات کاربر" });
  }
});

// ▶️ Start server
app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});

export default app;

