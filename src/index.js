require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./db");
const authRoutes = require("./routes/auth.js");
const channelRoutes = require("./routes/channels.js");
const leadRoutes = require("./routes/leads.js");
const Channel = require("./models/Channels.js");
const jwt = require("jsonwebtoken");
const seedChannels = require("./seedChannel");
const ChannelMember = require("./models/ChannelMember.js");
const mongoose = require("mongoose");
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/leads", leadRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  },
});

const onlineUsers = {};
io.use((socket, next) => {

  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.user = {
      id: decoded.id,
      username: decoded.username
    };

    next();

  } catch (err) {
    next(new Error("Invalid token"));
  }

});

io.on("connection", (socket) => {

  socket.on("channel:create", async ({ name, isPrivate }) => {
    try {
      // 1. Create channel securely capturing privacy flags
      const channel = await Channel.create({
        name,
        createdBy: socket.user.username,
        isPrivate: !!isPrivate
      });

      // 2. Auto-join creator
      await ChannelMember.create({
        channelId: channel._id,
        userId: socket.user.id,
        username: socket.user.username
      });

      // 3. Broadcast
      io.emit("channel:new", channel);

    } catch (err) {
      socket.emit("error", err.message);
    }

  });
  /* ---------- JOIN CHANNEL ---------- */
  socket.on("channel:join", ({ channelId }) => {

    socket.join(channelId);

    if (!onlineUsers[channelId])
      onlineUsers[channelId] = new Map();

    onlineUsers[channelId].set(socket.id, socket.user.username);

    io.to(channelId).emit("presence:update", {
      channelId,
      users: Array.from(
        onlineUsers[channelId].values()
      ),
    });
  });

  /* ---------- leave channel ---------- */
  socket.on("channel:leaveMember", async ({ channelId }) => {

    await ChannelMember.deleteOne({
      channelId,
      userId: socket.user.id
    });

    socket.emit("channel:left", { channelId });

  });

  /*--delete -- channel */
  socket.on("channel:delete", async ({ channelId }) => {

    const channel = await Channel.findById(channelId);

    if (!channel) return;

    // permission check
    if (channel.createdBy !== socket.user.username) {
      return socket.emit("error", "Not allowed");
    }

    await Channel.deleteOne({ _id: channelId });

    await ChannelMember.deleteMany({ channelId });

    io.emit("channel:deleted", { channelId });

  });

  /* ---------- IDENTIFY ---------- */

  const Message = require("./models/Messages");

  /* ---------- DELETE MESSAGE ---------- */
  socket.on("message:delete", async ({ messageId, channelId }) => {
    try {
      const Message = require("./models/Messages");
      const message = await Message.findById(messageId);

      if (!message) return;

      // Security check: Only execute deletion if the user physically owns the database record
      if (message.user === socket.user.username) {
        await Message.findByIdAndDelete(messageId);

        // Instantly notify ALL connected channel sockets to obliterate the rendered UI node!
        io.to(channelId).emit("message:deleted", { messageId, channelId });
      } else {
        socket.emit("error", "You do not have administrative permission to delete this record.");
      }
    } catch (err) {
      console.error("Message Delete Interception Error:", err);
    }
  });

  /* ---------- SEND MESSAGE---------- */
  socket.on("message:send", async ({ channelId, text }) => {

    // --- CRM Slash Command Parsing: /lead ---
    if (text.trim().toLowerCase().startsWith("/lead ")) {
      const commandStr = text.trim().substring(6).trim(); // e.g. "add Acme - $5000"

      try {
        if (commandStr.toLowerCase().startsWith("add ")) {
          const leadData = commandStr.split("-");
          const leadNameStr = leadData[0].substring(4).trim(); // Cleanly removes "add "
          const leadName = leadNameStr || "Unknown Lead";
          const leadValueText = leadData[1] ? leadData[1].trim() : "0";
          const leadValue = parseInt(leadValueText.replace(/[^0-9]/g, "")) || 0;

          const Lead = require("./models/Lead");
          await Lead.create({
            name: leadName,
            company: "Quick Add (Chat)",
            value: leadValue,
            status: "NEW",
            createdBy: socket.user.username
          });

          // Return a visually-distict encrypted confirmation directly to the singular user
          socket.emit("message:new", {
            _id: Date.now().toString(),
            channelId,
            user: "Winden System",
            text: `✅ System verified: Automatically extracted "**${leadName}**" at **$${leadValue.toLocaleString()}** and securely injected it directly into your Sales Pipeline API!`,
            createdAt: new Date(),
          });
        }
      } catch (err) {
        console.error("Slash Command Automation Error:", err);
      }
      return; // Crucial: Stop WebSockets from broadcasting internal commands globally!
    }

    // --- Standard Message Broadcasting ---
    const message = await Message.create({
      channelId,
      user: socket.user.username,
      text,
    });

    io.to(channelId).emit("message:new", {
      _id: message._id,
      channelId,
      user: socket.user.username,
      text,
      createdAt: message.createdAt,
    });

    // --- Winden AI Bot Interception ---
    if (text.trim().toLowerCase().startsWith("@ai ")) {
      const userPrompt = text.trim().substring(4).trim();

      // Emit a "typing" indicator from the bot
      io.to(channelId).emit("typing:update", {
        user: "Winden AI",
        channelId,
        isTyping: true,
      });

      try {
        let botReply = "";
        const API_KEY = process.env.OPENAI_API_KEY;

        if (!API_KEY) {
          // Fallback rules engine if no API key is provided yet
          if (userPrompt.toLowerCase() === "stats") {
            const totalChannels = await Channel.countDocuments();
            const totalUsers = await ChannelMember.distinct("userId").then(res => res.length);
            botReply = `📊 **Live CRM Stats:** We currently have **${totalChannels}** active channels and **${totalUsers}** registered team members.\n\n*(Add an OpenAI API key to your server's .env for full conversational AI capabilities!)*`;
          } else if (userPrompt.toLowerCase() === "ping") {
            botReply = "🏓 Pong! The Winden AI engine is online and connected to your WebSockets.";
          } else {
            botReply = `Hi ${socket.user.username}! I am ready to connect to ChatGPT! 🔌\n\nPlease add your \`OPENAI_API_KEY\` to your server's \`.env\` file, and I will be able to answer: "${userPrompt}"`;
          }
          await new Promise(resolve => setTimeout(resolve, 800)); // Artificial realism delay
        } else {
          // Real fetch to OpenAI
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [
                { role: "system", content: "You are Winden AI, a genuinely helpful and concise internal assistant natively built into a collaborative CRM workspace. Format your responses clearly, use emojis correctly, and keep it extremely precise." },
                { role: "user", content: userPrompt }
              ]
            })
          });
          const data = await response.json();
          if (data.choices && data.choices.length > 0) {
            botReply = data.choices[0].message.content;
          } else if (data.error) {
            botReply = `⚠️ **OpenAI returned an error:** ${data.error.message}\n\n*(Note: If you just created this key, OpenAI requires you to have at least $5 of prepaid credit on your account at platform.openai.com/billing to use the API!)*`;
          } else {
            botReply = "⚠️ Sorry, I encountered a connection error while reaching OpenAI. Please verify your API Key structure!";
          }
        }

        // Save AI's response to Database
        const aiMessage = await Message.create({
          channelId,
          user: "Winden AI",
          text: botReply,
        });

        // Broadcast AI response
        io.to(channelId).emit("message:new", {
          _id: aiMessage._id,
          channelId,
          user: "Winden AI",
          text: botReply,
          createdAt: aiMessage.createdAt,
        });

      } catch (err) {
        console.error("AI Error:", err);
      } finally {
        // Cease typing
        io.to(channelId).emit("typing:update", {
          user: "Winden AI",
          channelId,
          isTyping: false,
        });
      }
    }
  });

  /* ---------- HISTORY ---------- */
  socket.on("channel:history", async ({ channelId }) => {

    const messages = await Message.find({ channelId })
      .sort({ createdAt: 1 })
      .limit(50);

    const sanitizedMessages = messages.map(m => {
      const msg = m.toObject();
      return {
        ...msg,
        user: typeof msg.user === "object" ? msg.user.username : msg.user
      };
    });

    socket.emit("channel:history", sanitizedMessages);
  });

  /* ---------- TYPING ---------- */
  socket.on("typing:start", ({ channelId }) => {
    socket.to(channelId).emit("typing:update", {
      user: socket.user.username,
      channelId,
      isTyping: true,
    });
  });

  socket.on("typing:stop", ({ channelId }) => {
    socket.to(channelId).emit("typing:update", {
      user: socket.user.username,
      channelId,
      isTyping: false,
    });
  });

  /* ---------- DISCONNECT ---------- */
  socket.on("disconnect", () => {

    Object.keys(onlineUsers).forEach(channelId => {

      onlineUsers[channelId]?.delete(socket.id);

      io.to(channelId).emit("presence:update", {
        channelId,
        users: Array.from(
          onlineUsers[channelId]?.values() || []
        ),
      });
    });

  });
  socket.on("channel:joinMember", async ({ channelId }) => {

    let actualChannelId = channelId;
    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      const channel = await Channel.findOne({ name: channelId });
      if (channel) {
        actualChannelId = channel._id;
      } else {
        return;
      }
    }

    const exists = await ChannelMember.findOne({
      channelId: actualChannelId,
      userId: socket.user.id
    });

    if (!exists) {

      await ChannelMember.create({
        channelId: actualChannelId,
        userId: socket.user.id,
        username: socket.user.username
      });

    }

  });

});

const PORT = process.env.PORT || 5001;
connectDB().then(() => seedChannels()).catch(err => console.error(err));

server.listen(PORT);