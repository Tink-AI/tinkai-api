// index.js — TinkAI API (single-CSV Google Sheet loader + GPT chat)

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import "dotenv/config";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

// --------------------------- App setup ---------------------------
const app = express();
app.use(
  cors({
    origin: ["https://ai.tinkfactory.com"], // allow your site
    methods: ["GET", "POST"],
  })
);
app.use(bodyParser.json({ limit: "1mb" }));

// ------------------------ Health / root --------------------------
app.get("/", (_req, res) => res.send("TinkAI API is running 🚀"));
app.get("/healthz", (_req, res) => res.json({ ok: true, path: "/healthz" }));
app.get("/api/health", (_req, res) => res.json({ ok: true, path: "/api/health" }));

// --------------------- Knowledge base (CSV) ----------------------
let KB = { keyValue: [], products: [], faq: [] };
const SHEET_URL = process.env.SHEET_ALL_CSV || ""; // published CSV URL

function norm(s) { return String(s ?? "").trim(); }
function has(v) { return v !== undefined && v !== null && String(v).trim() !== ""; }

function autoBucketRow(row) {
  const section = norm(row.section || row.Section);
  if (section) return section; // KeyValue | Products | FAQ

  // Fallback to column heuristics:
  if (has(row.key) && has(row.value)) return "KeyValue";
  if (has(row.product) || has(row.Product)) return "Products";
  if ((has(row.question) || has(row.Question)) && (has(row.answer) || has(row.Answer))) return "FAQ";
  return "";
}

async function loadFromSingleCsv() {
  if (!SHEET_URL) {
    console.warn("⚠️ SHEET_ALL_CSV env var not set");
    return;
  }
  const r = await fetch(SHEET_URL);
  const text = await r.text();

  const rows = parse(text, { columns: true, skip_empty_lines: true });

  const keyValue = [];
  const products = [];
  const faq = [];

  for (const raw of rows) {
    // normalize keys to lowercase
    const row = {};
    for (const k in raw) row[k.trim().toLowerCase()] = norm(raw[k]);

    const bucket = autoBucketRow(row);

    if (bucket === "KeyValue") {
      if (row.key && row.value) keyValue.push({ key: row.key, value: row.value });
    } else if (bucket === "Products") {
      if (row.product) {
        products.push({
          product: row.product,
          unit: row.unit || "",
          price: row.price || "",
          notes: row.notes || "",
        });
      }
    } else if (bucket === "FAQ") {
      if (row.question && row.answer) faq.push({ question: row.question, answer: row.answer });
    }
  }

  KB = { keyValue, products, faq };
  console.log("✅ CSV loaded:", {
    keyValue: keyValue.length,
    products: products.length,
    faq: faq.length,
  });
}
await loadFromSingleCsv();
setInterval(() => loadFromSingleCsv().catch(console.error), 5 * 60 * 1000); // every 5 min

// Manual reload without redeploy
app.post("/api/reload", async (_req, res) => {
  try { await loadFromSingleCsv(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Debug KB (optional)
app.get("/api/debug-kb", (_req, res) => res.json(KB));

// Build GPT context
function buildContext() {
  const lines = [];

  if (KB.keyValue.length) {
    lines.push("Business Facts:");
    KB.keyValue.forEach(r => lines.push(`- ${r.key}: ${r.value}`));
    lines.push("");
  }

  if (KB.products.length) {
    lines.push("Products & Pricing (MUR):");
    KB.products.forEach(p => {
      const price = p.price ? `Rs ${p.price}` : "";
      lines.push(`- ${p.product} — ${price}${p.unit ? " / " + p.unit : ""}${p.notes ? " (" + p.notes + ")" : ""}`);
    });
    lines.push("");
  }

  if (KB.faq.length) {
    lines.push("FAQs:");
    KB.faq.forEach(f => lines.push(`Q: ${f.question}\nA: ${f.answer}`));
  }

  return lines.join("\n");
}

// -------------------------- Bootstrap ---------------------------
app.get("/api/bootstrap", (_req, res) => {
  res.json({
    name: "TinkFactory",
    welcome:
      "Hey, I’m Tink AI Assistant 👋\nI can help with prices, quick quotes, stock, delivery, and appointments. What do you need today?",
    theme: {
      primary: "#0ea5e9",
      // Note: Bluehost folder is "AI" (case-sensitive)
      logoUrl: "https://ai.tinkfactory.com/AI/tenant-assets/tinkfactory-logo.png",
    },
    suggestions: [
      "Price list for PVC boards",
      "Quote for 2 × A2 PVC boards",
      "Do you deliver to Ebene?",
      "Production time?",
    ],
  });
});

// --------------------------- Chat --------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getSuggestions(userMsg = "") {
  if (/price|cost|how much/i.test(userMsg)) {
    return ["See full price list", "Ask for a bulk discount", "Get a formal quote PDF"];
  }
  if (/deliver|pickup|ship/i.test(userMsg)) {
    return ["Delivery fees & timing", "Pickup location & hours", "Track an order"];
  }
  if (/plate|pvc|banner|sticker/i.test(userMsg)) {
    return ["Materials & finishes", "Production time", "Care instructions"];
  }
  return ["Show popular items", "Ask for today’s lead time", "Talk to a human 👤"];
}

app.post("/api/chat", async (req, res) => {
  const userMsg = (req.body?.message || "").slice(0, 1000);
  const context = buildContext();

  // If no OpenAI key, return a graceful echo (keeps demo working)
  if (!process.env.OPENAI_API_KEY) {
    return res.json({ reply: `Echo: ${userMsg}`, suggestions: getSuggestions(userMsg) });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are Tink AI Assistant for TinkFactory. Use ONLY the provided business context for facts. " +
            "Always show prices in Mauritian Rupees (Rs). If info is missing, ask a concise clarifying question and offer to collect details.",
        },
        { role: "user", content: `Business context:\n${context}` },
        { role: "user", content: `Customer: ${userMsg}` },
      ],
    });

    const reply = completion.choices?.[0]?.message?.content || "Sorry, I had trouble answering.";
    res.json({ reply, suggestions: getSuggestions(userMsg) });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      reply: "Sorry, there was an error with the AI.",
      suggestions: ["Try again", "Talk to a human 👤"],
    });
  }
});

// -------------------------- Start --------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API listening on ${PORT}`));
