import Post from '../models/Post.js'

export const checkPostOwner = async (req, res, next) => {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Post not found' })

    if (String(post.userId) !== String(req.user.sub)) {
        return res.status(403).json({ message: 'Forbidden' })
    }

    req.post = post
    next()
}