import mongoose from "mongoose";

const newSattelarSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
}, { timestamps: true });
export const NewSattelarModel = mongoose.model("newSattelar", newSattelarSchema);