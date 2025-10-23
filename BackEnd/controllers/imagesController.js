import { uploadImagesForPost, deleteImageUrls } from '../services/imagesService.js'

export async function uploadImagesCtrl(req, res) {
    const s3 = req.app.locals.s3
    const bucket = req.app.locals.s3Bucket
    if (!s3) return res.status(500).json({ message: 'S3 not initialized' })

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' })
    }
    const post = req.post
    const newUrls = await uploadImagesForPost({ s3, bucket, post, files: req.files })
    post.imageUrls = [...(post.imageUrls || []), ...newUrls]
    await post.save()
    res.status(201).json({ imageUrls: post.imageUrls })
}

export async function deleteImagesCtrl(req, res) {
    const { urls } = req.body
    if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ message: 'Provide "urls" array in body' })
    }
    const s3 = req.app.locals.s3
    const bucket = req.app.locals.s3Bucket
    const post = req.post

    const safeUrls = await deleteImageUrls({ s3, bucket, post, urls })
    post.imageUrls = (post.imageUrls || []).filter(u => !safeUrls.includes(u))
    await post.save()
    res.json({ imageUrls: post.imageUrls })
}