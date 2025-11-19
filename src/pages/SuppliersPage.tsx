import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { uploadToCloudinary } from "../lib/cloudinary";
import { Modal } from "../components/ui/modal";
import { Building2, UploadCloud, Package, Users } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
}

interface SupplierWithStats extends Supplier {
  products_count: number;
}

const initialForm = { id: "", name: "", logo_url: "", brand_color: "" };

export default function SuppliersPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<SupplierWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("suppliers")
      .select("*, products(count)")
      .order("name", { ascending: true });

    if (error) {
      setError("טעינת ספקים נכשלה: " + error.message);
    } else {
      const mapped: SupplierWithStats[] = (data || []).map((sup: any) => ({
        id: sup.id,
        name: sup.name,
        logo_url: sup.logo_url,
        brand_color: sup.brand_color,
        products_count: sup.products?.[0]?.count ?? 0,
      }));
      setSuppliers(mapped);
    }
    setLoading(false);
  };

  const openCreateModal = () => {
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (supplier: SupplierWithStats) => {
    setForm({
      id: supplier.id,
      name: supplier.name,
      logo_url: supplier.logo_url ?? "",
      brand_color: supplier.brand_color ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(initialForm);
    setLogoUploading(false);
  };

  const handleUploadLogo = async (file: File) => {
    setLogoUploading(true);
    try {
      const uploadResult = await uploadToCloudinary(file);
      setForm((prev) => ({ ...prev, logo_url: uploadResult.secureUrl }));
    } catch (err: any) {
      setError(err.message || "העלאת הלוגו נכשלה");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      logo_url: form.logo_url || null,
      brand_color: form.brand_color || null,
    };

    const query = form.id
      ? supabase.from("suppliers").update(payload).eq("id", form.id)
      : supabase.from("suppliers").insert(payload);

    const { error } = await query;
    if (error) {
      setError("שמירת הספק נכשלה: " + error.message);
    } else {
      closeModal();
      loadSuppliers();
    }
  };

  const supplierCards = useMemo(() => suppliers, [suppliers]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="pill badge-primary text-xs">ניהול ספקים</p>
          <h1 className="heading-md mt-2">ספקים ומותגים במערכת</h1>
          <p className="body-text">ערוך שמות, צבעים ולוגואים, וגש ישירות למוצרים שלהם.</p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={openCreateModal}>
          <Building2 className="h-4 w-4" />
          ספק חדש
        </button>
      </div>

      {error && <div className="toast-banner toast-banner--error">{error}</div>}

      {loading ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
          טוען ספקים...
        </div>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {supplierCards.map((supplier) => (
            <div
              key={supplier.id}
              className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex items-center gap-3">
                {supplier.logo_url ? (
                  <img src={supplier.logo_url} alt={supplier.name} className="h-12 w-12 rounded-2xl object-cover" />
                ) : (
                  <div
                    className="h-12 w-12 rounded-2xl"
                    style={{ backgroundColor: supplier.brand_color ?? "#e2e8f0" }}
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 line-clamp-1">{supplier.name}</h3>
                  <p className="text-xs text-slate-500">מוצרים: {supplier.products_count}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                <button
                  className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1"
                  onClick={() => openEditModal(supplier)}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  עריכה
                </button>
                <button
                  className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1"
                  onClick={() => navigate(`/dashboard/library?supplier=${supplier.id}`)}
                >
                  <Package className="h-3.5 w-3.5" />
                  פתח בספרייה
                </button>
              </div>
            </div>
          ))}

          {!supplierCards.length && (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
              עדיין לא הוגדרו ספקים.
            </div>
          )}
        </section>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={form.id ? "עריכת ספק" : "ספק חדש"}>
        <div className="flex flex-col gap-4">
          <div className="input-group">
            <span className="input-icon">
              <Users className="h-4 w-4" />
            </span>
            <input
              className="input-control"
              placeholder="שם ספק"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="input-group">
            <span className="input-icon">
              <Building2 className="h-4 w-4" />
            </span>
            <input
              type="color"
              className="input-control"
              value={form.brand_color || "#16db65"}
              onChange={(e) => setForm((prev) => ({ ...prev, brand_color: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-slate-600">לוגו</label>
            <label className="input-group cursor-pointer">
              <span className="input-icon">
                <UploadCloud className="h-4 w-4" />
              </span>
              <span className="input-control">
                {logoUploading ? "מעלה לוגו..." : form.logo_url ? "החלף לוגו" : "העלה לוגו"}
              </span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadLogo(file);
                }}
              />
            </label>
            {form.logo_url && (
              <img src={form.logo_url} alt="לוגו" className="h-20 w-20 rounded-2xl object-cover" />
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button className="btn-ghost" type="button" onClick={closeModal}>
              בטל
            </button>
            <button className="btn-primary" type="button" onClick={handleSubmit}>
              שמור
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
