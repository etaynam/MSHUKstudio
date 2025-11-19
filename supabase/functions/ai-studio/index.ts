// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { fal } from "npm:@fal-ai/client@1.7.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FAL_API_KEY = Deno.env.get("FAL_API_KEY") ?? "";

if (!FAL_API_KEY) {
  console.warn("FAL_API_KEY is not set. Remember to configure supabase secrets.");
}

fal.config({
  credentials: FAL_API_KEY,
});

const DEFAULT_MODEL = Deno.env.get("FAL_MODEL_ID") ?? "fal-ai/nano-banana/edit";
const BASE_PROMPT = `Please transform the uploaded product photo into a professional, clean studio-front product image using nano-level precision and full intelligent context understanding.

Preserve all original micro-details including the exact product shape, label design, printed text (Hebrew/English), barcodes, colors, logos, icons, proportions, and packaging identity.

Correct the shooting angle to a perfectly centered, straight, front-facing studio view, eliminating any top-down distortion or tilt. Straighten the product if it was leaning or rotated.
Remove all amateur reflections, glare, specular highlights, uneven lighting, shadow noise, fingerprint-like reflections, and environmental light artifacts.

Rebuild the product surface where reflections hide details, using molecular-level reconstruction while keeping the true original design.
Fix any dents, warping, crushed areas, or uneven packaging so it looks perfectly smooth, uniform, and professionally shaped.

Place the product on a pure white seamless studio background (#FFFFFF) with soft, clean, natural-looking shadowing that matches high-end ecommerce photography.
Remove all environmental objects, backgrounds, glass tables, room elements, and distractions.

If multiple images are provided, intelligently merge information to create the most accurate and complete studio-perfect final result.
Output must look like a high-end catalog image — sharp, clean, balanced, and photorealistic.`;

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!FAL_API_KEY) {
    return new Response(JSON.stringify({ error: "FAL_API_KEY is not configured" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  try {
    const { imageUrls, productName, modelId } = await req.json();

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(JSON.stringify({ error: "imageUrls must contain at least one image URL" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const falResponse = await fal.subscribe(modelId || DEFAULT_MODEL, {
      input: {
        prompt: `${BASE_PROMPT}\n\nProduct name: ${productName || "N/A"}`,
        image_urls: imageUrls,
        num_images: 4,
        output_format: "png",
      },
      logs: true,
    });

    const outputs =
      falResponse?.data?.images ||
      falResponse?.images ||
      (Array.isArray(falResponse?.output) ? falResponse?.output : [falResponse?.output]);

    const generatedImageUrls = (Array.isArray(outputs) ? outputs : [outputs])
      .map((img) => img?.url)
      .filter((url): url is string => Boolean(url));

    if (!generatedImageUrls.length) {
      return new Response(JSON.stringify({ error: "Model did not return images", raw: falResponse }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({ imageUrls: generatedImageUrls, raw: falResponse }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("ai-studio function error", error);
    return new Response(JSON.stringify({ error: (error as Error).message ?? "Unknown error" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});

