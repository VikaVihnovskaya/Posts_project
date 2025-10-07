import express from 'express'
import mongoose from 'mongoose'
import Comment from '../models/Comment.js'
import Post from '../models/Post.js'
import {verifyToken} from '../middleware/verifyToken.js'
import { optionalVerifyToken } from '../middleware/optionalVerifyToken.js'
import Category from "../models/Category.js";

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
router.get('/', optionalVerifyToken, async (req, res) => {
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
        console.error(err)
        res.status(500).json({ message: 'Failed to load posts' })
    }
})


// GET /:id — получить один пост (публичный)
router.get('/:id', optionalVerifyToken, async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid post id' })
    const post = await Post.findById(id).populate('categories', 'name').lean()
    if (!post) return res.status(404).json({ message: 'Post not found' })

    if (post.status !== 'published') {
        if (!req.user || String(post.userId) !== String(req.user.sub)) {
            return res.status(403).json({ message: 'Post is not public' })
        }
    }
    res.json(post)
})

// POST api/posts/create — создать пост (ТОЛЬКО авторизованным, через verifyToken)
router.post('/', verifyToken, async (req, res) => {
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
        console.error(err)
        if (err?.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', errors: err.errors })
        }
        res.status(500).json({ message: 'Failed to create post' })
    }
})

// PUT/:id — редактировать свой пост (ТОЛЬКО авторизованным)
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid post ID' })
        }
        const post = await Post.findById(id)

        if (!post) {
            return res.status(404).json({ message: 'Post not found' })
        }
        // Проверка прав — текущий пользователь должен быть владельцем поста
        if (String(post.userId) !== req.user.sub) {
            return res.status(403).json({ message: 'You are not allowed to edit this post' })
        }
        // Обновляем поля
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
        console.error(err)
        if (err?.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', errors: err.errors })
        }
        res.status(500).json({ message: 'Failed to update post' })
    }
})

// DELETE /:id — удалить свой пост (ТОЛЬКО авторизованным)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ message: 'Invalid id' })

        const post = await Post.findById(id)
        if (!post)
            return res.status(404).json({ message: 'Post not found' })

        if (String(post.userId) !== String(req.user.sub)) {
            return res.status(403).json({ message: 'Forbidden' })
        }
        await Post.deleteOne({ _id: id })
        return res.status(204).send()
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Failed to delete post' })
    }
})

// Список комментариев к посту (публично, но только для опубликованных постов)
router.get('/:id/comments', async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid post id' })
    }
    const post = await Post.findById(id).select('status').lean()
    if (!post) return res.status(404).json({ message: 'Post not found' })

    if (post.status !== 'published') {
        return res.status(403).json({ message: 'Post is not public' })
    }
    const raw = await Comment.find({ postId: id })
        .sort({ createdAt: 1 })
        .populate('userId', 'login') // тянем логин автора
        .lean()
    const comments = raw.map(c => ({
        ...c,
        author: c.userId?.login || 'Unknown',
    }))
    res.json({ items: comments })
})
// Создать комментарий (только авторизованным) к опубликованному посту
router.post('/:id/comments', verifyToken, async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid post id' })
        }

        const post = await Post.findById(id).select('status')
        if (!post) return res.status(404).json({ message: 'Post not found' })

        if (post.status !== 'published') {
            return res.status(403).json({ message: 'Post is not public' })
        }
        const content = (req.body?.content || '').trim()
        if (!content) {
            return res.status(400).json({ message: 'Content is required' })
        }

        const created = await Comment.create({
            postId: id,
            userId: req.user.sub,
            content,
        })
        // Возвращаем комментарий с автором (login)
        const c = await Comment.findById(created._id)
            .populate('userId', 'login')
            .lean()

        const response = {
            ...c,
            author: c.userId?.login || 'Unknown',
        }
        res.status(201).json(response)
    } catch (err) {
        console.error(err)
        if (err?.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', errors: err.errors })
        }
        res.status(500).json({ message: 'Failed to add comment' })
    }
})
// Обновить свой комментарий к опубликованному посту
router.put('/:postId/comments/:commentId', verifyToken, async (req, res) => {
    try {
        const { postId, commentId } = req.params
        if (!mongoose.isValidObjectId(postId) || !mongoose.isValidObjectId(commentId)) {
            return res.status(400).json({ message: 'Invalid id' })
        }

        const post = await Post.findById(postId).select('status')
        if (!post) return res.status(404).json({ message: 'Post not found' })
        if (post.status !== 'published') {
            return res.status(403).json({ message: 'Post is not public' })
        }

        const content = (req.body?.content || '').trim()
        if (!content) return res.status(400).json({ message: 'Content is required' })

        // Находим комментарий, который принадлежит текущему пользователю
        const comment = await Comment.findOne({ _id: commentId, postId, userId: req.user.sub })
        if (!comment) return res.status(404).json({ message: 'Comment not found' })

        comment.content = content
        await comment.save()

        const c = await Comment.findById(comment._id).populate('userId', 'login').lean()
        const response = { ...c, author: c.userId?.login || 'Unknown' }
        res.json(response)
    } catch (err) {
        console.error(err)
        if (err?.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', errors: err.errors })
        }
        res.status(500).json({ message: 'Failed to update comment' })
    }
})

// Удалить свой комментарий к опубликованному посту
router.delete('/:postId/comments/:commentId', verifyToken, async (req, res) => {
    try {
        const { postId, commentId } = req.params
        if (!mongoose.isValidObjectId(postId) || !mongoose.isValidObjectId(commentId)) {
            return res.status(400).json({ message: 'Invalid id' })
        }

        const post = await Post.findById(postId).select('status')
        if (!post) return res.status(404).json({ message: 'Post not found' })
        if (post.status !== 'published') {
            return res.status(403).json({ message: 'Post is not public' })
        }

        const result = await Comment.deleteOne({ _id: commentId, postId, userId: req.user.sub })
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Comment not found' })
        }

        return res.status(204).send()
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Failed to delete comment' })
    }
})
export default router