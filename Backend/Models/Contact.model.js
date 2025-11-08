import mongoose from "mongoose";
const contactSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: Number,
        required: true
    },
    reasionforcontact: {
        type: String,
        required: true
    },
    
},{timestamps:true});
export const ContactModel = mongoose.model("contact", contactSchema);