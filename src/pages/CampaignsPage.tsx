import { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabaseClient";
import { Modal } from "../components/ui/modal";
import { saveAs } from "file-saver";
import {
  Package,
  Barcode,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  FileSpreadsheet,
  PenSquare,
  Loader2,
  Search,
  Hash,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
} from "lucide-react";

interface ProductSummary {
  id: string;
  name: string;
  barcode: string | null;
  description: string | null;
  image_url: string | null;
  supplier_name?: string | null;
}

interface TemplateField {
  id: string;
  label: string;
  type: "text" | "number" | "image";
  required?: boolean;
  attributeKey?: string;
}

interface TemplateLayout {
  id: string;
  name: string;
  size: string;
}

interface TemplateOption {
  id: string;
  name: string;
  fields: TemplateField[];
  layouts: TemplateLayout[];
  previewUrl?: string;
  metadata?: any;
  details?: any;
}

interface CampaignRecord {
  id: string;
  title: string;
  template_id: string;
  selected_fields: string[];
  selected_layouts: string[];
  status: string;
  created_at: string;
}

type ProductAttributeKey = "name" | "description" | "image_url" | "barcode";

interface ManualDeal {
  id: string;
  productId: string | null;
  productLabel: string;
  barcode: string;
  productSearch: string;
  customFields: Record<string, string>;
}

interface CsvEntry {
  rowNumber: number;
  data: Record<string, string>;
  productFound: boolean;
  productId?: string;
  missingReason?: string;
}

const mockTemplates: TemplateOption[] = [
  {
    id: "template_hero",
    name: "Hero Promo",
    fields: [
      { id: "product_name", label: "שם מוצר", type: "text", required: true },
      { id: "product_description", label: "תיאור", type: "text" },
      { id: "promo_price", label: "מחיר מבצע", type: "number", required: true },
      { id: "promo_limit", label: "הגבלת רכישה", type: "text" },
      { id: "product_image", label: "תמונת מוצר", type: "image", required: true },
    ],
    layouts: [
      { id: "square", name: "פיד 1080x1080", size: "1080x1080" },
      { id: "story", name: "סטורי", size: "1080x1920" },
      { id: "banner", name: "באנר 1200x628", size: "1200x628" },
    ],
  },
  {
    id: "template_price_tag",
    name: "תג מחיר",
    fields: [
      { id: "product_name", label: "שם מוצר", type: "text", required: true },
      { id: "promo_price", label: "מחיר", type: "number", required: true },
      { id: "currency", label: "מטבע", type: "text" },
    ],
    layouts: [{ id: "square", name: "1080x1080", size: "1080x1080" }],
  },
];

const defaultDeal = (): ManualDeal => ({
  id: crypto.randomUUID(),
  productId: null,
  productLabel: "",
  productSearch: "",
  barcode: "",
  customFields: {},
});

const fieldValueFromDeal = (fieldId: string, deal: ManualDeal) => {
  return deal.customFields[fieldId] ?? "";
};

const PRODUCT_ATTRIBUTES: { key: ProductAttributeKey; label: string }[] = [
  { key: "name", label: "שם מוצר" },
  { key: "description", label: "תיאור מוצר" },
  { key: "image_url", label: "תמונת מוצר" },
  { key: "barcode", label: "ברקוד" },
];

const getProductAttributeValue = (key: ProductAttributeKey, product: ProductSummary) => {
  switch (key) {
    case "name":
      return product.name;
    case "description":
      return product.description ?? "";
    case "image_url":
      return product.image_url ?? "";
    case "barcode":
      return product.barcode ?? "";
    default:
      return "";
  }
};

const extractResultUrl = (data: any) => {
  if (!data) return "";
  return (
    data.file?.url ||
    data.file?.cdn_url ||
    data.image?.url ||
    data.banner?.file?.url ||
    data.banner?.url ||
    data.url ||
    data.media?.url ||
    ""
  );
};

const base64ToBlob = (base64: string, type = "application/octet-stream") => {
  const decoded = atob(base64);
  const length = decoded.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return new Blob([bytes], { type });
};

const getLayoutPreviewDimensions = (size: string) => {
  const [w, h] = size?.split("x").map((value: string) => Number(value)) ?? [];
  if (!w || !h) return { width: 42, height: 42 };
  const base = 42;
  const ratio = h / w;
  if (ratio === 1) return { width: base, height: base };
  if (ratio > 1) {
    return { width: Math.max(24, base / ratio), height: base };
  }
  return { width: base, height: Math.max(24, base * ratio) };
};

const createEmptyMapping = (): Record<ProductAttributeKey, string | null> => ({
  name: null,
  description: null,
  image_url: null,
  barcode: null,
});

const mapAbyssaleTemplates = (payload: any[]): TemplateOption[] => {
  if (!Array.isArray(payload)) return [];
  return payload.map((tpl) => ({
    id: tpl.id || tpl.template_id || tpl.name,
    name: tpl.name || tpl.title || tpl.id || "תבנית ללא שם",
    fields: (tpl.details?.elements || tpl.elements || tpl.fields || []).map((field: any) => ({
      id: field.name || field.id,
      label: field.display_name || field.name || field.id,
      type: field.type === "image" ? "image" : field.type === "number" ? "number" : "text",
      required: field.settings?.is_mandatory ?? field.required ?? false,
      attributeKey:
        field.attributes?.[0]?.id || (field.type === "image" ? "image_url" : "payload"),
    })),
    layouts: (tpl.details?.formats || tpl.formats || tpl.layouts || []).map((layout: any) => ({
      id: layout.id || layout.uid || layout.name || layout.format_id,
      name: layout.name || layout.id || "Layout",
      size:
        layout.size ||
        layout.dimensions ||
        (layout.width && layout.height ? `${layout.width}x${layout.height}` : ""),
    })),
    previewUrl: tpl.details?.formats?.[0]?.preview_url || tpl.preview_url,
    metadata: tpl.details,
  }));
};

export default function CampaignsPage() {
  const [projectTitle, setProjectTitle] = useState("");
  const [templates, setTemplates] = useState<TemplateOption[]>(mockTemplates);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(mockTemplates[0].id);
  const [selectedFields, setSelectedFields] = useState<string[]>(mockTemplates[0].fields.map((f) => f.id));
  const [selectedLayouts, setSelectedLayouts] = useState<string[]>(mockTemplates[0].layouts.map((l) => l.id));
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "builder">("list");
  const [editingCampaign, setEditingCampaign] = useState<CampaignRecord | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [manualDeals, setManualDeals] = useState<ManualDeal[]>([defaultDeal()]);
  const [csvEntries, setCsvEntries] = useState<CsvEntry[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [missingProducts, setMissingProducts] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"manual" | "csv">("manual");
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<ProductAttributeKey, string | null>>(createEmptyMapping());
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [pendingMapping, setPendingMapping] = useState<{ dealId: string; product: ProductSummary } | null>(null);
  const [mappingDraft, setMappingDraft] = useState<Record<ProductAttributeKey, string | null>>(createEmptyMapping());
  const [generationResults, setGenerationResults] = useState<
    { dealId: string; layout?: string | null; status: string; url?: string; data?: any }[]
  >([]);
  const [resultsDockOpen, setResultsDockOpen] = useState(true);
  const [activeResultIndex, setActiveResultIndex] = useState<number | null>(null);
  const [activeSearchDealId, setActiveSearchDealId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const template = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? templates[0],
    [selectedTemplateId, templates]
  );

  const templateMap = useMemo(() => {
    return templates.reduce<Record<string, TemplateOption>>((acc, tpl) => {
      acc[tpl.id] = tpl;
      return acc;
    }, {});
  }, [templates]);

  const selectedTemplateFields = useMemo(() => {
    if (!template) return [];
    return template.fields.filter((field) => selectedFields.includes(field.id));
  }, [template, selectedFields]);

  const selectedTemplatePreview = useMemo(() => {
    if (!template) return "";
    return (
      template.previewUrl ||
      template.metadata?.formats?.[0]?.preview_url ||
      (template as any)?.preview_url ||
      template.details?.preview_url ||
      ""
    );
  }, [template]);

  const applyTemplateDefaults = useCallback(
    (templateId?: string, fields?: string[], layouts?: string[], explicitTemplate?: TemplateOption) => {
      const tpl = explicitTemplate ?? templates.find((t) => t.id === templateId) ?? templates[0];
      if (!tpl) return;
      setSelectedTemplateId(tpl.id);
      setSelectedFields(fields ?? []);
      setSelectedLayouts(layouts ?? []);
    },
    [templates]
  );

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        (product.barcode ?? "").toLowerCase().includes(query) ||
        (product.supplier_name ?? "").toLowerCase().includes(query)
      );
    });
  }, [products, searchQuery]);

  const displayedProducts = useMemo(() => filteredProducts.slice(0, 24), [filteredProducts]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setToast({ type: "error", message: error.message });
    } else {
      setCampaigns(data ?? []);
    }
    setCampaignsLoading(false);
  }, []);

  useEffect(() => {
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      const { data, error } = await supabase.functions.invoke("abyssale-run", {
        body: { action: "templates" },
      });
      if (error || data?.error) {
        setTemplatesError(error?.message || data?.error || "לא ניתן למשוך תבניות מה-API");
        setTemplates(mockTemplates);
        setSelectedTemplateId(mockTemplates[0].id);
      } else {
        const remote = mapAbyssaleTemplates(data?.templates);
        if (remote.length) {
          setTemplates(remote);
          setSelectedTemplateId(remote[0].id);
          setSelectedFields(remote[0].fields.map((f) => f.id));
          setSelectedLayouts(remote[0].layouts.map((l) => l.id));
          setTemplatesError(null);
        } else {
          setTemplates(mockTemplates);
          setSelectedTemplateId(mockTemplates[0].id);
        }
      }
      setTemplatesLoading(false);
    };
    loadTemplates();
  }, []);

  useEffect(() => {
    refreshCampaigns();
  }, [refreshCampaigns]);

  useEffect(() => {
    const loadProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,barcode,description,image_url,suppliers(name)")
        .order("name", { ascending: true });
      const mapped =
        data?.map((item: any) => ({
          id: item.id,
          name: item.name,
          barcode: item.barcode,
          description: item.description,
          image_url: item.image_url,
          supplier_name: item.suppliers?.name ?? null,
        })) ?? [];
      setProducts(mapped);
    };
    loadProducts();
  }, []);

  useEffect(() => {
    setFieldMapping(createEmptyMapping());
    setMappingDraft(createEmptyMapping());
    setPendingMapping(null);
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!activeSearchDealId) {
      document.body.style.overflow = "";
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeSearchDealId]);

