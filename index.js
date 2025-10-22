import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import "dotenv/config";
import { parse } from "csv-parse/sync"; // <— safe CSV parser
// import OpenAI from "openai";          // uncomment when you switch from echo to real AI

const app = express();
app.use(cors({ origin: ["https://ai.tinkfactory.com"], methods: ["GET","POST"] }));
app.use(bodyParser.json({ limit: "1mb" }));

// ---- 1) Load ONE CSV (Google "publish to web") and split into sections
let KB = { keyValue: [], products: [], faq: [] };

function norm(s) { return String(s || "").trim(); }

function autoBucketRow(row) {
  // If you add a "section" column in your sheet (KeyValue/Products/FAQ), this wins.
  const section = norm(row.section || row.Section);
  if (section) return section;

  // Otherwise auto-detect by which columns exist:
  if (row.key !== undefined && row.value !== undefined) return "KeyValue";
  if (row.product !== undefined || row.Product !== undefined) return "Products";
  if ((row.question !== undefined || row.Question !== undefined) &&
      (row.answer !== undefined   || row.Answer   !== undefined)) return "FAQ";
  return ""; // unknown row — ignored
}

async function loadFromSingleCsv() {
  const url = process.env.SHEET_ALL_CSV;
  if (!url) { console.warn("⚠️ SHEET_ALL_CSV env var not set"); return; }

  const r = await fetch(url);
  const text = await r.text();

  // Parse with csv-parse, first line treated as headers
  const rows = parse(text, { columns: true, skip_empty_lines: true });

  const keyValue = [];
  const products = [];
  const faq = [];

  for (const raw of rows) {
    // Normalize typical headers (case-insensitive)
    const row = {};
    for (const k in raw) row[k.trim().toLowerCase()] = norm(raw[k]);

    const bucket = autoBucketRow(row);

    if (bucket === "KeyValue") {
      if (row.key && row.value) keyValue.push({ key: row.key, value: row.value });
    } else if (bucket === "Products") {
      if (row.product) products.push({
        product: row.product,
        unit: row.unit || "",
        price: row.price || "",
        notes: row.notes || ""
      });
    } else if (bucket === "FAQ") {
      if (row.question && row.answer) faq.push({ question: row.question, answer: row.answer });
    } else {
      // ignore unknown rows
    }
  }

  KB = { keyValue, products, faq };
  console.log("✅ CSV loaded:", {
    keyValue: keyValue.length, products: products.length, faq: faq.length
  });
}

// load once at boot + refresh every 5 min
await loadFromSingleCsv();
setInterval(() => loadFromSingleCsv().catch(console.error), 5 * 60 * 1000);

// manual reload endpoint (no redeploy needed)
app.post("/api/reload", async (req, res) => {
  try { await loadFromSingleCsv(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// handy debug
app.get("/api/debug-kb", (req, res) => res.json(KB));

// Build GPT context from KB
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
      lines.push(`- ${p.product} — ${price}${p.unit ? " / " + p.unit : ""}${p.notes ? " ("+p.notes+")" : ""}`);
    });
    lines.push("");
  }
  if (KB.faq.length) {
    lines.push("FAQs:");
    KB.faq.forEach(f => lines.push(`Q: ${f.question}\nA: ${f.answer}`));
  }
  return lines.join("\n");
}
