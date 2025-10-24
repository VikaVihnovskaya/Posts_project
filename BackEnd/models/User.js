import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    login: {
        type: String,
        required: [true, "Login is required"],
        unique: true,
        trim: true,
        minlength: [3, "Login must be at least 3 characters long"],
        maxlength: [30, "Login must be less than 30 characters"],
        match: [/^[a-zA-Z0-9_]+$/, "Login can contain only letters, numbers, and underscores"],
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters long"],
        maxlength: [100, "Password must be less than 100 characters"],
    },
    name: {
        type: String,
        default: ""
    },
    email: {
        type: String,
        default: ""
    },
    about: {
        type: String,
        default: ""
    },
    avatarUrl: {
        type: String,
        default: ""
    },
}, { timestamps: true });


export default mongoose.model("User", userSchema);
