import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { fal } from "@fal-ai/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const FAL_API_KEY = process.env.FAL_API_KEY || process.env.VITE_FAL_API_KEY;

if (!FAL_API_KEY) {
  console.error("Missing FAL_API_KEY in .env.local");
  process.exit(1);
}

fal.config({
  credentials: FAL_API_KEY,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const DEFAULT_MODEL = "fal-ai/nano-banana-2";
const BASE_PROMPT = `Please process all attached product images using nano-level precision and intelligent context understanding. Maintain the product’s exact identity, shape, proportions, colors, printed graphics, logos, Hebrew/English texts, barcodes, and all micro-details exactly as in the original images. Remove all amateur lighting artifacts, reflections, glare, shadow noise, color casts, and distortions. Correct crushed, bent, or uneven packaging so it appears perfectly shaped, clean, and professionally presented. Reconstruct missing micro-details when needed with molecular-scale accuracy.

Place the product perfectly centered on a pure white (#FFFFFF) seamless studio background with soft, realistic, controlled studio shadows. Ensure the lighting is even and professional with no blown highlights. Align the product to face directly forward in a classic e-commerce studio angle unless the product shape requires slight curvature. Remove background objects, noise, and imperfections while preserving the true geometry and texture.

If multiple images are provided, intelligently merge visual information to produce the most accurate and complete studio-grade final result.`;

app.post("/api/ai/studio", async (req, res) => {
  const { imageUrls, productName, modelId } = req.body || {};

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return res.status(400).json({ error: "לפחות תמונה אחת נדרשת" });
  }

  try {
    const response = await fal.subscribe(modelId || DEFAULT_MODEL, {
      input: {
        prompt: `${BASE_PROMPT}\n\nProduct name: ${productName || "N/A"}`,
        images: imageUrls.map((url, index) => ({
          type: "input_image",
          image_url: url,
          name: `source_${index + 1}`,
        })),
      },
      logs: true,
    });

    const outputs = response?.data?.images || response?.images || response?.output || [];
    const imageResult = Array.isArray(outputs) ? outputs[0] : outputs;

    if (!imageResult?.url) {
      return res.status(500).json({ error: "התגובה מהמודל לא כללה תמונה", raw: response });
    }

    return res.json({
      imageUrl: imageResult.url,
      raw: response,
    });
  } catch (error) {
    console.error("FAL request failed", error);
    return res.status(500).json({
      error: error?.message || "הקריאה ל-Fal נכשלה",
    });
  }
});

const PORT = process.env.AI_SERVER_PORT || 4000;
app.listen(PORT, () => {
  console.log(`AI studio server listening on http://localhost:${PORT}`);
});