useEffect(() => {
  if (activeResultIndex === null) return;
  const previous = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = previous;
  };
}, [activeResultIndex]);

  const resetFormState = (templateOverride?: TemplateOption) => {
    setManualDeals([defaultDeal()]);
    setActiveTab("manual");
    setCsvEntries([]);
    setCsvErrors([]);
    setMissingProducts([]);
    setFieldMapping(createEmptyMapping());
    setMappingDraft(createEmptyMapping());
    setPendingMapping(null);
    if (templateOverride) {
      setSelectedFields([]);
      setSelectedLayouts([]);
    }
  };

  const handleStartNewCampaign = () => {
    setEditingCampaign(null);
    setProjectTitle("");
    const tpl = templates[0];
    if (tpl) {
      setSelectedTemplateId(tpl.id);
      setSelectedFields([]);
      setSelectedLayouts([]);
      resetFormState(tpl);
    }
    setViewMode("builder");
  };

  const handleEditCampaign = (campaign: CampaignRecord) => {
    setEditingCampaign(campaign);
    setProjectTitle(campaign.title);
    applyTemplateDefaults(campaign.template_id, campaign.selected_fields ?? [], campaign.selected_layouts ?? []);
    resetFormState();
    setViewMode("builder");
  };

  const handleCancelBuilder = () => {
    resetFormState();
    setEditingCampaign(null);
    setViewMode("list");
  };

  const handleSaveCampaignMeta = async () => {
    if (!projectTitle.trim()) {
      showToast("error", "הכנס כותרת לקמפיין");
      return;
    }
    if (!selectedTemplateId) {
      showToast("error", "בחר תבנית להפצה");
      return;
    }
    const payload = {
      title: projectTitle.trim(),
      template_id: selectedTemplateId,
      selected_fields: selectedFields,
      selected_layouts: selectedLayouts,
    };
    if (editingCampaign) {
      const { error } = await supabase.from("campaigns").update(payload).eq("id", editingCampaign.id);
      if (error) {
        showToast("error", error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from("campaigns").insert(payload).select().single();
      if (error) {
        showToast("error", error.message);
        return;
      }
      setEditingCampaign(data as CampaignRecord);
    }
    await refreshCampaigns();
    showToast("success", "הקמפיין נשמר");
  };

  const updateDealBarcode = (dealId: string, value: string) => {
    setManualDeals((prev) => prev.map((deal) => (deal.id === dealId ? { ...deal, barcode: value } : deal)));
  };

  const openSearchOverlay = (dealId: string) => {
    const deal = manualDeals.find((item) => item.id === dealId);
    setActiveSearchDealId(dealId);
    setSearchQuery(deal?.productLabel || deal?.productSearch || "");
  };

  const closeSearchOverlay = () => {
    setActiveSearchDealId(null);
    setSearchQuery("");
  };

  const applyMappingToDeal = (dealId: string, product: ProductSummary, mapping: Record<ProductAttributeKey, string | null>) => {
    setManualDeals((prev) =>
      prev.map((deal) => {
        if (deal.id !== dealId) return deal;
        const updatedFields = { ...deal.customFields };
        (Object.entries(mapping) as [ProductAttributeKey, string | null][]).forEach(([productKey, fieldId]) => {
          if (!fieldId) return;
          const value = getProductAttributeValue(productKey, product);
          if (value) {
            updatedFields[fieldId] = value;
          }
        });
        return { ...deal, customFields: updatedFields };
      })
    );
  };

  const handleSelectProduct = (dealId: string, product: ProductSummary) => {
    setManualDeals((prev) =>
      prev.map((deal) =>
        deal.id === dealId
          ? {
              ...deal,
              productId: product.id,
              productLabel: product.name,
              productSearch: product.name,
              barcode: product.barcode ?? "",
            }
          : deal
      )
    );
    const hasMapping = Object.values(fieldMapping).some(Boolean);
    if (hasMapping) {
      applyMappingToDeal(dealId, product, fieldMapping);
    } else {
      setPendingMapping({ dealId, product });
      setMappingDraft(fieldMapping);
      setMappingModalOpen(true);
    }
    closeSearchOverlay();
  };

  const handleProductSelectFromOverlay = (product: ProductSummary) => {
    if (!activeSearchDealId) return;
    handleSelectProduct(activeSearchDealId, product);
  };

  const handleDownloadImage = async (url?: string, name?: string) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const extension = blob.type.split("/")[1] || "png";
      const fileName = name || `result-${Date.now()}.${extension}`;
      saveAs(blob, fileName);
    } catch {
      showToast("error", "הורדת התמונה נכשלה");
    }
  };

  const handleDownloadZip = async () => {
    if (!generationResults.length) return;
    const entries = generationResults
      .filter((result) => result.status === "success" && result.url)
      .map((result, index) => ({
        url: result.url,
        fileName: `result-${index + 1}-${result.layout || "default"}.png`,
      }));
    if (!entries.length) {
      showToast("error", "אין תמונות זמינות להורדה");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("results-zip", {
        body: {
          entries,
          fileName: `campaign-results-${Date.now()}.zip`,
        },
      });
      if (error || data?.error || !data?.zipBase64) {
        throw new Error(error?.message || data?.error || "zip generation failed");
      }
      const blob = base64ToBlob(data.zipBase64, "application/zip");
      saveAs(blob, data.fileName || `campaign-results-${Date.now()}.zip`);
    } catch (err) {
      console.error(err);
      showToast("error", "אריזת ה-ZIP נכשלה");
    }
  };

  const openResultViewer = (index: number) => {
    setActiveResultIndex(index);
  };

  const closeResultViewer = () => setActiveResultIndex(null);

  const goToPreviousResult = () => {
    setActiveResultIndex((prev) => {
      if (prev === null) return prev;
      return prev === 0 ? generationResults.length - 1 : prev - 1;
    });
  };

  const goToNextResult = () => {
    setActiveResultIndex((prev) => {
      if (prev === null) return prev;
      return prev === generationResults.length - 1 ? 0 : prev + 1;
    });
  };

  const handleConfirmMapping = () => {
    if (pendingMapping) {
      setFieldMapping(mappingDraft);
      applyMappingToDeal(pendingMapping.dealId, pendingMapping.product, mappingDraft);
    } else {
      setFieldMapping(mappingDraft);
    }
    setMappingModalOpen(false);
    setPendingMapping(null);
  };

  const handleCloseMapping = () => {
    setMappingModalOpen(false);
    setPendingMapping(null);
    setMappingDraft(fieldMapping);
  };

  const openMappingManager = () => {
    setMappingDraft(fieldMapping);
    setPendingMapping(null);
    setMappingModalOpen(true);
  };

  const formatCampaignDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString("he-IL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ready":
        return "מוכן";
      case "running":
        return "בתהליך";
      case "draft":
      default:
        return "טיוטה";
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case "ready":
        return "badge-primary";
      case "running":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-slate-100 text-slate-500";
    }
  };

  const handleCopyResultLink = async (url?: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast("success", "הקישור הועתק");
    } catch (err) {
      showToast("error", "נכשל בהעתקת הקישור");
    }
  };

  const renderFieldInput = (field: TemplateField, deal: ManualDeal) => {
    const value = fieldValueFromDeal(field.id, deal);
    if (field.type === "image") {
      return (
        <div key={`${deal.id}-${field.id}`} className="sm:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500">{field.label}</p>
          <div className="mt-2 flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-100">
              {value ? (
                <img src={value} alt={field.label} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
            </div>
            <input
              type="text"
              className="input-control"
              placeholder={`קישור עבור ${field.label}`}
              value={value}
              onChange={(e) => updateCustomField(deal.id, field.id, e.target.value)}
            />
          </div>
        </div>
      );
    }
    return (
      <div key={`${deal.id}-${field.id}`} className="input-group min-h-[56px]">
        <span className="input-icon">{field.type === "number" ? <Hash className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span>
        <input
          type={field.type === "number" ? "number" : "text"}
          className="input-control"
          placeholder={field.label}
          value={value}
          onChange={(e) => updateCustomField(deal.id, field.id, e.target.value)}
        />
      </div>
    );
  };

  const updateCustomField = (dealId: string, fieldId: string, value: string) => {
    setManualDeals((prev) =>
      prev.map((deal) =>
        deal.id === dealId
          ? {
              ...deal,
              customFields: {
                ...deal.customFields,
                [fieldId]: value,
              },
            }
          : deal
      )
    );
  };

  const handleAddDeal = () => {
    setManualDeals((prev) => [...prev, defaultDeal()]);
  };

  const handleRemoveDeal = (dealId: string) => {
    setManualDeals((prev) => prev.filter((deal) => deal.id !== dealId));
  };

  const handleCsvUpload = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length) {
          setCsvErrors(results.errors.map((e) => e.message));
        } else {
          setCsvErrors([]);
        }
        const rows = (results.data as Papa.ParseResult<Record<string, string>>["data"]).map((row, idx) => {
            const barcode = row["barcode"]?.trim();
            const product = products.find((p) => p.barcode === barcode);
            return {
              rowNumber: idx + 2,
              data: row,
              productFound: Boolean(product),
              productId: product?.id,
              missingReason: product ? undefined : "מוצר לא קיים בספרייה",
          } as CsvEntry;
        });
        setCsvEntries(rows);
        setMissingProducts(rows.filter((r) => !r.productFound).map((r) => r.data["barcode"] ?? ""));
      },
    });
  };

