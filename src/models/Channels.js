const mongoose = require("mongoose");

const channelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    createdBy: {
        type: String,
        required: true
    },
    isPrivate: {
        type: Boolean,
        default: false
    },
    allowedGuests: [{
        type: String
    }]
}, { timestamps: true });

module.exports = mongoose.model("Channel", channelSchema);