import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { uploadToCloudinary } from "../lib/cloudinary";
import {
  UploadCloud,
  Loader2,
  Building2,
  Package,
  Barcode,
  Layers,
  Wand2,
  Check,
} from "lucide-react";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

interface GalleryImage {
  id: string;
  url: string;
}

interface GalleryRun {
  id: string;
  createdAt: string;
  images: GalleryImage[];
  selectedImageId: string | null;
  name: string;
  barcode: string;
  supplierId: string;
  attachProductId: string;
  saving?: "new" | "attach" | null;
}

const cleanUrlEnv = (value?: string | null) => {
  if (!value) return null;
  return value.split(/\s+/)?.[0]?.trim() || null;
};

const deriveFunctionUrl = () => {
  const explicit = cleanUrlEnv(
    process.env.REACT_APP_SUPABASE_AI_FUNCTION_URL || process.env.REACT_APP_AI_SERVER_URL
  );
  if (explicit) return explicit.replace(/\/$/, "");

  const supabaseUrl = cleanUrlEnv(process.env.REACT_APP_SUPABASE_URL);
  if (!supabaseUrl) return null;
  try {
    const parsed = new URL(supabaseUrl);
    const host = parsed.host.replace(".supabase.co", ".functions.supabase.co");
    return `https://${host}/ai-studio`;
  } catch {
    return null;
  }
};

