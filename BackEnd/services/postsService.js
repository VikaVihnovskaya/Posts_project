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
export async function listPosts({ userId, limit, page,ownerOnly = false, status }) {
    let filter
    if (ownerOnly) {
        // Только посты владельца, с опциональной фильтрацией по статусу
        filter = { userId }
        if (status === 'draft' || status === 'published') {
            filter.status = status
        }
    } else if (userId) {
        // Для авторизованного: публичные + его собственные
        filter = { $or: [{ status: 'published' }, { userId }] }
    } else {
        // Для неавторизованного: только публичные
        filter = { status: 'published' }
    }

    const [items, total] = await Promise.all([
        Post.find(filter)
            .sort({ publishedAt: -1, id: -1 })
            .limit(limit)
            .skip(page * limit)
            .populate('categories', 'name')
            .lean(),
        Post.countDocuments(filter),
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
        tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
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
        post.tags = Array.isArray(tags) ? tags : [tags].filter(Boolean)
    }
    return post
}

export async function deletePostById(id) {
    return Post.deleteOne({ _id: id })
}