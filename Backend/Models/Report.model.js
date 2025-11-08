import mongoose from "mongoose";
const repostSchema = new mongoose.Schema({

    name:{
        ref:"user",
        type:mongoose.Schema.Types.ObjectId,
        required:true
    },
    email:{
        ref:"user",
        type:mongoose.Schema.Types.ObjectId,
        required:true
    },
    reasionforreport:{
        type:String,
        required:true
    }
    
},{timestamps:true});
export const ReportModel = mongoose.model("report", repostSchema);