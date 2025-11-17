import mongoose from 'mongoose'
import Post from '../models/Post.js'
import Category from '../models/Category.js'
const { Types } = mongoose
function isValidObjectIdArray(arr) {
    return Array.isArray(arr) && arr.every(id => Types.ObjectId.isValid(id))
}
async function assertCategoriesExist(categoryIds) {
    if (!categoryIds?.length) return

    const existingCategoriesCount = await Category.countDocuments({
        _id: { $in: categoryIds },
    })

    if (existingCategoriesCount !== categoryIds.length) {
        const err = new Error('One or more categories not found')
        err.status = 404
        throw err
    }
}
// Вспомогательные функции
function normalizeTags(input) {
    const arr = Array.isArray(input) ? input : [input]
    const set = new Set(
        arr
            .map(String)
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => s.toLowerCase())
    )
    return Array.from(set)
}

function escapeRegex(str) {
    // Экранируем спецсимволы RegExp, чтобы тег совпадал по точному значению
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
export async function listPosts({
                                    userId,
                                    limit,
                                    page,
                                    ownerOnly = false,
                                    status,
                                    dateFrom,
                                    dateTo,
                                    categoryIds,
                                    tags,
                                    match,
                                    sortBy = 'createdAt',
                                    order = -1,
                                    q,
                                }) {
    // Формируем фильтр по диапазону дат
    const dateFilter = {}
    if (dateFrom) dateFilter.$gte = dateFrom
    if (dateTo) dateFilter.$lte = dateTo
    const hasDateFilter = Object.keys(dateFilter).length > 0
    const hasCategoryFilter = Array.isArray(categoryIds) && categoryIds.length > 0
    const categoryFilter = hasCategoryFilter ? { categories: { $in: categoryIds } } : null
        // Режимы сопоставления по тегам: contains | exact | any | all
        // - contains: подстрока, OR
        // - exact: точное совпадение, OR
        // - any: подстрока, OR (синоним contains)
        // - all: подстрока, AND (каждый термин должен встретиться в каком-либо теге поста)
    const mode = (typeof match === 'string' ? match.toLowerCase() : 'contains')
    const hasTagFilter = Array.isArray(tags) && tags.length > 0
    const terms = hasTagFilter
           ? tags.map(String).map(s => s.trim()).filter(Boolean)
           : []
    let tagFilter = null
    if (hasTagFilter) {
        const isExact = mode === 'exact'
        const isAll = mode === 'all'
        const regexes = terms.map(t => {
            return isExact
                ? new RegExp(`^${escapeRegex(t)}$`, 'i')
                : new RegExp(escapeRegex(t), 'i')
        })
        if (isAll) {
            // AND между терминами: каждый regex должен найтись хотя бы в одном элементе массива tags
            tagFilter = { $and: regexes.map(r => ({ tags: { $in: [r] } })) }
        } else {
            // OR между терминами
            tagFilter = { tags: { $in: regexes } }
        }
    }
    let filter = {}

    //  1. Если запрошены только свои посты
    if (ownerOnly) {
        filter.userId = userId
        // Ограничение по статусу (draft/published)
        if (['draft', 'published'].includes(status)) {
            filter.status = status
        }
        // Если задан диапазон дат, выбираем поле в зависимости от статуса
        if (hasDateFilter) {
            const dateField = filter.status === 'published' ? 'publishedAt' : 'createdAt'
            filter[dateField] = dateFilter
        }
        //  2. Если пользователь авторизован, но не только свои
    } else if (userId) {
        if (hasDateFilter) {
            filter = {
                $or: [
                    { status: 'published', publishedAt: dateFilter },
                    { userId, createdAt: dateFilter },
                ],
            }
        } else {
            filter = { $or: [{ status: 'published' }, { userId }] }
        }

        // 3. Если пользователь не авторизован
    } else {
        filter = { status: 'published' }
        if (hasDateFilter) filter.publishedAt = dateFilter
    }
    // Поиск по q: title, author (строка)
    const qTrim = (q || '').trim()
    if (qTrim) {
        const rx = new RegExp(escapeRegex(qTrim), 'i')
        filter.$or = (filter.$or || []).concat([
            { title: rx },
            { author: rx },
        ])
    }
    // Склеиваем с фильтром по категориям через $and, если он есть
    const andParts = [filter]
    if (categoryFilter) andParts.push(categoryFilter)
    if (tagFilter) andParts.push(tagFilter)
    const finalFilter = andParts.length > 1 ? { $and: andParts } : andParts[0]

   // Сортировка. Направление сортировки: 1 — по возрастанию, -1 — по убыванию
    const sortDirection = order === 1 ? 1 : -1
// Базовая сортировка (по убыванию ID)
    let sortOptions = { _id: -1 }
// Определяем поле сортировки
    if (sortBy === 'createdAt') {
        if (ownerOnly) {
            // Если показываем только свои посты — сортируем по дате создания
            sortOptions = { createdAt: sortDirection, _id: -1 }
        } else {
            // Общая лента:
            // опубликованные — по дате публикации,свои — по дате создания
            sortOptions = { publishedAt: sortDirection, createdAt: sortDirection, _id: -1 }
        }
    }

    // Выполняем запросы параллельно
    const [items, total] = await Promise.all([
        Post.find(finalFilter)
            .sort(sortOptions)
            .limit(limit)
            .skip(page * limit)
            .populate('categories', 'name')
            .lean(),
        Post.countDocuments(finalFilter),
    ])

    return { items, total }
}

export async function getPostById(id) {
    return Post.findById(id).populate('categories', 'name').lean()
}

export async function createPost({ data, userId }) {
    const { title, summary, details, author, status, categories = [], tags = [] } = data
    if (!isValidObjectIdArray(categories)) {
        const err = new Error('categories must be an array of valid ObjectId')
        err.status = 400
        throw err
    }
    await assertCategoriesExist(categories)
    return new Post({
        title,
        summary,
        details,
        author,
        status,
        userId,
        categories,
        tags: normalizeTags(tags),
    })
}

export async function updatePostEntity(post, data) {
    const { title, summary, details, status, categories, tags } = data
    if (title !== undefined) post.title = title
    if (summary !== undefined) post.summary = summary
    if (details !== undefined) post.details = details
    if (status !== undefined) post.status = status
    if (categories !== undefined) {
        if (!isValidObjectIdArray(categories)) {
            const err = new Error('categories must be an array of valid ObjectId')
            err.status = 400
            throw err
        }
        await assertCategoriesExist(categories)
        post.categories = categories
    }
    if (tags !== undefined) {
        post.tags = normalizeTags(tags)
    }
    return post
}

export async function deletePostById(id) {
    return Post.deleteOne({ _id: id })
}
