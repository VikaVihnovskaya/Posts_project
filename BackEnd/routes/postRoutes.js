import express from 'express'
import Comment from '../models/Comment.js'
import Post from '../models/Post.js'
import {errorHandler} from "../middleware/errorHandler.js";
import {checkPostOwner} from "../middleware/checkPostOwner.js";
import {validateCommentContent} from "../middleware/validateCommentContent.js";
import {validateObjectId} from "../middleware/validateObjectId.js";
import {validatePublishedPost} from "../middleware/validatePublishedPost.js";
import {verifyToken} from '../middleware/verifyToken.js'
import {optionalVerifyToken} from '../middleware/optionalVerifyToken.js'
import Category from "../models/Category.js";
import {buildPublicUrl, uploadBufferToS3, keyFromPublicUrl, deleteObjects } from '../utils/s3.js'
import multer from 'multer'

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 10 },
    fileFilter: (req, file, cb) => {
        if (/^image\//.test(file.mimetype)) cb(null, true)
        else cb(new Error('Only image files are allowed'))
    },
})

const router = express.Router()
function parsePaging(req) {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100)
    const page = Math.max(parseInt(req.query.page || '0', 10), 0)
    return { limit, page }
}

function reconcilePublishFields(doc) {
    if (doc.status === 'published') {
        if (!doc.publishedAt) doc.publishedAt = new Date()
    } else {
        doc.publishedAt = null
    }
}
//GET / — список постов (публичный + собственные непубличные для владельца)
router.get('/', optionalVerifyToken, async (req, res, next) => {
    try {
        const { limit, page } = parsePaging(req)
        let filter = { status: 'published' }
        if (req.user?.sub){
            filter = {
                $or: [
                    { status: 'published' },
                    { userId: req.user.sub },
                ]
            }
        }
        const [items, total] = await Promise.all([
            Post.find(filter)
                .sort({ publishedAt: -1, id: -1 })
                .limit(limit)
                .skip(page * limit)
                .lean(),
            Post.countDocuments(filter),
        ])
        res.json({ items, page, limit, total })
    } catch (err){
        next(err)
    }
})


// GET /:id — получить один пост (публичный)
router.get('/:id', optionalVerifyToken, validateObjectId('id'), async (req, res, next) => {
    try {
        const { id } = req.params
        const post = await Post.findById(id).populate('categories', 'name').lean()
        if (!post) return res.status(404).json({ message: 'Post not found' })

        if (post.status !== 'published') {
            if (!req.user || String(post.userId) !== String(req.user.sub)) {
                return res.status(403).json({ message: 'Post is not public' })
            }
        }
        res.json(post)
    } catch (err) {
        next(err)
    }
})
// POST api/posts/create — создать пост (ТОЛЬКО авторизованным, через verifyToken)
router.post('/', verifyToken, async (req, res, next) => {
    try {
        const { title, summary, details, author, status, categories, tags } = req.body

        const obtainedCategories = await Category.find({name: {$in: categories}});
        const doc = new Post({
            title,
            summary,
            details,
            author,
            status,
            categories: obtainedCategories,
            tags: Array.isArray(tags) ? tags : tags,
            userId: req.user.sub,
        })
        reconcilePublishFields(doc)

        await doc.save()
        res.status(201).json(doc)
    } catch (err) {
        next(err)
    }
})

// PUT/:id — редактировать свой пост (ТОЛЬКО авторизованным)
router.put('/:id',
    verifyToken,
    validateObjectId('id'),
    checkPostOwner,
    async (req, res, next) => {
    try {
        const post = req.post
        const { title, summary, details, status, categories, tags } = req.body
        if (title !== undefined) post.title = title
        if (summary !== undefined) post.summary = summary
        if (details !== undefined) post.details = details
        if (status !== undefined) post.status = status

        if (categories !== undefined) {
            post.categories = await Category.find({name: {$in: categories}})
        }
        if (tags !== undefined) {
            post.tags = Array.isArray(tags) ? tags : [tags]
        }
        reconcilePublishFields(post)
        await post.save()
        res.json(post)
    } catch (err) {
        next(err)
    }
})
// DELETE /:id — удалить свой пост (ТОЛЬКО авторизованным)
router.delete('/:id',
    verifyToken,
    validateObjectId('id'),
    checkPostOwner,
    async (req, res, next) => {
    try {
        const s3 = req.app.locals.s3
        const bucket = req.app.locals.s3Bucket
        const post = req.post
            // Список ключей из URL-ов поста
        const keys = (post.imageUrls || [])
                 .map(u => keyFromPublicUrl(u, bucket))
                 .filter(Boolean)

            // Чистим MinIO (не прерываем удаление поста, если MinIO недоступен)
               if (s3 && bucket && keys.length) {
                  try {
                      await deleteObjects({ client: s3, bucket, keys })
                       } catch (e) {
                        console.warn('MinIO cleanup failed for post', String(post._id), e)
                      }
                }

                 await Post.deleteOne({ _id: post._id })
            return res.status(204).send()
    } catch (err) {
        next(err)
    }
})

