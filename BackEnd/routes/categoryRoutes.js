import express from 'express';
import Category from '../models/Category.js';

const router = express.Router();

// GET /api/categories?search=&limit=&page=
router.get('/', async (req, res, next) => {
    try {
        const { search = '', limit = 50, page = 1 } = req.query;

        const filter = search
            ? { $text: { $search: String(search) } }
            : {};

        const perPage = Math.min(Math.max(Number(limit) || 50, 1), 200);
        const pageNum = Math.max(Number(page) || 1, 1);

        const categories = await Category
            .find(filter)
            .sort({ name: 1 })
            .limit(perPage)
            .skip((pageNum - 1) * perPage);

        res.json(categories);
    } catch (e) {
        next(e);
    }
});

export default router;