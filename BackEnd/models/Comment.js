import mongoose from "mongoose";

const { Schema } = mongoose;

const commentSchema = new Schema({
    postId: {
        type: Schema.Types.ObjectId,
        ref: "Post",
        required: [true, "postId is required"],
        index: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "userId is required"],
        index: true,
    },
    content: {
        type: String,
        required: [true, "content is required"],
        trim: true,
        minlength: [1, "Comment is too short"],
        maxlength: [5000, "Comment is too long"],
    },

}, { timestamps: true });


commentSchema.index({ postId: 1, createdAt: 1 });
// commentSchema.index({ userId: 1, createdAt: -1 });


export default mongoose.model("Comment", commentSchema);