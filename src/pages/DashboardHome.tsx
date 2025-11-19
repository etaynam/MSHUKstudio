import { motion } from "framer-motion";
import { useOutletContext } from "react-router-dom";

interface DashboardOutletContext {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export default function DashboardHome() {
  const { sidebarOpen, toggleSidebar } = useOutletContext<DashboardOutletContext>();

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="pill badge-primary text-xs">מערכת פנימית</p>
          <h1 className="heading-md mt-2">ברוך הבא לדשבורד</h1>
          <p className="body-text">כאן תוכל לנהל טמפלטים, משתמשים, ולבנות גרפיקות בקלות.</p>
        </div>
        <button className="btn-secondary" onClick={toggleSidebar}>
          {sidebarOpen ? "כווץ תפריט" : "פתח תפריט"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          "קמפיינים חיים",
          "משתמשים פעילים",
          "גרפיקות שנוצרו היום",
          "בקשות בהמתנה",
        ].map((title, index) => (
          <motion.div
            key={title}
            layout
            className="surface-card flex flex-col gap-2"
            transition={{ delay: index * 0.05 }}
          >
            <span className="text-sm text-slate-500">{title}</span>
            <strong className="text-3xl">{Math.round(Math.random() * 100)}</strong>
            <span className="text-xs text-slate-400">עודכן לפני כמה שניות</span>
          </motion.div>
        ))}
      </div>

      <div className="surface-muted border border-slate-100">
        <h2 className="heading-md mb-4">צי״ח מהיר</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">כרטיס {idx + 1}</h3>
              <p className="text-sm text-slate-500">
                תיאור קצר של תהליך / מצב. אפשר להחליף בגרפים אמתיים בהמשך.
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
