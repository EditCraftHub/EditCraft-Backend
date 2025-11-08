import { ContactModel } from "../../Models/Contact.model.js";

export const contactus = async (req, res) => {
    try {

        const {name,email,phone,reasionforcontact} = req.body;
        if (!name || !email || !phone || !reasionforcontact) {
            res.status(400).json({ message: "All fields are required" });
        }

        const newContact = await ContactModel.create({name,email,phone,reasionforcontact});
        res.status(200).json(newContact);
       
    } catch (error) {
        res.status(500).json(error,'Error in contact us');
    }
}


export const contactList = async (req, res) => {
    try {
        const contactList = await ContactModel.find();
        res.status(200).json(contactList);
    } catch (error) {
        res.status(500).json(error,'Error in getting contact list');
    }
}