const mongoose = require("mongoose");

const connectDB = async () => {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/winden";
    try {
        await mongoose.connect(uri);
        console.log("🟢 MongoDB connected");
    } catch (err) {
        console.error("🔴 MongoDB error:", err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
