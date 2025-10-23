import multer from 'multer'

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new Error('Only image files are allowed'))
    }
}

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 10,
    },
    fileFilter,
})

export default upload