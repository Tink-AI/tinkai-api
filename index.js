import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import "dotenv/config";

const app = express();

// Allow your site
app.use(cors({ origin: ["https://ai.tinkfactory.com"], methods: ["GET","POST"] }));
app.use(bodyParser.json({ limit: "1mb" }));

// KEEP your existing /healthz for Render
app.get("/healthz", (req, res) => res.json({ ok: true, path: "/healthz" }));

// OPTIONAL alias so your own tests work too
app.get("/api/health", (req, res) => res.json({ ok: true, path: "/api/health" }));

// Used by your chat page header/theme
app.get("/api/bootstrap", (req, res) => {
  res.json({
    name: "TinkFactory",
    welcome: "Hi 👋 I’m TinkBot. Ask me about PVC boards, plates, banners, or delivery.",
    theme: {
      primary: "#0ea5e9",
      // note: path matches your Bluehost folder name "AI"
      logoUrl: "https://ai.tinkfactory.com/AI/tenant-assets/tinkfactory-logo.png",
    },
  });
});

// Minimal chat (works even without OpenAI to test)
app.post("/api/chat", (req, res) => {
  const userMsg = req.body?.message || "";
  res.json({ reply: `Echo: ${userMsg}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API listening on ${PORT}`));