const buildOverrideValue = (fieldId: string, value: string, template?: TemplateOption) => {
  if (!value) return null;
  const field = template?.fields.find((f) => f.id === fieldId);
  const attributeKey = field?.attributeKey || (field?.type === "image" ? "image_url" : "payload");
  if (!attributeKey) return null;
  return { [attributeKey]: value };
};

const ResultViewerOverlay = ({
  results,
  index,
  onClose,
  onPrev,
  onNext,
  onDownload,
}: {
  results: { dealId: string; layout?: string | null; url?: string; status: string }[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDownload: () => void;
}) => {
  const result = results[index];
  if (!result) return null;
  const isSuccess = result.status === "success" && result.url;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur">
      <div className="absolute inset-0 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 text-white">
          <div>
            <p className="text-lg font-semibold">
              {result.layout || "ברירת מחדל"} • מוצר {result.dealId}
            </p>
            <p className="text-sm text-slate-300">
              {index + 1}/{results.length}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isSuccess && (
              <>
                <a
                  className="flex items-center gap-1 rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-900 shadow hover:bg-emerald-300"
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  פתח בלשונית <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  className="flex items-center gap-1 rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-900 shadow hover:bg-emerald-300"
                  onClick={onDownload}
                >
                  הורד <Download className="mr-1 inline h-3 w-3" />
                </button>
              </>
            )}
            <button className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={onClose}>
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-10">
          {isSuccess ? (
            <img
              src={result.url}
              alt="result"
              className="max-h-[75vh] max-w-[85vw] rounded-3xl object-contain shadow-2xl"
            />
          ) : (
            <div className="text-white">לא ניתן להציג את התמונה</div>
          )}
        </div>
        <div className="absolute inset-y-1/2 left-8 flex items-center">
          <button
            className="rounded-full bg-emerald-400 p-3 text-slate-900 shadow hover:bg-emerald-300"
            onClick={onPrev}
          >
            <ChevronDown className="rotate-90 transform" />
          </button>
        </div>
        <div className="absolute inset-y-1/2 right-8 flex items-center">
          <button
            className="rounded-full bg-emerald-400 p-3 text-slate-900 shadow hover:bg-emerald-300"
            onClick={onNext}
          >
            <ChevronDown className="-rotate-90 transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

const manualDealsPayload = manualDeals.map((deal) => ({
  id: deal.id,
  overrides: selectedFields.reduce((acc, fieldId) => {
    const value = fieldValueFromDeal(fieldId, deal);
    const overrideValue = buildOverrideValue(fieldId, value, template);
    if (overrideValue) acc[fieldId] = overrideValue;
    return acc;
  }, {} as Record<string, Record<string, string>>),
}));

  const csvDealsPayload = csvEntries
    .filter((entry) => entry.productFound)
    .map((entry) => ({
      id: `csv-${entry.rowNumber}`,
      overrides: selectedFields.reduce((acc, fieldId) => {
        const value =
          entry.data[fieldId] ?? entry.data[fieldId.toUpperCase()] ?? entry.data[fieldId.toLowerCase()] ?? "";
        const overrideValue = buildOverrideValue(fieldId, value, template);
        if (overrideValue) acc[fieldId] = overrideValue;
        return acc;
      }, {} as Record<string, Record<string, string>>),
    }));

  const canGenerateManual = manualDealsPayload.some((deal) =>
    template.fields
      .filter((field) => field.required)
      .every((field) => Boolean(deal.overrides[field.id]))
  );
  const canGenerateCsv = csvDealsPayload.length > 0 && missingProducts.length === 0;
  const canGenerate = activeTab === "manual" ? canGenerateManual : canGenerateCsv;

  const handleGenerateCampaign = async () => {
    if (!canGenerate) {
      showToast("error", "השלם את הנתונים לפני ההפקה");
      return;
    }
    const deals = activeTab === "manual" ? manualDealsPayload : csvDealsPayload;
    setGenerating(true);
    setGenerationResults([]);
    const { data, error } = await supabase.functions.invoke("abyssale-run", {
      body: {
        action: "generate",
        templateId: selectedTemplateId,
        layouts: selectedLayouts,
        deals,
      },
    });
    setGenerating(false);
    if (error || data?.error) {
      showToast("error", error?.message || data?.error || "הפקת התמונות נכשלה");
    } else {
      const successCount = data?.results?.filter((r: any) => r.status === "success").length ?? 0;
      const failCount = data?.results?.filter((r: any) => r.status === "error").length ?? 0;
      const normalizedResults =
        (data?.results ?? []).map((entry: any) => ({
          dealId: entry.dealId,
          layout: entry.layout,
          status: entry.status,
          url: extractResultUrl(entry.data),
          data: entry.data,
        })) ?? [];
      setGenerationResults(normalizedResults);
      if (normalizedResults.length) {
        setResultsDockOpen(true);
      }
      if (failCount) {
        showToast("error", `חלק מהבקשות נכשלו (${failCount}). בדוק את ההגדרות ונסה שוב.`);
      } else {
        showToast("success", `הפקה הושלמה בהצלחה (${successCount})`);
      }
    }
  };

  const listView = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="pill badge-primary text-xs">קמפיינים</p>
          <h1 className="heading-md mt-2">מרכז הקמפיינים</h1>
          <p className="body-text">נהל את כל הפרויקטים שלך, ערוך אותם או התחל קמפיין חדש בלחיצה אחת.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={handleStartNewCampaign}>
          <Plus className="h-4 w-4" /> קמפיין חדש
        </button>
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
        {campaignsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="animate-pulse rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="h-4 w-28 rounded bg-slate-200"></div>
                <div className="mt-2 h-6 w-40 rounded bg-slate-200"></div>
                <div className="mt-4 h-36 rounded-2xl bg-slate-100"></div>
              </div>
            ))}
          </div>
        ) : campaigns.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => {
              const templateInfo = templateMap[campaign.template_id];
              const preview =
                templateInfo?.previewUrl ??
                templateInfo?.metadata?.formats?.[0]?.preview_url ??
                (templateInfo as any)?.preview_url ??
                "";
              return (
                <div key={campaign.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase text-slate-400">{templateInfo?.name ?? "תבנית לא זמינה"}</p>
                      <h3 className="text-lg font-semibold text-slate-800">{campaign.title}</h3>
                      <p className="text-xs text-slate-400">נוצר ב-{formatCampaignDate(campaign.created_at)}</p>
                    </div>
                    <span className={`pill ${getStatusBadgeClasses(campaign.status)}`}>{getStatusLabel(campaign.status)}</span>
                  </div>
                  {preview && (
                    <img src={preview} alt={campaign.title} className="mt-3 h-40 w-full rounded-2xl object-cover" />
                  )}
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <LayoutGrid className="h-4 w-4" /> {campaign.selected_layouts?.length ?? 0} פריסות
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="h-4 w-4" /> {campaign.selected_fields?.length ?? 0} שדות
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="btn-secondary flex-1" onClick={() => handleEditCampaign(campaign)}>
                      עריכת קמפיין
                    </button>
                    <button
                      className="btn-ghost flex-1"
                      onClick={() => {
                        handleEditCampaign(campaign);
                        setActiveTab("manual");
                      }}
                    >
                      המשך יצירה
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 p-8 text-center">
            <h3 className="text-lg font-semibold text-slate-700">עדיין אין קמפיינים</h3>
            <p className="mt-2 text-sm text-slate-500">לחץ על "קמפיין חדש" כדי להתחיל פרויקט ראשון.</p>
          </div>
        )}
      </section>

    </>
  );

  const builderView = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="pill badge-primary text-xs">{editingCampaign ? "עריכת קמפיין" : "קמפיין חדש"}</p>
          <h1 className="heading-md mt-2">יצירת מבצעים המונית</h1>
          <p className="body-text">בחר תבנית, קבע שדות, והעלה מוצרים ידנית או באמצעות CSV.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={handleCancelBuilder}>
            חזרה לרשימת הקמפיינים
          </button>
          {generationResults.length > 0 && (
            <button className="btn-ghost" onClick={() => setResultsDockOpen((prev) => !prev)}>
              {resultsDockOpen ? "מזער גלריה" : "הצג גלריה"}
            </button>
          )}
          <button className="btn-primary" onClick={handleSaveCampaignMeta}>
            {editingCampaign ? "שמור שינויים" : "שמור קמפיין"}
        </button>
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

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">שם הקמפיין</p>
            <p className="text-xs text-slate-500">בחר כותרת שתופיע ברשימת הקמפיינים ותעזור להתמצא.</p>
            <div className="input-group mt-3">
            <span className="input-icon">
              <PenSquare className="h-4 w-4" />
            </span>
            <input
              placeholder="כותרת לפרויקט"
              className="input-control"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
          </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">
              <div>
                <p className="text-[10px] uppercase text-slate-400">שדות נבחרים</p>
                <p className="text-base font-semibold text-slate-800">{selectedFields.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400">פריסות נבחרות</p>
                <p className="text-base font-semibold text-slate-800">{selectedLayouts.length}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">בחר תבנית</p>
                <p className="text-xs text-slate-500">תצוגות מקדימות קטנות שמרגישות כמו ממשק.</p>
              </div>
              {templatesLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> טוען...
                </div>
              )}
            </div>
            {templatesError && (
              <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs text-amber-700">{templatesError}</div>
            )}
            <div className="mt-4 max-h-[520px] space-y-3 overflow-auto pr-1">
              {templates.map((tpl) => {
                const active = tpl.id === selectedTemplateId;
                const preview =
                  tpl.previewUrl ||
                  tpl.metadata?.formats?.[0]?.preview_url ||
                  (tpl as any)?.preview_url ||
                  tpl.details?.preview_url;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-2 text-right transition ${
                      active ? "border-[var(--color-primary)] shadow-md" : "border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => {
                      applyTemplateDefaults(tpl.id, [], [], tpl);
                      resetFormState(tpl);
                    }}
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {preview ? (
                        <img src={preview} alt={tpl.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[11px] text-slate-400">אין תצוגה</div>
                      )}
          </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">{tpl.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {tpl.layouts?.length ?? tpl.details?.formats?.length ?? 0} פורמטים • {
                          tpl.fields?.length ?? tpl.details?.elements?.length ?? 0
                        } שדות
                      </p>
                    </div>
                    {active && <CheckCircle2 className="h-4 w-4 text-[var(--color-primary)]" />}
                  </button>
                );
              })}
              {!templates.length && !templatesLoading && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                  לא נמצאו תבניות להצגה.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-700">תצוגה מקדימה</p>
                <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-white">
                    {selectedTemplatePreview ? (
                      <img src={selectedTemplatePreview} alt={template.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">אין תצוגה זמינה</div>
                    )}
                  </div>
                  <div className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-500 shadow-inner">
                    <p>שם התבנית: {template.name}</p>
                    <p>מספר פריסות: {template.layouts.length}</p>
                    <p>מספר שדות: {template.fields.length}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">שדות דינמיים</p>
                      <p className="text-xs text-slate-500">בחר אילו שדות תרצה לעדכן.</p>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost text-xs text-slate-500"
                      onClick={openMappingManager}
                      disabled={!selectedTemplateFields.length}
                    >
                      ניהול שיוכים
                    </button>
                  </div>
                  <div className="mt-3 flex max-h-[220px] flex-wrap gap-2 overflow-auto pr-1">
              {template.fields.map((field) => {
                const active = selectedFields.includes(field.id);
                return (
                  <button
                    key={field.id}
                          className={`pill text-xs ${active ? "badge-primary" : "bg-slate-100 text-slate-500"}`}
                    onClick={() =>
                      setSelectedFields((prev) =>
                        active ? prev.filter((id) => id !== field.id) : [...prev, field.id]
                      )
                    }
                  >
                    {field.label}
                  </button>
                );
              })}
                    {!template.fields.length && <span className="text-xs text-slate-400">אין שדות זמינים</span>}
            </div>
          </div>

                <div className="rounded-2xl border border-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-700">פריסות להפקה</p>
                  <p className="text-xs text-sלקate-500">בחר את הפרופורציות להפקה.</p>
                  <div className="mt-3 space-y-3">
                    {template.layouts.map((layout) => {
                      const active = selectedLayouts.includes(layout.id);
                      const { width, height } = getLayoutPreviewDimensions(layout.size);
                      return (
                        <label
                          key={layout.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${
                            active ? "border-[var(--color-primary)] bg-emerald-50/40" : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                  <input
                    type="checkbox"
                            className="sr-only"
                            checked={active}
                    onChange={(e) =>
                      setSelectedLayouts((prev) =>
                        e.target.checked ? [...prev, layout.id] : prev.filter((id) => id !== layout.id)
                      )
                    }
                  />
                          <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-3">
                            <div className="rounded border border-slate-400" style={{ width, height }}></div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-sלקate-700">{layout.name}</p>
                            <p className="text-xs text-sלקate-500">{layout.size || "—"}</p>
                          </div>
                </label>
                      );
                    })}
                    {!template.layouts.length && (
                      <div className="rounded-2xl border border-dashed border-sלקate-200 p-3 text-xs text-sלקate-500">
                        אין פריסות זמינות לתבנית זו.
                      </div>
                    )}
                  </div>
            </div>
          </div>
        </div>
      </section>
        </div>
      </div>


      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 pb-3 text-sm">
          <button
            className={`btn-ghost ${activeTab === "manual" ? "text-[var(--color-primary)]" : "text-slate-500"}`}
            onClick={() => setActiveTab("manual")}
          >
            הזנת מוצרים ידנית
          </button>
          <button
            className={`btn-ghost ${activeTab === "csv" ? "text-[var(--color-primary)]" : "text-slate-500"}`}
            onClick={() => setActiveTab("csv")}
          >
            טעינת CSV
          </button>
        </div>

        {activeTab === "manual" ? (
          <div className="mt-4 space-y-4">
            {manualDeals.map((deal, index) => {
              return (
                <div key={deal.id} className="relative rounded-3xl border border-slate-100 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                  <div className="text-sm font-semibold text-slate-700">מוצר #{index + 1}</div>
                      {deal.productLabel && (
                        <p className="text-xs text-slate-500">נבחר: {deal.productLabel}</p>
                      )}
                    </div>
                  {manualDeals.length > 1 && (
                    <button className="btn-ghost text-red-500" onClick={() => handleRemoveDeal(deal.id)}>
                      <Trash2 className="h-4 w-4" /> הסר
                    </button>
                  )}
                </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)]">
                  <div>
                    <label className="text-xs text-slate-500">בחר מוצר מהספרייה</label>
                      <button
                        type="button"
                        className={`input-control mt-1 flex items-center justify-between gap-3 text-right ${
                          deal.productLabel ? "text-slate-800" : "text-slate-400"
                        }`}
                        onClick={() => openSearchOverlay(deal.id)}
                      >
                        <span className="truncate">{deal.productLabel || "לחץ כדי לחפש מוצר"}</span>
                        <Search className="h-4 w-4 text-slate-400" />
                      </button>
                      {deal.productLabel && (
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {deal.barcode && (
                            <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">
                              {deal.barcode}
                            </span>
                          )}
                          {deal.productId && (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">מוצר מקושר</span>
                          )}
                  </div>
                      )}
                    </div>
                    <div className="input-group md:mt-0">
                    <span className="input-icon">
                      <Barcode className="h-4 w-4" />
                    </span>
                    <input
                      placeholder="ברקוד"
                      className="input-control"
                      value={deal.barcode}
                        onChange={(e) => updateDealBarcode(deal.id, e.target.value)}
                    />
                  </div>
                </div>

                      {selectedTemplateFields.length > 0 ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {selectedTemplateFields.map((field) => renderFieldInput(field, deal))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      בחר שדות דינמיים כדי להתחיל להזין ערכים עבור המוצרים.
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-end">
              <button className="btn-secondary flex items-center gap-2" onClick={handleAddDeal}>
                <Plus className="h-4 w-4" /> הוסף שורה חדשה
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-dashed border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-700">העלה קובץ CSV</p>
              <p className="text-xs text-slate-500">וודא שהקובץ מכיל עמודת barcode ושאר השדות שנבחרו.</p>
              <label className="mt-3 flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed">
                <UploadCloud className="h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm text-slate-600">גרור או לחץ כדי לבחור קובץ</p>
                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleCsvUpload(e.target.files)} />
              </label>
              {csvErrors.length > 0 && (
                <div className="mt-3 rounded-2xl bg-red-50 p-3 text-xs text-red-600">
                  {csvErrors.map((err) => (
                    <p key={err}>{err}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {missingProducts.length > 0 && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
                  <p className="font-semibold">
                    <AlertTriangle className="mr-2 inline-block h-4 w-4" /> נמצאו מוצרים חסרים
                  </p>
                  <p className="text-xs text-amber-600">
                    העלה את המוצרים הבאים לספרייה ואז לחץ שוב על בדיקה: {missingProducts.join(", ")}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                  <FileSpreadsheet className="h-4 w-4" /> רשומות מהקובץ
                </div>
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2">שורה</th>
                        <th className="px-3 py-2">ברקוד</th>
                        <th className="px-3 py-2">סטטוס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvEntries.map((entry) => (
                        <tr key={entry.rowNumber} className="border-b border-slate-50">
                          <td className="px-3 py-2">{entry.rowNumber}</td>
                          <td className="px-3 py-2">{entry.data["barcode"]}</td>
                          <td className="px-3 py-2">
                            {entry.productFound ? (
                              <span className="text-emerald-600">
                                <CheckCircle2 className="mr-1 inline h-4 w-4" /> נמצא
                    </span>
                            ) : (
                              <span className="text-amber-600">
                                <AlertTriangle className="mr-1 inline h-4 w-4" /> {entry.missingReason}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!csvEntries.length && (
                        <tr>
                          <td className="px-3 py-6 text-center text-slate-400" colSpan={3}>
                            טרם נטען קובץ.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );

  const mainPaddingBottom =
    generationResults.length > 0 ? (resultsDockOpen ? "40vh" : "140px") : "56px";
  const stickyButtonBottom =
    generationResults.length > 0 ? (resultsDockOpen ? "calc(30vh + 24px)" : "96px") : "24px";

  return (
    <div className="relative">
      <div
        className={`flex flex-col gap-6 transition duration-200 ${activeSearchDealId ? "blur-sm" : ""}`}
        style={{ paddingBottom: mainPaddingBottom }}
      >
        {viewMode === "list" ? listView : builderView}
      </div>

      {viewMode === "builder" && (
        <div className="pointer-events-none fixed right-6 z-40" style={{ bottom: stickyButtonBottom }}>
          <button
            className="pointer-events-auto rounded-full bg-[var(--color-primary)] px-8 py-4 text-base font-semibold text-white shadow-xl"
            onClick={handleGenerateCampaign}
            disabled={!canGenerate || generating}
          >
            {generating ? <Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> : "צור תמונות"}
          </button>
        </div>
      )}

      {activeSearchDealId && (
        <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-lg">
          <div className="mx-auto flex h-full max-w-5xl flex-col gap-8 px-4 py-12">
            <div className="flex items-center gap-4">
              <div className="flex-1 rounded-[32px] border-2 border-slate-300 bg-white shadow-sm">
                    <input
                  autoFocus
                  className="w-full rounded-[32px] border-none bg-transparent px-6 py-5 text-3xl focus:outline-none"
                  placeholder="הקלד שם מוצר, ספק או ברקוד..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="btn-ghost text-slate-600" onClick={closeSearchOverlay}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {displayedProducts.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {displayedProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="flex gap-4 rounded-3xl border border-slate-100 bg-white p-4 text-right shadow-sm transition hover:border-[var(--color-primary)]"
                      onClick={() => handleProductSelectFromOverlay(product)}
                    >
                      <div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-400">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-base font-semibold text-slate-800">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.supplier_name || "ללא ספק"}</p>
                        <span className="text-xs font-mono text-slate-500">{product.barcode || "ללא ברקוד"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  לא נמצאו מוצרים תואמים
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {generationResults.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur"
          style={{ height: resultsDockOpen ? "30vh" : "88px" }}
        >
          <div className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">תמונות שנוצרו</p>
              <p className="text-xs text-slate-500">
                {generationResults.length} תוצאות • גלול כדי לראות הכל
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost text-xs text-slate-500" onClick={() => setGenerationResults([])}>
                נקה תוצאות
              </button>
              <button className="btn-primary flex items-center gap-2 text-xs" onClick={handleDownloadZip}>
                הורד ZIP <Download className="h-3 w-3" />
              </button>
              <button className="btn-secondary" onClick={() => setResultsDockOpen((prev) => !prev)}>
                {resultsDockOpen ? (
                  <>
                    מזער <ChevronDown className="mr-1 inline h-4 w-4" />
                  </>
                ) : (
                  <>
                    פתח <ChevronUp className="mr-1 inline h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
          {resultsDockOpen && (
            <div className="flex h-[calc(30vh-80px)] gap-4 overflow-x-auto px-5 pb-5">
              {generationResults.map((result, idx) => {
                const isSuccess = result.status === "success" && result.url;
                return (
                  <div
                    key={`${result.dealId}-${result.layout ?? "default"}-${idx}`}
                    className="min-w-[220px] rounded-3xl border border-slate-100 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600">{result.layout || "ברירת מחדל"}</span>
                      <span className={`pill text-[11px] ${isSuccess ? "badge-primary" : "bg-red-100 text-red-700"}`}>
                        {isSuccess ? "הצלחה" : "שגיאה"}
                      </span>
                    </div>
                    <div className="mt-2 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                      {isSuccess ? (
                        <button onClick={() => openResultViewer(idx)}>
                          <img src={result.url} alt="תוצאה" className="h-32 w-full object-cover transition hover:opacity-80" />
                        </button>
                      ) : (
                        <div className="flex h-32 items-center justify-center text-slate-400">
                          <AlertTriangle className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    {result.status !== "success" && (
                      <p className="mt-2 text-[11px] text-red-600">{result.data?.message || "נכשלה וריאציה זו"}</p>
                    )}
                    {isSuccess && (
                      <div className="mt-2 flex flex-col gap-1 text-xs">
                        <a className="btn-secondary text-center" href={result.url} target="_blank" rel="noreferrer">
                          פתח
                        </a>
                        <div className="flex gap-1">
                          <button className="btn-ghost flex-1" onClick={() => handleCopyResultLink(result.url)}>
                            העתק
                          </button>
                          <button className="btn-ghost flex-1" onClick={() => handleDownloadImage(result.url, `result-${idx + 1}.png`)}>
                            הורד
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={mappingModalOpen} onClose={handleCloseMapping} title="שיוך נתוני מוצר לשדות">
        <p className="text-sm text-slate-600">בחר לאילו שדות בתבנית ימופו נתוני המוצר (שם, תיאור, תמונה וכו').</p>
        <div className="mt-4 space-y-3">
          {PRODUCT_ATTRIBUTES.map((attr) => (
            <div key={attr.key}>
              <label className="text-xs text-slate-500">{attr.label}</label>
              <select
                className="input-control mt-1"
                value={mappingDraft[attr.key] ?? ""}
                onChange={(e) =>
                  setMappingDraft((prev) => ({
                    ...prev,
                    [attr.key]: e.target.value || null,
                  }))
                }
              >
                <option value="">לא להשתמש</option>
                {selectedTemplateFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </select>
              {pendingMapping?.product && (
                <p className="mt-1 text-xs text-slate-400">
                  ערך לדוגמה: {getProductAttributeValue(attr.key, pendingMapping.product) || "—"}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button className="btn-ghost" onClick={handleCloseMapping}>
            ביטול
          </button>
          <button className="btn-primary" onClick={handleConfirmMapping}>
            שמור שיוך
          </button>
        </div>
      </Modal>

      {activeResultIndex !== null && generationResults[activeResultIndex] && (
        <ResultViewerOverlay
          results={generationResults}
          index={activeResultIndex}
          onClose={closeResultViewer}
          onPrev={goToPreviousResult}
          onNext={goToNextResult}
          onDownload={() =>
            handleDownloadImage(
              generationResults[activeResultIndex]?.url,
              `result-${activeResultIndex + 1}-${generationResults[activeResultIndex]?.layout || "default"}.png`
            )
          }
        />
      )}
    </div>
  );
}
