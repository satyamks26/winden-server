socket.on("channel:joinMember", async ({ channelId }) => {

    const exists = await ChannelMember.findOne({
        channelId,
        userId: socket.user.id
    });

    if (!exists) {

        await ChannelMember.create({
            channelId,
            userId: socket.user.id,
            username: socket.user.username
        });

    }

});