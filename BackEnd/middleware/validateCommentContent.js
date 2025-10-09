export const validateCommentContent = (req, res, next) => {
    const content = (req.body?.content || '').trim()
    if (!content) {
        return res.status(400).json({ message: 'Content is required' })
    }
    req.body.content = content
    next()
}