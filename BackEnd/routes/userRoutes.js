import express from "express";
import User from "../models/User.js";
import jwt from 'jsonwebtoken';
import {verifyToken} from "../middleware/verifyToken.js";

const router = express.Router();

// POST /api/users/create → создание пользователя
router.post("/create", async (req, res) => {
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

        const user = new User({login, password});
        await user.save();
        console.log(user);
        res.status(201).json({message: "User created successfully", user});
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({message: "Internal server error"});
    }
});
//  POST /api/users/login (авторизация и получение токена)
router.post("/login", async (req, res) => {
    try {
        const {login, password} = req.body;

        if (!login || !password) {
            return res.status(400).json({message: "Login and password are required"});
        }

        const existingUser = await User.findOne({login});
        if (!existingUser) {
            return res.status(404).json({message: "User not found!"});
        }

        const payload = {
            login: existingUser.login
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '1h'
        });
        res.status(200).json({message: "User login to system successfully", token});
    } catch (error) {
        console.error("Error is occurred during login:", error);
        res.status(500).json({message: "Internal server error"});
    }
});
// GET/api/users Получить всех юзеров
router.get("/", verifyToken, async (req, res) => {
    try {
        const filter = {};
        const allUsers = await User.find(filter);

        const usersDetails = allUsers.map(user => {
                return {
                    id: user.id,
                    login: user.login
                };
            }
        );

        res.status(200).json({usersDetails});
    } catch (error) {
        console.error("Error fetching users details:", error);
        res.status(500).json({message: "Internal server error"});
    }
});

export default router;