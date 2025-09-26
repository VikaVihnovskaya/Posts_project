import mongoose from "mongoose";

const { Schema } = mongoose;

const categorySchema = new Schema({
    name: {
        type: String,
        required: [true, "Category name is required"],
        trim: true,
        minlength: [2, "Name must be at least 2 characters"],
        maxlength: [60, "Name must be at most 60 characters"],
    },

    description: {
        type: String,
        trim: true,
        maxlength: [500, "Description must be at most 500 characters"],
        default: "",
    },
}, { timestamps: true });

// Текстовый индекс для простого поиска (опционально)
categorySchema.index({ name: 'text', description: 'text' }, { name: 'Category_text_search' });

export default mongoose.model("Category", categorySchema);