// POST /api/posts/:id/images — загрузка одного или нескольких изображений к посту владельца
router.post('/:id/images',
    verifyToken,
    validateObjectId('id'),
    checkPostOwner,
    upload.array('images', 10),
    async (req, res, next) => {
        try {
            const s3 = req.app.locals.s3
            const bucket = req.app.locals.s3Bucket
            if (!s3) return res.status(500).json({ message: 'S3 not initialized' })

            const post = req.post
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: 'No files uploaded' })
            }

            // Генерим префикс ключей: userId/postId/
            const prefix = `${post.userId}/${post._id}/`

            const newUrls = []
            for (const file of req.files) {
                // Можно добавить UUID к имени, чтобы избежать коллизий
                const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                // Сохраняем исходное расширение (если есть)
                const ext = (file.originalname.match(/\.[a-zA-Z0-9]+$/) || [''])[0]
                const key = `${prefix}${unique}${ext}`

                await uploadBufferToS3({
                    client: s3,
                    bucket,
                    key,
                    buffer: file.buffer,
                    contentType: file.mimetype,
                })
                const url = buildPublicUrl({ key, bucket })
                newUrls.push(url)
            }
            // Дополняем документ
            post.imageUrls = [...(post.imageUrls || []), ...newUrls]
            await post.save()

            res.status(201).json({ imageUrls: post.imageUrls })
        } catch (err) {
            next(err)
        }
    }
)
// DELETE /api/posts/:id/images — удалить одно или несколько изображений из поста (по URL)
router.delete(
    '/:id/images',
    verifyToken,
    validateObjectId('id'),
    checkPostOwner,
    async (req, res, next) => {
        try {
            const { urls } = req.body // массив строк URL
            if (!Array.isArray(urls) || urls.length === 0) {
                return res.status(400).json({ message: 'Provide "urls" array in body' })
            }
            const s3 = req.app.locals.s3
            const bucket = req.app.locals.s3Bucket
            const post = req.post
            // Удаляем только те URL, что реально есть у поста
            const current = new Set(post.imageUrls || [])
            const safeUrls = urls.filter(u => current.has(u))

            if (safeUrls.length && s3 && bucket) {
                const keys = safeUrls.map(u => keyFromPublicUrl(u, bucket)).filter(Boolean)
                if (keys.length) {
                    try {
                        await deleteObjects({ client: s3, bucket, keys })
                    } catch (e) {
                        console.warn('MinIO delete failed for images of post', String(post._id), e)
                    }
                }
            }

            // Синхронизируем БД: убираем URL-ы из документа
            const before = post.imageUrls || []
            post.imageUrls = before.filter(u => !safeUrls.includes(u))
                 await post.save()
                 res.json({ imageUrls: post.imageUrls })

        } catch (err) {
            next(err)
        }
    }
)
// Список комментариев к посту (публично, но только для опубликованных постов)
router.get('/:id/comments', validatePublishedPost('id'), async (req, res, next) => {
    try {
        const { id } = req.params
        const raw = await Comment.find({ postId: id })
            .sort({ createdAt: 1 })
            .populate('userId', 'login') // тянем логин автора
            .lean()
        const comments = raw.map(c => ({
            ...c,
            author: c.userId?.login || 'Unknown',
        }))
        res.json({ items: comments })
    } catch (err){
        next(err)
    }

})
// Создать комментарий (только авторизованным) к опубликованному посту
router.post('/:id/comments',
    verifyToken,
    validatePublishedPost('id'),
    validateCommentContent,
    async (req, res, next) => {
    try {
        const { id } = req.params
        const { content } = req.body
        const created = await Comment.create({postId: id, userId: req.user.sub, content,
        })
        const c = await Comment.findById(created._id)
            .populate('userId', 'login')
            .lean()
        const response = {
            ...c,
            author: c.userId?.login || 'Unknown',
        }
        res.status(201).json(response)
    } catch (err) {
        next(err)
    }
})
// Обновить свой комментарий к опубликованному посту
router.put('/:postId/comments/:commentId',
    verifyToken,
    validatePublishedPost('postId'),
    validateObjectId('commentId'),
    validateCommentContent,
    async (req, res, next) => {
    try {
        const { postId, commentId } = req.params
        const { content } = req.body
        const comment = await Comment.findOne({ _id: commentId, postId, userId: req.user.sub })
        if (!comment) return res.status(404).json({ message: 'Comment not found' })

        comment.content = content
        await comment.save()

        const c = await Comment.findById(comment._id).populate('userId', 'login').lean()
        const response = { ...c, author: c.userId?.login || 'Unknown' }
        res.json(response)
    } catch (err) {
       next(err)
    }
})

// Удалить свой комментарий к опубликованному посту
router.delete('/:postId/comments/:commentId',
    verifyToken,
    validatePublishedPost('postId'),
    validateObjectId('commentId'),
    async (req, res, next ) => {
    try {
        const { postId, commentId } = req.params
        const result = await Comment.deleteOne({ _id: commentId, postId, userId: req.user.sub })
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Comment not found' })
        }

        return res.status(204).send()
    } catch (err) {
       next(err)
    }
})
router.use(errorHandler)
export default router