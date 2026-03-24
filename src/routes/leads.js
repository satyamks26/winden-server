const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");
const jwt = require("jsonwebtoken");

// Secure API Middleware
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
};

// GET all active leads
router.get("/", authenticate, async (req, res) => {
    try {
        const leads = await Lead.find().sort({ createdAt: -1 });
        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST inject a new lead into the funnel
router.post("/", authenticate, async (req, res) => {
    try {
        const { name, company, email, value, status } = req.body;
        const lead = await Lead.create({
            name,
            company,
            email,
            value: Number(value) || 0,
            status: status || "NEW",
            createdBy: req.user.username
        });
        res.status(201).json(lead);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT explicitly handler for KanBan drag-and-drop mechanics
router.put("/:id/status", authenticate, async (req, res) => {
    try {
        const { status } = req.body;
        const lead = await Lead.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        res.json(lead);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE remove a lead permanently 
router.delete("/:id", authenticate, async (req, res) => {
    try {
        await Lead.findByIdAndDelete(req.params.id);
        res.json({ message: "Lead successfully purged" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
