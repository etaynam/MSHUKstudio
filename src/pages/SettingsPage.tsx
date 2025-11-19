import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Loader2, KeyRound, Save } from "lucide-react";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "abyssale_api_key")
        .maybeSingle();
      if (!error && data?.value) {
        setApiKey(data.value);
      }
      setLoading(false);
    };
    loadSettings();
  }, []);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert(
      {
        key: "abyssale_api_key",
        value: apiKey.trim(),
      },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) {
      showToast("error", error.message);
    } else {
      showToast("success", "המפתח נשמר בהצלחה");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="pill badge-primary text-xs">הגדרות</p>
          <h1 className="heading-md mt-2">חיבורי מערכת</h1>
          <p className="body-text">נהל מפתחות API עבור Abyssale ושירותים אחרים.</p>
        </div>
      </div>

      {toast && (
        <div
          className={`toast-banner ${
            toast.type === "success" ? "toast-banner--success" : "toast-banner--error"
          }`}
        >
          {toast.message}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="heading-md mb-2">מפתח Abyssale</h2>
        <p className="text-sm text-slate-500">
          שמור כאן את מפתח ה-API. הפונקציות בצד השרת ישלפו אותו בצורה מאובטחת.
        </p>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> טוען הגדרות...
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="input-group">
              <span className="input-icon">
                <KeyRound className="h-4 w-4" />
              </span>
              <input
                type="password"
                placeholder="הכנס מפתח Abyssale"
                className="input-control"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              שמור מפתח
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

