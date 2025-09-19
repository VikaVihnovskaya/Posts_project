import express from "express";
import User from "../models/User.js";

const router = express.Router();

// POST /api/users/create → создание пользователя
router.post("/create", async (req, res) => {
    try {
        const { login, password } = req.body;

        // Дополнительная простая валидация
        if (!login || !password) {
            return res.status(400).json({ message: "Login and password are required" });
        }

        const existingUser = await User.findOne({ login });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists" });
        }

        const user = new User({ login, password });
        await user.save();
        console.log(user);
        res.status(201).json({ message: "User created successfully", user });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;