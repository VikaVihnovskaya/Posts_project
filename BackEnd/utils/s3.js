import {
    S3Client,
    CreateBucketCommand,
    HeadBucketCommand,
    PutBucketPolicyCommand,
    PutObjectCommand,
    DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

// Создание клиента S3, совместимого с MinIO
export function createS3Client() {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    const region = process.env.S3_REGION || "us-east-1";

    if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new Error("S3 is not configured: check S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY env vars");
    }

    return new S3Client({
        region,
        endpoint,
        forcePathStyle: true, // обязательно для MinIO
        credentials: { accessKeyId, secretAccessKey },
    });
}

// Проверка существования бакета; если нет — создаём (для MinIO без LocationConstraint)
export async function ensureBucket(client, bucket) {
    try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        return false; // уже был
    } catch (e) {
        await client.send(
            new CreateBucketCommand({ Bucket: bucket })
        );
        return true; // создан
    }
}

// Делаем бакет публичным на чтение (GET для объектов)
export async function makeBucketPublicRead(client, bucket) {
    const policy = {
        Version: "2012-10-17",
        Statement: [
            {
                Sid: "PublicReadForObjects",
                Effect: "Allow",
                Principal: "*",
                Action: ["s3:GetObject"],
                Resource: [
                    `arn:aws:s3:::${bucket}/*`,
                ],
            },
        ],
    };

    await client.send(
        new PutBucketPolicyCommand({
            Bucket: bucket,
            Policy: JSON.stringify(policy),
        })
    );
}
export async function uploadBufferToS3({ client, bucket, key, buffer, contentType }) {
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
    }))
}

export function buildPublicUrl({ key, bucket }) {
    // Предпочитаем публичный URL хоста разработчика
    const publicBase = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT
    // Для MinIO с forcePathStyle=true путь вида http://host:port/bucket/key
    return `${publicBase.replace(/\/$/, '')}/${bucket}/${encodeURI(key)}`
}
export function keyFromPublicUrl(url, bucket) {
    const bases = [process.env.S3_PUBLIC_URL, process.env.S3_ENDPOINT]
        .filter(Boolean)
        .map(b => b.replace(/\/$/, ''))
    try {
        const u = new URL(url)
        for (const base of bases) {
            const bu = new URL(base)
            if (u.origin === bu.origin) {
                // ожидаем путь вида /bucket/key...
                const path = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
                const [bkt, ...rest] = path.split('/')
                if (bkt === bucket) return rest.join('/') || null
            }
        }
    } catch (_) { /* ignore */ }
    return null
}
// Пакетное удаление объектов (чанками по 1000)
export async function deleteObjects({ client, bucket, keys = [] }) {
    const uniq = Array.from(new Set(keys.filter(Boolean)))
    if (uniq.length === 0) return { ok: true, deleted: 0 }

    let deleted = 0
    for (let i = 0; i < uniq.length; i += 1000) {
        const chunk = uniq.slice(i, i + 1000)
        const res = await client.send(new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: chunk.map(Key => ({ Key })), Quiet: true },
        }))
        deleted += (res?.Deleted?.length || 0)
    }
    return { ok: true, deleted }
}