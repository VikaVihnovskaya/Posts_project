import { buildPublicUrl, uploadBufferToS3, keyFromPublicUrl, deleteObjects } from '../utils/s3.js'

export async function uploadImagesForPost({ s3, bucket, post, files }) {
    const prefix = `${post.userId}/${post._id}/`
    const newUrls = []

    for (const file of files) {
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const ext = (file.originalname.match(/\.[a-zA-Z0-9]+$/) || [''])[0]
        const key = `${prefix}${unique}${ext}`
        await uploadBufferToS3({ client: s3, bucket, key, buffer: file.buffer, contentType: file.mimetype })
        newUrls.push(buildPublicUrl({ key, bucket }))
    }
    return newUrls
}

export async function deleteImageUrls({ s3, bucket, post, urls }) {
    const current = new Set(post.imageUrls || [])
    const safeUrls = urls.filter(u => current.has(u))
    if (safeUrls.length && s3 && bucket) {
        const keys = safeUrls.map(u => keyFromPublicUrl(u, bucket)).filter(Boolean)
        if (keys.length) {
            try {
                await deleteObjects({ client: s3, bucket, keys })
            } catch (e) {
                console.warn('MinIO delete failed', String(post._id), e)
            }
        }
    }
    return safeUrls
}