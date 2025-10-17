import mongoose, {Schema} from "mongoose";

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Title is required"],
        trim: true,
        minlength: [3, "Title must be at least 3 characters"],
        maxlength: [200, "Title must be at most 200 characters"],
        index: true,
    },
    summary: {
        type: String,
        trim: true,
        maxlength: [500, "Summary must be at most 500 characters"],
        default: "",
    },
    details: {
        type: String,
        required: [true, "Details are required"],
        minlength: [10, "Details must be at least 10 characters"],
    },
    author: {
        type: String,
        trim: true,
        default: "",
    },
    status: {
        type: String,
        enum: ["draft", "published", "archived"],
        default: "draft",
        index: true,
    },
    publishedAt: {
        type: Date,
        default: null,
        index: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User is required"],
        index: true,
    },
    categories: [{
        type: Schema.Types.ObjectId,
        ref: "Category",
        index: true,
    }],
    comments: [{
        type: Schema.Types.ObjectId,
        ref: "Comment",
        index: true,
    }],
    tags: {
        type: [String],
        required: [true, "At least one tag is required"],
        validate: [
            { validator: v => Array.isArray(v) && v.length > 0, message: "At least one tag is required" },
            { validator: v => {
                    const re = /^[a-z0-9а-яё_\-]+$/i;
                    return v.every(tag => typeof tag === 'string' && tag.trim().length >= 2 && tag.trim().length <= 30 && re.test(tag.trim()));
                },
                message: "Each tag must be 2–30 chars and contain only letters, numbers, underscores, or dashes",
            },
        ],
        set: v => Array.isArray(v)
            ? Array.from(new Set(v.filter(Boolean).map(s => String(s).trim().toLowerCase()).filter(s => s.length > 0)))
            : v,
        index: true,
    },
    imageUrls: {
        type: [String],
        default: [],
    },
}, {timestamps: true});

export default mongoose.model("Post", postSchema)