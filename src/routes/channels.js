const express = require("express");
const router = express.Router();
const Channel = require("../models/Channels");


const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Contains id and username
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
};

// GET all allowed channels
router.get("/", authenticate, async (req, res) => {
    const channels = await Channel.find().sort({ createdAt: 1 });
    // Filter out private channels if user is not authorized
    const visibleChannels = channels.filter(c => {
        if (!c.isPrivate) return true;
        if (c.createdBy === req.user.username) return true;
        if (c.allowedGuests && c.allowedGuests.includes(req.user.username)) return true;
        return false;
    });
    res.json(visibleChannels);
});


// CREATE channel
router.post("/", async (req, res) => {

    try {

        const { name } = req.body;

        const channel = await Channel.create({
            name,
            createdBy: "system"
        });

        res.json(channel);

    } catch (err) {

        res.status(400).json({
            error: err.message
        });

    }

});


// DELETE channel
router.delete("/:id", async (req, res) => {

    await Channel.findByIdAndDelete(req.params.id);

    res.json({ success: true });

});


module.exports = router;