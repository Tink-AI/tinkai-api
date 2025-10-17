import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import "dotenv/config";

const app = express();

// TEMP: allow your site while testing. Tighten later if needed.
app.use(cors({ origin: ["https://ai.tinkfactory.com"], methods: ["GET","POST"] }));
app.use(bodyParser.json({ limit: "1mb" }));

// Root ping (helps verify service is alive)
app.get("/", (req, res) => res.send("TinkAI API is running 🚀"));

// Health route (the one you’re testing)
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Minimal chat route (works without OpenAI while testing)
app.post("/api/chat", (req, res) => {
  const userMsg = req.body?.message || "";
  res.json({ reply: `Echo: ${userMsg}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API listening on ${PORT}`));
