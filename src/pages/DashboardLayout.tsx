import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Sidebar, SidebarBody, SidebarLink, SidebarLinkItem } from "../components/ui/sidebar";
import { LayoutDashboard, Settings, LogOut, BarChart3, Users, Images, Building2, Wand2 } from "lucide-react";
import { motion } from "framer-motion";

const links: SidebarLinkItem[] = [
  {
    label: "ראשי",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5 text-slate-700" />,
  },
  {
    label: "ספריית מדיה",
    href: "/dashboard/library",
    icon: <Images className="h-5 w-5 text-slate-700" />,
  },
  {
    label: "ספקים",
    href: "/dashboard/suppliers",
    icon: <Building2 className="h-5 w-5 text-slate-700" />,
  },
  {
    label: "סטודיו AI",
    href: "/dashboard/ai-studio",
    icon: <Wand2 className="h-5 w-5 text-slate-700" />,
  },
  {
    label: "קמפיינים",
    href: "/dashboard/campaigns",
    icon: <BarChart3 className="h-5 w-5 text-slate-700" />,
  },
  {
    label: "משתמשים",
    href: "/dashboard/users",
    icon: <Users className="h-5 w-5 text-slate-700" />,
  },
  {
    label: "הגדרות",
    href: "/dashboard/settings",
    icon: <Settings className="h-5 w-5 text-slate-700" />,
  },
  {
    label: "התנתקות",
    href: "/logout",
    icon: <LogOut className="h-5 w-5 text-slate-700" />,
  },
];

export default function DashboardLayout() {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10 bg-slate-100">
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="mt-2">
              {open ? <BrandLogo /> : <BrandMark />}
            </div>
            <div className="mt-8 flex flex-col gap-1">
              {links.map((link) => (
                <SidebarLink key={link.label} link={link} />
              ))}
            </div>
          </div>
          <div className="border-t border-slate-200 pt-4">
            <SidebarLink
              link={{
                label: "איתיי נעמן",
                href: "/dashboard/profile",
                icon: (
                  <img
                    src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=200&q=80"
                alt="avatar"
                className="h-10 w-10 rounded-full object-cover"
                  />
                ),
            variant: "avatar",
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>

      <div className="flex flex-1 flex-col p-4 md:p-10 overflow-y-auto">
        <Outlet context={{ toggleSidebar: () => setOpen((prev) => !prev), sidebarOpen: open }} />
      </div>
    </div>
  );
}

function BrandLogo() {
  return (
    <Link
      to="/dashboard"
      className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm"
    >
      <div className="h-11 w-11 rounded-2xl bg-[var(--color-primary)]" />
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-semibold">
        MarketingMSHUK
      </motion.span>
    </Link>
  );
}

function BrandMark() {
  return (
    <Link
      to="/dashboard"
      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm"
    >
      <div className="h-8 w-8 rounded-full bg-[var(--color-primary)]" />
    </Link>
  );
}
