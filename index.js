import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import "dotenv/config";

const app = express();

// Allow your site to call the API
app.use(cors({ origin: ["https://ai.tinkfactory.com"], methods: ["GET","POST"] }));
app.use(bodyParser.json({ limit: "1mb" }));

// Render's default health check (keep it)
app.get("/healthz", (req, res) => res.json({ ok: true, path: "/healthz" }));

// Optional alias for your own tests
app.get("/api/health", (req, res) => res.json({ ok: true, path: "/api/health" }));

// 👇 This is what your chat page calls on load
app.get("/api/bootstrap", (req, res) => {
  res.json({
    name: "TinkFactory",
    welcome: "Hi 👋 I’m TinkBot. Ask me about PVC boards, plates, banners, or delivery.",
    theme: {
      primary: "#0ea5e9",
      // IMPORTANT: matches your Bluehost folder name "AI"
      logoUrl: "https://ai.tinkfactory.com/AI/tenant-assets/tinkfactory-logo.png",
    },
  });
});

// Minimal chat echo (works even without OpenAI so we can test)
app.post("/api/chat", (req, res) => {
  const userMsg = req.body?.message || "";
  res.json({ reply: `Echo: ${userMsg}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API listening on ${PORT}`));
