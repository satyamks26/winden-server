const mongoose = require("mongoose");

const connectDB = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.warn("⚠️  MONGO_URI not set — skipping MongoDB connection (development mode)");
        return;
    }

    try {
        await mongoose.connect(uri);
        console.log("🟢 MongoDB connected");
    } catch (err) {
        console.error("🔴 MongoDB error:", err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
