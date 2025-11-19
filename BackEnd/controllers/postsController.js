import { parsePaging } from '../utils/paging.js'
import { reconcilePublishFields } from '../utils/publishCheck.js'
import { listPosts, getPostById, createPost, updatePostEntity, deletePostById } from '../services/postsService.js'
import mongoose from "mongoose";
import User from "../models/User.js"

export async function getPosts(req, res) {
    const { limit, page } = parsePaging(req)
    const requestedOwner = req.query.owner
    const requestedStatus = req.query.status // 'draft' | 'published' | undefined
    // Парс дат из query (ожидаем YYYY-MM-DD)
    const { dateFrom, dateTo } = req.query
    let startDate = null
    let endDate = null
    if (dateFrom) {
        const parsedStart = new Date(dateFrom)
        if (!isNaN(parsedStart)) {
            startDate = new Date(Date.UTC(parsedStart.getUTCFullYear(), parsedStart.getUTCMonth(), parsedStart.getUTCDate(), 0, 0, 0, 0))
        }
    }
    if (dateTo) {
        const parsedEnd = new Date(dateTo)
        if (!isNaN(parsedEnd)) {
            endDate = new Date(Date.UTC(parsedEnd.getUTCFullYear(), parsedEnd.getUTCMonth(), parsedEnd.getUTCDate(), 23, 59, 59, 999))
        }
    }
    // Категории: строка "id1,id2" или массив
    let categoryIds = []
    const rawCategories = req.query.categories
    if (Array.isArray(rawCategories)) {
        categoryIds = rawCategories.map(String)
    } else if (typeof rawCategories === 'string' && rawCategories.trim() !== '') {
        categoryIds = rawCategories.split(',').map(s => s.trim()).filter(Boolean)
    }
    // Валидируем ObjectId
    categoryIds = categoryIds.filter(id => mongoose.Types.ObjectId.isValid(id))
    if (!categoryIds.length) categoryIds = null

    // Теги: строка "t1,t2" или массив
    let tags = []
    const rawTags = req.query.tags
    if (Array.isArray(rawTags)) {
        tags = rawTags.map(String).map(s => s.trim()).filter(Boolean)
    } else if (typeof rawTags === 'string' && rawTags.trim() !== '') {
        tags = rawTags.split(',').map(s => s.trim()).filter(Boolean)
    }
    if (!tags.length) tags = null
    // Режим сопоставления тегов: contains | exact | any | all
    const rawMatch = String(req.query.match || '').toLowerCase()
    const allowed = new Set(['contains', 'exact', 'any', 'all'])
    const match = allowed.has(rawMatch) ? rawMatch : 'contains'
    // Сортировка: поддерживает два формата — sort=createdAt:asc|desc и пару sortBy+order
    const allowedSortBy = new Set(['createdAt'])
    let sortBy = 'createdAt'
    let order = -1 // desc
    //  sort=createdAt:asc|desc
    const rawSort = typeof req.query.sort === 'string' ? req.query.sort.trim() : ''
    if (rawSort) {
        const [field, sortDirection] = rawSort.split(':')
        if (allowedSortBy.has(field)) sortBy = field
        order = String(sortDirection).toLowerCase() === 'asc' ? 1 : -1
    }
    // sortBy=createdAt&order=asc|desc (приоритетнее, если передан)
    if (typeof req.query.sortBy === 'string') {
        const field = req.query.sortBy.trim()
        if (allowedSortBy.has(field)) sortBy = field
    }
    if (typeof req.query.order === 'string') {
        order = req.query.order.toLowerCase() === 'asc' ? 1 : -1
    }
    //  поиск
    const q = (req.query.q || '').trim()
    // если owner=me — показываем только посты текущего пользователя
    if (requestedOwner === 'me') {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
        const { items, total } = await listPosts({
            userId: req.user.sub,
            limit,
            page,
            ownerOnly: true ,
            status: requestedStatus,
            dateFrom: startDate,
            dateTo: endDate,
            categoryIds,
            tags,
            match,
            sortBy,
            order,
            q,
        })
        return res.json({ items, page, limit, total })
    }
    const userId = req.user?.sub || null
    let preferredCategoryIds = []
    if (req.user?.sub) {
        const userCategoryPrefs = await User.findById(req.user.sub).select('preferredCategoryIds').lean()
        preferredCategoryIds = userCategoryPrefs?.preferredCategoryIds || []
    }
    const { items, total } = await listPosts({
        userId,
        limit,
        page,
        dateFrom: startDate,
        dateTo: endDate,
        categoryIds,
        tags,
        match,
        sortBy,
        order,
        q,
        preferredCategoryIds,
    })
    res.json({ items, page, limit, total })
}

export async function getPost(req, res) {
    const { id } = req.params
    const post = await getPostById(id)
    if (!post) return res.status(404).json({ message: 'Post not found' })
    if (post.status !== 'published') {
        if (!req.user || String(post.userId) !== String(req.user.sub)) {
            return res.status(403).json({ message: 'Post is not public' })
        }
    }
    res.json(post)
}

export async function createPostCtrl(req, res) {
    const post = await createPost({ data: req.body, userId: req.user.sub })
    reconcilePublishFields(post)
    await post.save()
    res.status(201).json(post)
}

export async function updatePostCtrl(req, res) {
    const post = await updatePostEntity(req.post, req.body)
    reconcilePublishFields(post)
    await post.save()
    // Вернём уже популированный пост
    await post.populate({ path: 'categories', select: 'name' })
    res.json(post)
}

export async function deletePostCtrl(req, res) {
    const s3 = req.app.locals.s3
    const bucket = req.app.locals.s3Bucket
    const post = req.post

    // Удаление файлов из бакета (best-effort)
    if (s3 && bucket && (post.imageUrls?.length)) {
        const { keyFromPublicUrl, deleteObjects } = await import('../utils/s3.js')
        const keys = post.imageUrls.map(u => keyFromPublicUrl(u, bucket)).filter(Boolean)
        if (keys.length) {
            try { await deleteObjects({ client: s3, bucket, keys }) } catch (e) { console.warn('MinIO cleanup failed', String(post._id), e) }
        }
    }
    await deletePostById(post._id)
    res.status(204).send()
}