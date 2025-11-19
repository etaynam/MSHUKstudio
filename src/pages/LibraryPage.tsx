import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { uploadToCloudinary } from "../lib/cloudinary";
import { Modal } from "../components/ui/modal";
import {
  FileUp,
  Loader2,
  Trash2,
  Building2,
  Palette,
  Layers,
  Edit,
  Package,
  Barcode,
  FileText,
  Search,
  Users as UsersIcon,
  UploadCloud,
  Wand2,
} from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
}

interface Product {
  id: string;
  supplier_id: string | null;
  name: string;
  barcode: string | null;
  description?: string | null;
  image_url?: string | null;
  supplier?: Supplier | null;
}

interface ProductAsset {
  id: string;
  product_id: string;
  version_label: string | null;
  file_type: string;
  original_filename: string | null;
  cloudinary_public_id: string;
  cloudinary_url: string;
  png_url: string | null;
  created_at: string;
}

interface DashboardOutletContext {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const initialSupplierForm = { name: "", logo_url: "", brand_color: "" };
const initialProductForm = { name: "", barcode: "", description: "", supplier_id: "", image_url: "" };

export default function LibraryPage() {
  const { sidebarOpen, toggleSidebar } = useOutletContext<DashboardOutletContext>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [assets, setAssets] = useState<ProductAsset[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [search, setSearch] = useState("");
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productModalMode, setProductModalMode] = useState<"create" | "edit">("create");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [versionLabel, setVersionLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplierLogoUploading, setSupplierLogoUploading] = useState(false);
  const [productImageUploading, setProductImageUploading] = useState(false);
  const [productImageReplacingId, setProductImageReplacingId] = useState<string | null>(null);
  const [versionsModalOpen, setVersionsModalOpen] = useState(false);
  const [versionsModalProduct, setVersionsModalProduct] = useState<Product | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [deleteTargetProduct, setDeleteTargetProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  const openCreateProductModal = () => {
    setProductModalMode("create");
    setEditingProductId(null);
    setProductForm(initialProductForm);
    setProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setProductModalMode("edit");
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      barcode: product.barcode ?? "",
      description: product.description ?? "",
      supplier_id: product.supplier_id ?? "",
      image_url: product.image_url ?? "",
    });
    setProductModalOpen(true);
  };

  const closeProductModal = () => {
    setProductModalOpen(false);
    setProductModalMode("create");
    setEditingProductId(null);
    setProductForm(initialProductForm);
    setCopyFeedback(null);
  };

  const handleCopyImageUrl = async () => {
    if (!productForm.image_url) return;
    try {
      await navigator.clipboard.writeText(productForm.image_url);
      setCopyFeedback("הקישור הועתק");
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setError("לא ניתן להעתיק את הקישור");
    }
  };

  const openVersionsModal = (product: Product) => {
    setVersionsModalProduct(product);
    setSelectedProduct(product.id);
    setVersionsModalOpen(true);
  };

  const closeVersionsModal = () => {
    setVersionsModalOpen(false);
    setVersionsModalProduct(null);
    setSelectedProduct("");
  };

