import { listComments, createComment, findOwnComment } from '../services/commentsService.js'

export async function getCommentsCtrl(req, res) {
    const items = await listComments({ postId: req.params.id })
    res.json({ items })
}

export async function createCommentCtrl(req, res) {
    const created = await createComment({ postId: req.params.id, userId: req.user.sub, content: req.body.content })
    const c = await (await import('../models/Comment.js')).default.findById(created._id).populate('userId', 'login').lean()
    res.status(201).json({ ...c, author: c.userId?.login || 'Unknown' })
}

export async function updateCommentCtrl(req, res) {
    const { postId, commentId } = req.params
    const comment = await findOwnComment({ postId, commentId, userId: req.user.sub })
    if (!comment) return res.status(404).json({ message: 'Comment not found' })
    comment.content = req.body.content
    await comment.save()
    const c = await (await import('../models/Comment.js')).default.findById(comment._id).populate('userId', 'login').lean()
    res.json({ ...c, author: c.userId?.login || 'Unknown' })
}

export async function deleteCommentCtrl(req, res) {
    const { postId, commentId } = req.params
    const result = await (await import('../models/Comment.js')).default.deleteOne({ _id: commentId, postId, userId: req.user.sub })
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Comment not found' })
    res.status(204).send()
}