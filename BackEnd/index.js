import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import userRoutes from "./routes/userRoutes.js";

const app = express();
const PORT = process.env.PORT;

// В Docker всегда доступ к Mongo через имя сервиса "mongo"
const MONGO_URL = process.env.MONGO_URL;

// Middleware для парсинга JSON
app.use(bodyParser.json());

// Подключение роутов
app.use("/api/users", userRoutes);

// Подключение к MongoDB
mongoose
    .connect(MONGO_URL)
    .then(() => {
        console.log(`✅ MongoDB connected at ${MONGO_URL}`);
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch((err) => console.error("❌ MongoDB connection error:", err));