import { NewSattelarModel } from "../../Models/Helper/NewSattelar.model.js";

export const newSattelar = async (req, res) => {
    try {
        const { email } = req.body;
        const existingSattelar = await NewSattelarModel.findOne({ email });
        if (existingSattelar) {
            return res.status(200).json('You are already a sattelar');
        }
        const newSattelar = await NewSattelarModel.create({ email });
        res.status(200).json(newSattelar);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllSattelars = async (req, res) => {
    try {
        const sattelars = await NewSattelarModel.find();
        res.status(200).json(sattelars);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};