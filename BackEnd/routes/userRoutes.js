import express from "express";
import User from "../models/User.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {verifyToken} from "../middleware/verifyToken.js";

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

        // Возвращаем ответ без пароля
        res.status(201).json({
            message: "User created successfully",
            user: { id: user.id, login: user.login }
        });
    } catch (error) {
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
            // Не раскрываем, что именно не так
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
            maxAge: 1000 * 60 * 60 * 5 // 5 часов
        });
        res.status(200).json({message: "User login to system successfully"});
    } catch (error) {
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
// GET/api/users Получить всех юзеров(только авторизованным)
router.get("/", verifyToken, async (req, res, next ) => {
    try {
        const allUsers = await User.find();

        const usersDetails = allUsers.map(user => {
                return {
                    id: user.id,
                    login: user.login
                };
            }
        );
        res.status(200).json({usersDetails});
    } catch (error) {
        next(err)
    }
});

// GET/api/users/check - профиль текущего пользователя (защищённый)
router.get("/check", verifyToken, (req, res) => {
    res.status(200).json({
        id: req.user.sub,
        login: req.user.login
    });
});

export default router;