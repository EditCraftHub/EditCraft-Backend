import { UserModel } from "../Models/User.Model.js";


export const banUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { duration, reason } = req.body;

    // 🔍 Find user
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }

    // ❌ Prevent banning super_admin
    if (user.role === "super_admin") {
      return res.status(403).json({ message: "You cannot ban a Super Admin Fuck Off :- You complain has been registered To Super Admin Block Your Job is in denger" });
    }

    // ✅ Handle ban duration
    let banUntil = null;
    if (duration) {
      const now = new Date();

      if (duration.endsWith("h")) {
        banUntil = new Date(now.getTime() + parseInt(duration) * 60 * 60 * 1000);
      } else if (duration.endsWith("d")) {
        banUntil = new Date(now.getTime() + parseInt(duration) * 24 * 60 * 60 * 1000);
      } else if (duration.endsWith("w")) {
        banUntil = new Date(now.getTime() + parseInt(duration) * 7 * 24 * 60 * 60 * 1000);
      } else if (duration.endsWith("m")) {
        banUntil = new Date(now.getTime() + parseInt(duration) * 30 * 24 * 60 * 60 * 1000);
      } else if (duration.endsWith("y")) {
        banUntil = new Date(now.getTime() + parseInt(duration) * 365 * 24 * 60 * 60 * 1000);
      }
    }

    // ✅ Update user ban fields
    user.isBanned = true;
    user.banExpires = banUntil;
    user.banReason = reason || "Violation of rules";

    await user.save();

    res.status(200).json({
      success: true,
      message: `User banned successfully ${duration ? "until " + banUntil : "permanently"}`,
      user,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error banning user", error: error.message });
  }
};

// Unban a user (By Admin)

export const unbanUser = async (req,res) => {
    try {
        const {id} = req.params;

        const user = await UserModel.findById(id);
        if (!user) {
            return res.status(404).json({message:"User Not Found"})
        }

        // ❌ Prevent banning super_admin
    if (user.role === "super_admin") {
      return res.status(403).json({ message: "You cannot Unban a Super Admin because they can not be banned" });
    }

        user.isBanned = false;
        user.banExpires = null;
        user.banReason  = "";

        await user.save();

        res.status(200).json({
            success:true,
            message:"User unban Successfully",
            user
        })


    } catch (error) {
         res.status(500).json({ message: "Error unbanning user", error: err.message });
    }
}