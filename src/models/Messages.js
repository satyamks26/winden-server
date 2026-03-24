const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        channelId: {
            type: String,
            required: true,
        },
        user: {
            type: String,
            required: true,
        },
        text: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