  const handleSupplierFilterChange = (value: string) => {
    setSelectedSupplier(value);
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set("supplier", value);
    } else {
      params.delete("supplier");
    }
    setSearchParams(params);
  };


  const handleConfirmDeleteProduct = async () => {
    if (!deleteTargetProduct) return;
    setDeletingProduct(true);
    try {
      await supabase.from("products").delete().eq("id", deleteTargetProduct.id);
      await supabase.from("product_assets").delete().eq("product_id", deleteTargetProduct.id);
      if (selectedProduct === deleteTargetProduct.id) {
        setSelectedProduct("");
      }
      loadData();
    } finally {
      setDeletingProduct(false);
      setDeleteTargetProduct(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const supplierParam = searchParams.get("supplier");
    if (supplierParam && supplierParam !== selectedSupplier) {
      setSelectedSupplier(supplierParam);
    }
    if (!supplierParam && selectedSupplier && searchParams.has("supplier")) {
      setSelectedSupplier("");
    }
  }, [searchParams, selectedSupplier]);

  const loadData = async () => {
    setSyncing(true);
    setError(null);
    const [suppliersRes, productsRes, assetsRes] = await Promise.all([
      supabase.from("suppliers").select("*").order("name", { ascending: true }),
      supabase
        .from("products")
        .select("*, suppliers: supplier_id (id, name, logo_url, brand_color)")
        .order("created_at", { ascending: false }),
      supabase
        .from("product_assets")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (suppliersRes.error || productsRes.error || assetsRes.error) {
      setError("טעינת הנתונים נכשלה. בדוק את החיבור ל-Supabase.");
    } else {
      setSuppliers(suppliersRes.data ?? []);
      setProducts(
        (productsRes.data as Product[])?.map((product) => ({
          ...product,
          supplier: Array.isArray((product as any).suppliers)
            ? (product as any).suppliers[0]
            : (product as any).suppliers,
        })) ?? []
      );
      setAssets(assetsRes.data ?? []);
    }
    setSyncing(false);
  };

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchSupplier = selectedSupplier ? product.supplier_id === selectedSupplier : true;
      const matchSearch = term
        ? product.name.toLowerCase().includes(term) || (product.barcode ?? "").includes(term)
        : true;
      return matchSupplier && matchSearch;
    });
  }, [products, selectedSupplier, search]);

  const modalVersionAssets = useMemo(() => {
    if (!versionsModalProduct) return [];
    return assets.filter((asset) => asset.product_id === versionsModalProduct.id);
  }, [assets, versionsModalProduct]);

  const handleUploadSingle = async (
    file: File,
    onSuccess: (url: string) => void,
    setLoading: (state: boolean) => void
  ) => {
    setLoading(true);
    try {
      const uploadResult = await uploadToCloudinary(file);
      onSuccess(uploadResult.secureUrl);
    } catch (err: any) {
      setError(err.message || "העלאה נכשלה");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async () => {
    if (!supplierForm.name.trim()) return;
    const { error } = await supabase.from("suppliers").insert({
      name: supplierForm.name.trim(),
      logo_url: supplierForm.logo_url || null,
      brand_color: supplierForm.brand_color || null,
    });
    if (error) {
      setError("הוספת הספק נכשלה: " + error.message);
    } else {
      setSupplierForm(initialSupplierForm);
      setSupplierModalOpen(false);
      loadData();
    }
  };

  const handleSubmitProduct = async () => {
    if (!productForm.name.trim()) return;
    const payload = {
      name: productForm.name.trim(),
      barcode: productForm.barcode || null,
      supplier_id: productForm.supplier_id || null,
      description: productForm.description || null,
      image_url: productForm.image_url || null,
    };

    const query =
      productModalMode === "edit" && editingProductId
        ? supabase.from("products").update(payload).eq("id", editingProductId)
        : supabase.from("products").insert(payload);

    const { error } = await query;
    if (error) {
      setError((productModalMode === "edit" ? "עדכון" : "הוספת") + " מוצר נכשלה: " + error.message);
    } else {
      setProductForm(initialProductForm);
      setEditingProductId(null);
      setProductModalMode("create");
      setProductModalOpen(false);
      loadData();
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || !selectedProduct) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const uploadResult = await uploadToCloudinary(file);
        await supabase.from("product_assets").insert({
          product_id: selectedProduct,
          version_label: versionLabel || file.name,
          file_type: uploadResult.format,
          original_filename: uploadResult.originalFilename,
          cloudinary_public_id: uploadResult.publicId,
          cloudinary_url: uploadResult.secureUrl,
          png_url: uploadResult.pngUrl,
          file_size: uploadResult.bytes,
          width: uploadResult.width,
          height: uploadResult.height,
        });
      }
      setVersionLabel("");
      loadData();
    } catch (err: any) {
      setError(err.message || "העלאה נכשלה");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    await supabase.from("product_assets").delete().eq("id", id);
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
    // TODO: מחיקה מ-Cloudinary תתבצע לאחר שנוסיף endpoint חתום
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="pill badge-primary text-xs">ספריית המדיה</p>
          <h1 className="heading-md mt-2">ניהול קבצי מוצרים</h1>
          <p className="body-text">שמור PSD, המר ל-PNG ושמור את כל הגרסאות במקום אחד.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary flex items-center gap-2" onClick={() => setSupplierModalOpen(true)}>
            <Building2 className="h-4 w-4" />
            ספק חדש
          </button>
          <button className="btn-secondary flex items-center gap-2" onClick={openCreateProductModal}>
            <Package className="h-4 w-4" />
            מוצר חדש
          </button>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => navigate("/dashboard/ai-studio")}
          >
            <Wand2 className="h-4 w-4" />
            סטודיו AI
          </button>
          <button className="btn-secondary flex items-center gap-2" onClick={toggleSidebar}>
            {sidebarOpen ? "כווץ תפריט" : "פתח תפריט"}
          </button>
        </div>
      </div>

      


      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)]">
        <div className="input-group bg-slate-50">
          <span className="input-icon bg-white">
            <Search className="h-4 w-4" />
          </span>
          <input
            placeholder="חפש לפי שם מוצר או ברקוד"
            className="input-control bg-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="input-group bg-slate-50">
          <span className="input-icon bg-white">
            <UsersIcon className="h-4 w-4" />
          </span>
          <select
            className="input-control bg-transparent"
            value={selectedSupplier}
            onChange={(e) => handleSupplierFilterChange(e.target.value)}
          >
            <option value="">כל הספקים</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="toast-banner toast-banner--error">{error}</div>}
      {syncing && <div className="toast-banner toast-banner--success">טוען נתונים...</div>}

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {filteredProducts.map((product) => {
          const totalVersions = assets.filter((a) => a.product_id === product.id).length;
          return (
            <div
              key={product.id}
              className={`group flex flex-col rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                versionsModalProduct?.id === product.id ? "border-[var(--color-primary)]" : "border-slate-100"
              }`}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-t-3xl bg-slate-100">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    אין תמונה למוצר
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900 line-clamp-1" title={product.name}>
                    {product.name}
                  </h3>
                  {product.supplier && (
                    <span
                      className="rounded-full px-3 py-1 text-xs text-white"
                      style={{ backgroundColor: product.supplier.brand_color ?? "#0f172a" }}
                    >
                      {product.supplier.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {product.supplier?.logo_url ? (
                    <img src={product.supplier.logo_url} alt={product.supplier.name} className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: product.supplier?.brand_color ?? "#cbd5f5" }}
                    />
                  )}
                  <span className="line-clamp-1">{product.supplier?.name || "ללא ספק"}</span>
                </div>
                <p className="text-sm text-slate-500 line-clamp-1" title={product.barcode || "אין ברקוד"}>
                  ברקוד: {product.barcode || "לא הוגדר"}
                </p>
                {product.description && (
                  <p className="text-xs text-slate-500 line-clamp-2" title={product.description}>
                    {product.description}
                  </p>
                )}
                <div className="mt-auto flex flex-col gap-2 rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">גרסאות: {totalVersions}</div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    <button
                      className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm hover:text-slate-900"
                      onClick={() => openEditProductModal(product)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                      עריכה
                    </button>
                    <label className="flex cursor-pointer items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm hover:text-slate-900">
                      {productImageReplacingId === product.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="h-3.5 w-3.5" />
                      )}
                      תמונה
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setProductImageReplacingId(product.id);
                          await handleUploadSingle(
                            file,
                            async (url) => {
                              await supabase.from("products").update({ image_url: url }).eq("id", product.id);
                              loadData();
                            },
                            () => {}
                          );
                          setProductImageReplacingId(null);
                          if (e.target) e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm text-red-500 hover:text-red-600"
                      onClick={() => setDeleteTargetProduct(product)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      מחיקה
                    </button>
                    <button
                      className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm hover:text-slate-900"
                      onClick={() => openVersionsModal(product)}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      גרסאות
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!filteredProducts.length && (
          <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
            אין מוצרים תואמים לחיפוש.
          </div>
        )}
      </section>

      {/* Versions modal will render below */}

      <Modal open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} title="ספק חדש">
        <div className="flex flex-col gap-3">
          <div className="input-group">
            <span className="input-icon">
              <Building2 className="h-4 w-4" />
            </span>
            <input
              placeholder="שם ספק"
              className="input-control"
              value={supplierForm.name}
              onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-slate-500">לוגו ספק</label>
            <label className="input-group cursor-pointer">
              <span className="input-icon">
                <UploadCloud className="h-4 w-4" />
              </span>
              <span className="input-control text-slate-500">
                {supplierLogoUploading
                  ? "מעלה..."
                  : supplierForm.logo_url
                  ? supplierForm.logo_url
                  : "בחר קובץ או גרור לכאן"}
              </span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleUploadSingle(
                      file,
                      (url) => setSupplierForm((prev) => ({ ...prev, logo_url: url })),
                      setSupplierLogoUploading
                    );
                  }
                }}
              />
            </label>
            {supplierForm.logo_url && (
              <img src={supplierForm.logo_url} alt="לוגו ספק" className="h-16 w-16 rounded-full object-cover" />
            )}
          </div>
          <div className="input-group">
            <span className="input-icon">
              <Palette className="h-4 w-4" />
            </span>
            <input
              placeholder="צבע מותג (HEX)"
              className="input-control"
              value={supplierForm.brand_color}
              onChange={(e) => setSupplierForm((prev) => ({ ...prev, brand_color: e.target.value }))}
            />
          </div>
          <button className="btn-primary justify-center" onClick={handleAddSupplier} disabled={supplierLogoUploading}>
            {supplierLogoUploading ? "מעלה..." : "שמור ספק"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!deleteTargetProduct}
        onClose={() => (!deletingProduct ? setDeleteTargetProduct(null) : null)}
        title="מחיקת מוצר"
      >
        <div className="flex flex-col gap-4">
          <p className="body-text text-slate-600">
            למחוק את {deleteTargetProduct?.name}? כל הגרסאות והקבצים המשויכים ימחקו לצמיתות.
          </p>
          <div className="flex justify-end gap-3">
            <button className="btn-ghost" type="button" onClick={() => (!deletingProduct ? setDeleteTargetProduct(null) : null)}>
              בטל
            </button>
            <button
              className="btn-primary bg-red-500 hover:bg-red-600"
              type="button"
              onClick={handleConfirmDeleteProduct}
              disabled={deletingProduct}
            >
              {deletingProduct ? "מוחק..." : "מחק מוצר"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={versionsModalOpen}
        onClose={closeVersionsModal}
        title={`ניהול גרסאות - ${versionsModalProduct?.name ?? ""}`}
        width="max-w-5xl"
      >
        {versionsModalProduct && (
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">מוצר</p>
                  <h3 className="text-xl font-semibold text-slate-900">{versionsModalProduct.name}</h3>
                  <p className="text-xs text-slate-400">
                    ברקוד: {versionsModalProduct.barcode || "לא הוגדר"}
                  </p>
                </div>
                <span className="pill badge-primary text-xs">
                  {modalVersionAssets.length} גרסאות
                </span>
              </div>

              {versionsModalProduct.image_url && (
                <img
                  src={versionsModalProduct.image_url}
                  alt={versionsModalProduct.name}
                  className="h-48 w-full rounded-3xl object-cover"
                />
              )}

              <div className="grid gap-3 md:grid-cols-2">
                {modalVersionAssets.map((asset) => (
                  <div key={asset.id} className="rounded-2xl border border-slate-100 p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {asset.version_label || asset.original_filename}
                        </p>
                        <p className="text-xs text-slate-500">פורמט: {asset.file_type.toUpperCase()}</p>
                      </div>
                      <button className="text-red-500" onClick={() => handleDeleteAsset(asset.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex gap-2 text-xs text-[var(--color-primary)]">
                      <a href={asset.cloudinary_url} target="_blank" rel="noreferrer" className="underline">
                        הורד מקור
                      </a>
                      {asset.png_url && asset.png_url !== asset.cloudinary_url && (
                        <a href={asset.png_url} target="_blank" rel="noreferrer" className="underline">
                          הורד PNG
                        </a>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      הועלה: {new Date(asset.created_at).toLocaleString("he-IL")}
                    </p>
                  </div>
                ))}
                {!modalVersionAssets.length && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                    עדיין לא הועלו קבצים למוצר הזה.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <h3 className="font-semibold text-slate-900">העלאת קבצים</h3>
              <p className="text-sm text-slate-500">גרור לכאן PSD/PNG/JPG או לחץ לבחירה.</p>
              <input
                type="text"
                placeholder="תגית גרסה"
                className="input-control border border-slate-200 rounded-full px-4 py-2 my-3"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
              />
              <label
                className={`mt-3 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed ${
                  uploading ? "border-slate-200 bg-slate-50" : "border-slate-300 bg-slate-50"
                }`}
              >
                {uploading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
                ) : (
                  <>
                    <FileUp className="h-8 w-8 text-slate-400" />
                    <p className="mt-2 text-sm text-slate-500">לחץ או גרור קבצים לכאן</p>
                  </>
                )}
                <input
                  type="file"
                  className="hidden"
                  multiple
                  disabled={!selectedProduct || uploading}
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
              </label>
              {!selectedProduct && <p className="mt-2 text-xs text-red-500">בחר מוצר לפני העלאה</p>}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={productModalOpen}
        onClose={closeProductModal}
        title={productModalMode === "edit" ? "עריכת מוצר" : "מוצר חדש"}
      >
        <div className="flex flex-col gap-4">
          <div className="input-group">
            <span className="input-icon">
              <Package className="h-4 w-4" />
            </span>
            <input
              placeholder="שם מוצר"
              className="input-control"
              value={productForm.name}
              onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="input-group">
            <span className="input-icon">
              <Barcode className="h-4 w-4" />
            </span>
            <input
              placeholder="ברקוד"
              className="input-control"
              value={productForm.barcode}
              onChange={(e) => setProductForm((prev) => ({ ...prev, barcode: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-slate-500">תיאור מוצר</label>
            <div className="input-group items-start">
              <span className="input-icon">
                <FileText className="h-4 w-4" />
              </span>
              <textarea
                placeholder="כתוב תיאור קצר על המוצר"
                className="input-control min-h-[90px] resize-y"
                value={productForm.description}
                onChange={(e) =>
                  setProductForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-slate-500">תמונת מוצר</label>
            <label className="input-group cursor-pointer">
              <span className="input-icon">
                <UploadCloud className="h-4 w-4" />
              </span>
              <span className="input-control text-slate-500">
                {productImageUploading
                  ? "מעלה..."
                  : productForm.image_url
                  ? productForm.image_url
                  : "בחר תמונה או גרור לכאן"}
              </span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleUploadSingle(
                      file,
                      (url) => setProductForm((prev) => ({ ...prev, image_url: url })),
                      setProductImageUploading
                    );
                  }
                }}
              />
            </label>
            {productForm.image_url && (
              <>
                <img src={productForm.image_url} alt="תמונת מוצר" className="h-24 w-full rounded-2xl object-cover" />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <button
                    type="button"
                    className="text-[var(--color-primary)] underline"
                    onClick={handleCopyImageUrl}
                  >
                    העתק קישור
                  </button>
                  {copyFeedback && <span className="text-emerald-500">{copyFeedback}</span>}
                </div>
              </>
            )}
          </div>
          <div className="input-group">
            <span className="input-icon">
              <Building2 className="h-4 w-4" />
            </span>
            <select
              className="input-control"
              value={productForm.supplier_id}
              onChange={(e) => setProductForm((prev) => ({ ...prev, supplier_id: e.target.value }))}
            >
              <option value="">בחר ספק (אופציונלי)</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn-primary justify-center"
            onClick={handleSubmitProduct}
            disabled={productImageUploading}
          >
            {productModalMode === "edit"
              ? productImageUploading
                ? "מעלה..."
                : "עדכן מוצר"
              : productImageUploading
              ? "מעלה..."
              : "שמור מוצר"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
