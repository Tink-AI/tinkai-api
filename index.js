import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import "dotenv/config";

const app = express();

// Allow your site
app.use(cors({ origin: ["https://ai.tinkfactory.com"], methods: ["GET","POST"] }));
app.use(bodyParser.json({ limit: "1mb" }));

// Optional root route (fixes "Cannot GET /")
app.get("/", (req, res) => res.send("TinkAI API is running 🚀"));

// Health checks (optional but useful)
app.get("/healthz", (req, res) => res.json({ ok: true, path: "/healthz" }));
app.get("/api/health", (req, res) => res.json({ ok: true, path: "/api/health" }));

// 👇 Your chat UI calls this on load for name/logo/theme
app.get("/api/bootstrap", (req, res) => {
  res.json({
    name: "TinkFactory",
    welcome: "Hi 👋 I’m TinkBot. Ask me about PVC boards, plates, banners, or delivery.",
    theme: {
      primary: "#0ea5e9",
      // note: your Bluehost folder is "AI"
      logoUrl: "https://ai.tinkfactory.com/AI/tenant-assets/tinkfactory-logo.png",
    },
  });
});

// Minimal chat reply (works even without OpenAI)
app.post("/api/chat", (req, res) => {
  const userMsg = req.body?.message || "";
  res.json({ reply: `Echo: ${userMsg}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API listening on ${PORT}`));
