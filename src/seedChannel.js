const Channel = require("./models/Channels.js");

async function seedChannels() {

    const existing = await Channel.countDocuments();

    if (existing === 0) {

        await Channel.insertMany([
            {
                name: "general",
                createdBy: "system"
            }
        ]);

        console.log("🌱 Default channel seeded");

    }

}

module.exports = seedChannels;