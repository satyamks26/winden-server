const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    company: { type: String, required: true },
    email: { type: String },
    value: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST"],
        default: "NEW"
    },
    createdBy: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Lead", leadSchema);
