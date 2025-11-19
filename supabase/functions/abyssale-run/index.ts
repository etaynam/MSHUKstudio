// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceKey);

async function getAbyssaleApiKey() {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "abyssale_api_key")
    .maybeSingle();

  if (error) throw error;
  return data?.value ?? null;
}

const abyssaleHeaders = (apiKey: string) => ({
  "Content-Type": "application/json",
  "x-api-key": apiKey,
  Authorization: `Bearer ${apiKey}`,
});

async function fetchTemplates(apiKey: string) {
  const response = await fetch("https://api.abyssale.com/designs", {
    method: "GET",
    headers: abyssaleHeaders(apiKey),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("abyssale templates error", response.status, text);
    return {
      error: `Abyssale templates request failed (${response.status}): ${text}`,
    };
  }
  const data = await response.json();
  const list = Array.isArray(data?.designs) ? data.designs : Array.isArray(data) ? data : [];
  const templates = await Promise.all(
    list.map(async (tpl: any) => {
      try {
        const detailsResponse = await fetch(`https://api.abyssale.com/designs/${tpl.id}`, {
          method: "GET",
          headers: abyssaleHeaders(apiKey),
        });
        if (!detailsResponse.ok) {
          const text = await detailsResponse.text();
          console.error("abyssale design details error", tpl.id, text);
          return tpl;
        }
        const details = await detailsResponse.json();
        return { ...tpl, details };
      } catch (error) {
        console.error("abyssale design details fetch failed", tpl.id, error);
        return tpl;
      }
    })
  );
  return { templates };
}

async function generateBatch(apiKey: string, payload: any) {
  const { templateId, deals = [], layouts = [], overrides = {} } = payload ?? {};
  if (!templateId) {
    return { error: "חסר מזהה תבנית (templateId)" };
  }
  if (!Array.isArray(deals) || !deals.length) {
    return { error: "חסר לפחות מוצר אחד לעיבוד" };
  }
  const results: any[] = [];
  for (const deal of deals) {
    const targetLayouts = layouts.length ? layouts : [null];
    for (const layoutName of targetLayouts) {
      try {
        const requestBody: Record<string, unknown> = {
          elements: deal.overrides ?? {},
        };
        if (layoutName) {
          requestBody.template_format_name = layoutName;
        }
        const response = await fetch(
          `https://api.abyssale.com/banner-builder/${templateId}/generate`,
          {
            method: "POST",
            headers: abyssaleHeaders(apiKey),
            body: JSON.stringify(requestBody),
          }
        );
        const data = await response.json();
        if (!response.ok) {
          console.error("abyssale generate error", response.status, data);
          results.push({
            dealId: deal.id,
            layout: layoutName,
            status: "error",
            message: data?.message || data?.error || "קריאה ל-Abyssale נכשלה",
          });
        } else {
          results.push({ dealId: deal.id, layout: layoutName, status: "success", data });
        }
      } catch (error) {
        results.push({
          dealId: deal.id,
          layout: layoutName,
          status: "error",
          message: (error as Error).message,
        });
      }
    }
  }
  return { results };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body?.action;

    const apiKey = await getAbyssaleApiKey();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "לא נשמר מפתח Abyssale במערכת ההגדרות" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "templates") {
      const data = await fetchTemplates(apiKey);
      const status = data.error ? 400 : 200;
      return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate") {
      const data = await generateBatch(apiKey, body);
      const status = data.error ? 400 : 200;
      return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("abyssale-run error", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

