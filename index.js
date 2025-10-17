import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";
import "dotenv/config";

const app = express();
app.use(cors({ origin: ["https://ai.tinkfactory.com"] }));
app.use(bodyParser.json({ limit: "1mb" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/bootstrap", (req, res) => {
  res.json({
    name: "TinkFactory",
    welcome: "Hi 👋 I’m TinkBot. Ask me about PVC boards, plates, banners, or anything else!",
    theme: {
      primary: "#0ea5e9",
      logoUrl: "https://ai.tinkfactory.com/tenant-assets/tinkfactory-logo.png",
    },
  });
});

app.post("/api/chat", async (req, res) => {
  const userMsg = req.body.message || "";
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are TinkBot for TinkFactory. Be friendly and concise. Prices are in Mauritian Rupees (Rs).",
        },
        { role: "user", content: userMsg },
      ],
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (e) {
    console.error(e);
    res.status(500).json({ reply: "Sorry, there was an error with the AI." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API running on port ${PORT}`));
