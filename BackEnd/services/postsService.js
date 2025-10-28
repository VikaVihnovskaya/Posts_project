import Post from '../models/Post.js'
import Category from '../models/Category.js'

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
        Post.find(filter).sort({ publishedAt: -1, id: -1 }).limit(limit).skip(page * limit).lean(),
        Post.countDocuments(filter),
    ])
    return { items, total }
}

export async function getPostById(id) {
    return Post.findById(id).populate('categories', 'name').lean()
}

export async function createPost({ data, userId }) {
    const { title, summary, details, author, status, categories, tags } = data
    const obtainedCategories = await Category.find({ name: { $in: categories } })
    return new Post({
        title, summary, details, author, status,
        categories: obtainedCategories,
        tags: Array.isArray(tags) ? tags : tags,
        userId,
    })
}

export async function updatePostEntity(post, data) {
    const { title, summary, details, status, categories, tags } = data
    if (title !== undefined) post.title = title
    if (summary !== undefined) post.summary = summary
    if (details !== undefined) post.details = details
    if (status !== undefined) post.status = status
    if (categories !== undefined) {
        post.categories = await Category.find({ name: { $in: categories } })
    }
    if (tags !== undefined) {
        post.tags = Array.isArray(tags) ? tags : [tags]
    }
    return post
}

export async function deletePostById(id) {
    return Post.deleteOne({ _id: id })
}