import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import { createS3Client, ensureBucket, makeBucketPublicRead } from "./utils/s3.js";

const app = express();
const PORT = process.env.PORT || 3000;

// В Docker всегда доступ к Mongo через имя сервиса "mongo"
const MONGO_URL = process.env.MONGO_URL;
// S3/MinIO настройки
const S3_BUCKET = process.env.S3_BUCKET || "posts";

// Базовые middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health — жив ли процесс
app.get("/health/live", (req, res) => res.status(200).json({ status: "ok" }));
// Подключение роутов
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);

// Глобальные ссылки на внешние ресурсы
app.locals.s3 = null;
app.locals.s3Bucket = S3_BUCKET;

async function start() {
    try {
        // 1) Подключение к Mongo
        await mongoose.connect(MONGO_URL);
        console.log(`✅ MongoDB connected at ${MONGO_URL}`);

        // 2) Инициализация S3
        const s3 = createS3Client();
        app.locals.s3 = s3;

        //  создаём бакет и делаем публичным на чтение
        const created = await ensureBucket(s3, S3_BUCKET);
        if (created) {
            console.log(`Bucket '${S3_BUCKET}' created`);
            await makeBucketPublicRead(s3, S3_BUCKET);
            console.log(`Bucket '${S3_BUCKET}' policy: public read for objects`);
        } else {
            console.log(`Bucket '${S3_BUCKET}' exists`);
        }

        // 3) Readiness — проверка связности с БД и S3
        app.get("/health/ready", async (req, res) => {
            const mongoOk = mongoose.connection.readyState === 1; // 1 = connected
            let s3Ok = false;
            try {
                // Быстрая проверка S3: HeadBucket
                await app.locals.s3.send(new (await import("@aws-sdk/client-s3")).HeadBucketCommand({ Bucket: S3_BUCKET }));
                s3Ok = true;
            } catch (e) {
                s3Ok = false;
            }
            const ok = mongoOk && s3Ok;
            res.status(ok ? 200 : 503).json({ mongo: mongoOk, s3: s3Ok });
        });

        // 4) Старт сервера
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    } catch (err) {
        console.error("❌ Startup error:", err);
        process.exit(1);
    }
}

start();