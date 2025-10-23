import Comment from '../models/Comment.js'

export async function listComments({ postId }) {
    const raw = await Comment.find({ postId }).sort({ createdAt: 1 }).populate('userId', 'login').lean()
    return raw.map(c => ({ ...c, author: c.userId?.login || 'Unknown' }))
}

export async function createComment({ postId, userId, content }) {
    return Comment.create({ postId, userId, content })
}

export async function findOwnComment({ postId, commentId, userId }) {
    return Comment.findOne({ _id: commentId, postId, userId })
}