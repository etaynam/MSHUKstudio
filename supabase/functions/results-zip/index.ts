import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import JSZip from "https://deno.land/x/jszip@0.11.0/mod.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ZipEntry = {
  url?: string;
  fileName?: string;
};

const inferExtension = (fileName?: string, contentType?: string) => {
  if (fileName && fileName.includes(".")) {
    return fileName.split(".").pop() || "png";
  }
  if (contentType?.includes("/")) {
    return contentType.split("/")[1];
  }
  return "png";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const entries: ZipEntry[] = Array.isArray(body?.entries) ? body.entries : [];
    if (!entries.length) {
      return new Response(JSON.stringify({ error: "No entries provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zip = new JSZip();
    let added = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry?.url) continue;
      try {
        const response = await fetch(entry.url);
        if (!response.ok) {
          console.error("zip fetch failed", entry.url, response.status);
          continue;
        }
        const arrayBuffer = await response.arrayBuffer();
        const extension = inferExtension(entry.fileName, response.headers.get("content-type") ?? undefined);
        const safeName =
          entry.fileName && entry.fileName.trim().length
            ? entry.fileName
            : `result-${i + 1}.${extension.replace(/[^a-zA-Z0-9]/g, "") || "png"}`;
        zip.file(safeName, new Uint8Array(arrayBuffer));
        added++;
      } catch (error) {
        console.error("zip fetch error", entry.url, error);
      }
    }

    if (!added) {
      return new Response(JSON.stringify({ error: "Failed to collect files for ZIP" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = await zip.generateAsync({ type: "uint8array" });
    const base64Zip = encodeBase64(content);
    const fileName = body?.fileName || `campaign-results-${Date.now()}.zip`;

    return new Response(JSON.stringify({ zipBase64: base64Zip, fileName }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("results-zip error", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


