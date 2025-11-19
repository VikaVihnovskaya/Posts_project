import express from "express";
import User from "../models/User.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {errorHandler} from "../middleware/errorHandler.js";
import {verifyToken} from "../middleware/verifyToken.js";
import upload from "../middleware/uploadMiddleware.js";
import { buildPublicUrl, uploadBufferToS3 } from "../utils/s3.js";
import Category from "../models/Category.js";

const router = express.Router();

// POST /api/users/create → создание пользователя
router.post("/create", async (req, res, next) => {
    try {
        const {login, password} = req.body;
        // Дополнительная простая валидация
        if (!login || !password) {
            return res.status(400).json({message: "Login and password are required"});
        }
        const existingUser = await User.findOne({login});
        if (existingUser) {
            return res.status(409).json({message: "User already exists"});
        }
        // Хешируем пароль перед сохранением
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const user = new User({login, password: passwordHash});
        await user.save();
        res.status(201).json({
            message: "User created successfully",
            user: { id: user.id, login: user.login }
        });
    } catch (err) {
       next(err)
    }
});
//  POST /api/users/login (авторизация и установка cookie)
router.post("/login", async (req, res, next ) => {
    try {
        const {login, password} = req.body;

        if (!login || !password) {
            return res.status(400).json({message: "Login and password are required"});
        }
        const existingUser = await User.findOne({login});
        if (!existingUser) {
            return res.status(401).json({message: "Invalid login or password"});
        }
        // Сравниваем введённый пароль с хешем из БД
        const isPasswordValid = await bcrypt.compare(password, existingUser.password);
        if (!isPasswordValid) {
            return res.status(401).json({message: "Invalid login or password"});
        }
        const payload = {
            sub: existingUser.id,
            login: existingUser.login
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '5h'
        });
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "Strict",
            maxAge: 1000 * 60 * 60 * 5 //
        });
        res.status(200).json({message: "User login to system successfully"});
    } catch (err) {
       next(err)
    }
});
// POST /api/users/logout → удаление токена из cookie
router.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: "Strict"
    });
    res.status(200).json({ message: "Logged out successfully" });
});
// Текущий профиль (расширенный)
router.get("/", verifyToken, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.sub).lean();
        if (!user) return res.status(404).json({ message: "User not found" });
        const { _id, login, name = '', email = '', about = '', avatarUrl = '' } = user;
        res.json({ id: _id, login, name, email, about, avatarUrl });
    } catch (e) { next(e); }
});
//PUT /api/users/ — обновление профиля (без аватара)
router.put("/", verifyToken, async (req, res, next) => {
    try {
        const { name = "", email = "", about = "" } = req.body || {};

        // Мини-валидация email по желанию
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const user = await User.findByIdAndUpdate(
            req.user.sub,
            { $set: { name, email, about } },
            { new: true }
        );
        if (!user) return res.status(404).json({ message: "User not found" });

        const { _id, login, avatarUrl = '' } = user;
        res.json({ id: _id, login, name: user.name || '', email: user.email || '', about: user.about || '', avatarUrl });
    } catch (e) { next(e); }
});
//POST /api/users/avatar — загрузка аватара в S3/MinIO
router.post("/avatar", verifyToken, upload.single('avatar'), async (req, res, next) => {
    try {
        const s3 = req.app.locals.s3;
        const bucket = req.app.locals.s3Bucket;
        if (!s3) return res.status(500).json({ message: 'S3 not initialized' });
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        // Генерируем ключ: userId/avatar/<unique>.<ext>
        const ext = (req.file.originalname.match(/\.[a-zA-Z0-9]+$/) || [''])[0];
        const key = `${req.user.sub}/avatar/${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;

        await uploadBufferToS3({
            client: s3,
            bucket,
            key,
            buffer: req.file.buffer,
            contentType: req.file.mimetype,
        });

        const publicUrl = buildPublicUrl({ key, bucket });

        const user = await User.findByIdAndUpdate(
            req.user.sub,
            { $set: { avatarUrl: publicUrl } },
            { new: true }
        );
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.status(201).json({ avatarUrl: user.avatarUrl || '' });
    } catch (e) { next(e); }
});
// GET/api/users/check - профиль текущего пользователя (защищённый)
router.get("/check", verifyToken, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.sub).lean();
        if (!user) return res.status(404).json({ message: "User not found" });
        const { _id, login, name = '', email = '', about = '', avatarUrl = '' } = user;
        res.json({ id: _id, login, name, email, about, avatarUrl });
    } catch (e) { next(e); }
});
// GET /api/users/preferences — получить массив ObjectId предпочтительных категорий
router.get('/preferences', verifyToken, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.sub).select('preferredCategoryIds').lean();
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user.preferredCategoryIds || []);
    } catch (e) { next(e); }
});

// PUT /api/users/preferences — сохранить список предпочтений
router.put('/preferences', verifyToken, async (req, res, next) => {
    try {
        const { categoryIds } = req.body || {};
        if (!Array.isArray(categoryIds)) {
            return res.status(400).json({ message: 'categoryIds must be an array' });
        }
        // нормализуем и уникализируем
        const uniqIds = Array.from(new Set(categoryIds.map(String)));
        // валидация существования категорий
        const count = await Category.countDocuments({ _id: { $in: uniqIds } });
        if (count !== uniqIds.length) {
            return res.status(400).json({ message: 'Some categoryIds are invalid' });
        }
        const user = await User.findByIdAndUpdate(
            req.user.sub,
            { $set: { preferredCategoryIds: uniqIds } },
            { new: true, select: 'preferredCategoryIds' }
        ).lean();
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user.preferredCategoryIds);
    } catch (e) { next(e); }
});

// DELETE /api/users/preferences — очистить предпочтения
router.delete('/preferences', verifyToken, async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user.sub,
            { $set: { preferredCategoryIds: [] } },
            { new: true, select: 'preferredCategoryIds' }
        ).lean();
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user.preferredCategoryIds); // []
    } catch (e) { next(e); }
});
router.use(errorHandler)
export default router;