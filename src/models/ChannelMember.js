const mongoose = require("mongoose");

const channelMemberSchema = new mongoose.Schema({

    channelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Channel",
        required: true
    },

    userId: {
        type: String,
        required: true
    },

    username: {
        type: String,
        required: true
    },

    joinedAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model(
    "ChannelMember",
    channelMemberSchema
);