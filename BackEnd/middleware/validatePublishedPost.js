import mongoose from 'mongoose'
import Post from '../models/Post.js'

export const validatePublishedPost = (paramName = 'id') => {
    return async (req, res, next) => {
        const postId = req.params[paramName]

        if (!mongoose.isValidObjectId(postId)) {
            return res.status(400).json({ message: `Invalid ${paramName}` })
        }

        const post = await Post.findById(postId).select('status userId')
        if (!post) return res.status(404).json({ message: 'Post not found' })

        if (post.status !== 'published') {
            return res.status(403).json({ message: 'Post is not public' })
        }

        req.post = post
        next()
    }
}