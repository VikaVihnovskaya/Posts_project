export const errorHandler = (err, req, res, next) => {
    console.error(err)

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            message: 'Validation error',
            errors: err.errors,
        })
    }

    if (err.status && err.message) {
        return res.status(err.status).json({ message: err.message })
    }

    res.status(500).json({ message: 'Internal server error' })
}