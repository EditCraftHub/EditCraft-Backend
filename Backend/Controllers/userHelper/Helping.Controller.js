import { ReportModel } from "../../Models/Report.model.js";


// PROTECTED-ROUTE
export const madeRepost = async (req,res) => {
    try {

        const {reasionforreport} = req.body
        if (!reasionforreport) {
            res.status(400).json({ message: "You have to write something for to Report" });
        }

        const newReport = await ReportModel.create({reasionforreport});
        res.status(200).json(newReport);
         
    } catch (error) {
        res.status(500).json(error,'Error in making report');
    }
}

// PROTECTED-ROUTE

export const getReportList = async (req, res) => {
    try {
        const reportList = await ReportModel.find();
        res.status(200).json(reportList);
    } catch (error) {
        res.status(500).json(error,'Error in getting report list');
    }
}