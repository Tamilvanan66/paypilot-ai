import { Router } from "express";
import Product from "../models/Product.js";
const router = Router();

router.post("/chat", async (req, res) => {
  try {
    const message = String(req.body.message || "").trim().slice(0, 1500);
    if (!message) return res.status(400).json({ error: "Message is required" });
    const products = await Product.find({ active: true }).limit(30).lean();

    // Demo fallback keeps the app usable without an AI key.
    if (!process.env.AI_API_KEY) {
      const matches = products.filter(p =>
        `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(message.toLowerCase())
      ).slice(0, 4);
      return res.json({
        reply: matches.length
          ? `Here are a few catalogue matches: ${matches.map(p => `${p.name} ($${p.price.toFixed(2)})`).join(", ")}.`
          : "I can help with product questions. Try mentioning a product name or category. This is the demo assistant; configure an AI API key for conversational answers.",
        mode: "demo"
      });
    }

    const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: `You are PayPilot AI, a helpful store assistant. Answer only from this product catalogue when discussing stock or prices. Never claim a payment was made, never request card details, and direct payment actions to the secure checkout. Catalogue: ${JSON.stringify(products.map(p => ({ name:p.name, description:p.description, category:p.category, price:p.price, stock:p.stock })))}` },
          { role: "user", content: message }
        ]
      })
    });
    if (!response.ok) return res.status(502).json({ error: "AI provider request failed" });
    const data = await response.json();
    res.json({ reply: data.choices?.[0]?.message?.content || "I couldn't create a response.", mode: "ai" });
  } catch { res.status(500).json({ error: "Assistant is temporarily unavailable" }); }
});
export default router;