const AI_STUDIO_ENDPOINT =
  deriveFunctionUrl() ?? "http://localhost:54321/functions/v1/ai-studio";
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export default function AiStudioPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [uploadingSources, setUploadingSources] = useState(false);
  const [productName, setProductName] = useState("");
  const [gallery, setGallery] = useState<GalleryRun[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const triggerToast = (type: "success" | "error", message: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast({ type, message });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    const load = async () => {
      const [suppliersRes, productsRes] = await Promise.all([
        supabase.from("suppliers").select("id,name").order("name", { ascending: true }),
        supabase.from("products").select("id,name").order("created_at", { ascending: false }),
      ]);
      if (!suppliersRes.error) {
        setSuppliers(suppliersRes.data ?? []);
      }
      if (!productsRes.error) {
        setProducts(productsRes.data ?? []);
      }
    };
    load();
  }, []);

  const handleUploadSources = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingSources(true);
    setError(null);
    for (const file of Array.from(files)) {
      try {
        const result = await uploadToCloudinary(file);
        setSourceImages((prev) => [...prev, result.secureUrl]);
      } catch (err: any) {
        setError(err?.message || "העלאת התמונה נכשלה");
      }
    }
    setUploadingSources(false);
  };

  const removeSourceImage = (url: string) => {
    setSourceImages((prev) => prev.filter((item) => item !== url));
  };

  const handleGenerate = async () => {
    if (!sourceImages.length) {
      setError("בחר לפחות תמונה אחת לעיבוד");
      return;
    }
    if (!AI_STUDIO_ENDPOINT) {
      setError("לא הוגדרה כתובת לפונקציה");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (SUPABASE_ANON_KEY) {
        headers["apikey"] = SUPABASE_ANON_KEY;
        headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
      }

      const response = await fetch(AI_STUDIO_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({
          imageUrls: sourceImages,
          productName: productName || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "הבקשה לסטודיו נכשלה");
      }
      const runId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const images: GalleryImage[] = (data.imageUrls as string[]).map((url: string, index: number) => ({
        id: `${runId}-${index}`,
        url,
      }));
      setGallery((prev) => [
        {
          id: runId,
          createdAt: new Date().toISOString(),
          images,
          selectedImageId: images[0]?.id ?? null,
          name: productName,
          barcode: "",
          supplierId: "",
          attachProductId: "",
          saving: null,
        },
        ...prev,
      ]);
      setSourceImages([]);
    } catch (err: any) {
      setError(err?.message || "קריאת ה-AI נכשלה");
    } finally {
      setGenerating(false);
    }
  };

  const updateRunField = (id: string, field: keyof GalleryRun, value: string) => {
    setGallery((prev) =>
      prev.map((run) => (run.id === id ? { ...run, [field]: value } : run))
    );
  };

  const selectRunImage = (runId: string, imageId: string) => {
    setGallery((prev) =>
      prev.map((run) => (run.id === runId ? { ...run, selectedImageId: imageId } : run))
    );
  };

  const setRunSaving = (runId: string, state: GalleryRun["saving"]) => {
    setGallery((prev) =>
      prev.map((run) => (run.id === runId ? { ...run, saving: state } : run))
    );
  };

  const getSelectedImageUrl = (run: GalleryRun) => {
    const selected = run.images.find((img) => img.id === run.selectedImageId);
    return selected?.url ?? run.images[0]?.url ?? null;
  };

  const handleSaveAsNew = async (runId: string) => {
    const run = gallery.find((item) => item.id === runId);
    if (!run) return;
    const imageUrl = getSelectedImageUrl(run);
    if (!imageUrl) {
      triggerToast("error", "לא נבחרה תמונה לשמירה");
      return;
    }
    if (!run.name.trim()) {
      triggerToast("error", "אנא הזן שם מוצר לפני שמירה");
      return;
    }

    setRunSaving(runId, "new");
    try {
      const { error: insertError } = await supabase.from("products").insert({
        name: run.name.trim(),
        barcode: run.barcode || null,
        supplier_id: run.supplierId || null,
        image_url: imageUrl,
      });
      if (insertError) throw insertError;
      setGallery((prev) => prev.filter((item) => item.id !== runId));
      triggerToast("success", "המוצר נשמר בהצלחה");
    } catch (err: any) {
      triggerToast("error", err?.message || "שמירת המוצר נכשלה");
      setRunSaving(runId, null);
    }
  };

  const handleAttachToProduct = async (runId: string) => {
    const run = gallery.find((item) => item.id === runId);
    if (!run) return;
    const imageUrl = getSelectedImageUrl(run);
    if (!imageUrl) {
      triggerToast("error", "לא נבחרה תמונה לשמירה");
      return;
    }
    if (!run.attachProductId) {
      triggerToast("error", "בחר מוצר קיים לעדכון");
      return;
    }

    setRunSaving(runId, "attach");
    try {
      const { error: updateError } = await supabase
        .from("products")
        .update({ image_url: imageUrl })
        .eq("id", run.attachProductId);
      if (updateError) throw updateError;
      setGallery((prev) => prev.filter((item) => item.id !== runId));
      triggerToast("success", "תמונת המוצר עודכנה בהצלחה");
    } catch (err: any) {
      triggerToast("error", err?.message || "עדכון המוצר נכשל");
      setRunSaving(runId, null);
    }
  };

  const canGenerate = sourceImages.length > 0 && !generating;

  const sortedGallery = useMemo(
    () => gallery.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [gallery]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="pill badge-primary text-xs">סטודיו AI</p>
          <h1 className="heading-md mt-2">הפוך תמונות גולמיות לסטודיו מקצועי</h1>
          <p className="body-text">
            העלה תמונות מוצר חובבניות וקבל 4 גרסאות סטודיו נקיות. בחר את התוצאה המתאימה וצרף למוצר חדש או קיים.
          </p>
        </div>
        <button className="btn-ghost" onClick={() => navigate("/dashboard/library")}>
          חזרה לספרייה
        </button>
      </div>

      {error && <div className="toast-banner toast-banner--error">{error}</div>}
      {toast && (
        <div
          className={`toast-banner ${
            toast.type === "success" ? "toast-banner--success" : "toast-banner--error"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-700">העלאת תמונות מקור</p>
            <p className="text-xs text-slate-500">
              התמונות נשמרות זמנית ב-Cloudinary ונשלחות לפונקציית Supabase כדי לשמור על המפתח שלך מאובטח.
            </p>
          </div>

          <div className="input-group">
            <span className="input-icon">
              <Package className="h-4 w-4" />
            </span>
            <input
              placeholder="שם מוצר (אופציונלי)"
              className="input-control"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>

          <label
            className={`mt-2 flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed ${
              uploadingSources ? "border-slate-200 bg-white" : "border-slate-300 bg-white"
            }`}
          >
            {uploadingSources ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                <p className="mt-2 text-sm text-slate-500">מעלה אל הענן...</p>
              </>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-slate-400" />
                <p className="mt-2 text-sm text-slate-600">לחץ או גרור תמונות מוצר</p>
                <p className="text-xs text-slate-400">ניתן להעלות מספר קבצים יחד</p>
              </>
            )}
            <input
              type="file"
              className="hidden"
              accept="image/*"
              multiple
              disabled={uploadingSources}
              onChange={(e) => handleUploadSources(e.target.files)}
            />
          </label>

          {!!sourceImages.length && (
            <div className="flex flex-wrap gap-3">
              {sourceImages.map((url) => (
                <div
                  key={url}
                  className="relative h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <img src={url} alt="upload" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute left-1 top-1 rounded-full bg-white/90 px-2 py-0.5 text-xs text-slate-600 shadow"
                    onClick={() => removeSourceImage(url)}
                  >
                    הסר
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              className="btn-primary flex items-center justify-center gap-2"
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  מייצר 4 תמונות...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  צור 4 תמונות סטודיו
                </>
              )}
            </button>
            <button
              className="btn-ghost text-sm text-slate-500"
              type="button"
              onClick={() => {
                setSourceImages([]);
                setProductName("");
              }}
              disabled={!sourceImages.length && !productName}
            >
              אפס בחירות
            </button>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">איך זה עובד?</p>
            <ol className="mt-2 list-decimal space-y-1 pr-4">
              <li>העלה 1-5 תמונות מוצר.</li>
              <li>לחץ על “צור 4 תמונות סטודיו”.</li>
              <li>בחר את התמונה המועדפת ושמור אותה כמוצר חדש או עדכון.</li>
            </ol>
          </div>
        </aside>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="heading-md">תוצאות אחרונות</h2>
              <p className="text-sm text-slate-500">
                כל מקבץ כולל 4 תמונות. בחר את התמונה שמתאימה לך והמשך לשלב השמירה.
              </p>
            </div>
            {!!gallery.length && (
              <button className="btn-ghost btn-sm" onClick={() => setGallery([])}>
                נקה גלריה
              </button>
            )}
          </div>

          {generating && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, idx) => (
                <div
                  key={idx}
                  className="flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 animate-pulse"
                >
                  <Loader2 className="mb-2 h-5 w-5 animate-spin" />
                  מייצר תמונה...
                </div>
              ))}
            </div>
          )}

          {!generating && !gallery.length && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              עדיין לא נוצרו תמונות. העלה תמונות מקור ולחץ על “צור 4 תמונות סטודיו”.
            </div>
          )}

          <div className="mt-6 space-y-6">
            {sortedGallery.map((run) => (
              <div key={run.id} className="rounded-3xl border border-slate-100 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500">
                      {new Date(run.createdAt).toLocaleString("he-IL")}
                    </p>
                    <h3 className="text-base font-semibold text-slate-900">
                      {run.name || "מקבץ ללא שם"}
                    </h3>
                  </div>
                  <span className="pill badge-primary text-xs">4 תמונות</span>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {run.images.map((image) => {
                    const isSelected = image.id === run.selectedImageId;
                    return (
                      <button
                        key={image.id}
                        type="button"
                        className={`relative flex aspect-[3/4] w-full flex-col items-center justify-center rounded-2xl border bg-slate-100 transition ${
                          isSelected
                            ? "border-[var(--color-primary)] bg-white shadow-lg"
                            : "border-slate-100 shadow-sm hover:border-slate-200"
                        }`}
                        onClick={() => selectRunImage(run.id, image.id)}
                      >
                        <img
                          src={image.url}
                          alt="תוצר AI"
                          className="h-full w-full rounded-2xl object-contain p-2"
                        />
                        {isSelected && (
                          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-emerald-600 shadow">
                            <Check className="h-3 w-3" /> נבחר
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="input-group">
                    <span className="input-icon">
                      <Package className="h-4 w-4" />
                    </span>
                    <input
                      placeholder="שם מוצר"
                      className="input-control"
                      value={run.name}
                      onChange={(e) => updateRunField(run.id, "name", e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <span className="input-icon">
                      <Barcode className="h-4 w-4" />
                    </span>
                    <input
                      placeholder="ברקוד"
                      className="input-control"
                      value={run.barcode}
                      onChange={(e) => updateRunField(run.id, "barcode", e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <span className="input-icon">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <select
                      className="input-control"
                      value={run.supplierId}
                      onChange={(e) => updateRunField(run.id, "supplierId", e.target.value)}
                    >
                      <option value="">בחר ספק (אופציונלי)</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <span className="input-icon">
                      <Layers className="h-4 w-4" />
                    </span>
                    <select
                      className="input-control"
                      value={run.attachProductId}
                      onChange={(e) => updateRunField(run.id, "attachProductId", e.target.value)}
                    >
                      <option value="">עדכן מוצר קיים</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 lg:flex-row">
                  <button
                    className="btn-primary flex-1 justify-center"
                    onClick={() => handleSaveAsNew(run.id)}
                    disabled={run.saving === "new"}
                  >
                    {run.saving === "new" ? "שומר..." : "שמור כמוצר חדש"}
                  </button>
                  <button
                    className="btn-secondary flex-1 justify-center"
                    onClick={() => handleAttachToProduct(run.id)}
                    disabled={!run.attachProductId || run.saving === "attach"}
                  >
                    {run.saving === "attach" ? "מעדכן..." : "עדכן מוצר קיים"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

