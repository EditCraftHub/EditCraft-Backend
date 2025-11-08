import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

export const connectDatabase = async () => {
    try {
        if (!process.env.Mongo_Url) {
            throw new Error('Mongo_Url is not defined in environment variables');
        }

        await mongoose.connect(process.env.Mongo_Url);

        console.log("✅ Database connected successfully");
    } catch (error) {
        console.error("❌ Database connection failed:", error.message);
        process.exit(1); // exit only if connection fails
    }
};
