import mongoose from 'mongoose'
const { Types } = mongoose

export function validateCategoriesBody(req, res, next) {
    const { categories } = req.body || {}
    if (categories === undefined) return next()
    if (!Array.isArray(categories) || !categories.every(id => Types.ObjectId.isValid(id))) {
        return res.status(400).json({ message: 'categories must be an array of valid ObjectId' })
    }
    next()
}