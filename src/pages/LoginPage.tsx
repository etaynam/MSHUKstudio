import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm, { LoginFormValues } from "../components/ui/login-form";
import { supabase } from "../lib/supabaseClient";
import { cn } from "../lib/utils";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80";

type StatusState = {
  type: "idle" | "error" | "success";
  message?: string;
};

export default function LoginPage() {
  const [status, setStatus] = useState<StatusState>({ type: "idle" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (status.type === "success") {
      const timer = setTimeout(() => navigate("/dashboard"), 800);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  const handleLogin = async ({ email, password }: LoginFormValues) => {
    setStatus({ type: "idle" });
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      setStatus({
        type: "error",
        message: translateAuthError(error?.message ?? "שגיאה לא ידועה"),
      });
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      setStatus({
        type: "error",
        message: "ההתחברות הצליחה, אבל לא הצלחנו לטעון את פרטי המשתמש.",
      });
      setLoading(false);
      return;
    }

    const roleLabel =
      profile?.role === "admin"
        ? "מנהל מערכת"
        : profile?.role === "member"
        ? "משתמש"
        : profile?.role;

    setStatus({
      type: "success",
      message: `התחברת בהצלחה${roleLabel ? ` (${roleLabel})` : ""}`,
    });
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col md:flex-row">
      {status.type !== "idle" && status.message && (
        <div
          className={cn(
            "toast-banner",
            status.type === "error" ? "toast-banner--error" : "toast-banner--success"
          )}
        >
          {status.message}
        </div>
      )}
      <div className="hidden w-full overflow-hidden md:block md:basis-[65%]">
        <img
          src={HERO_IMAGE}
          alt="Marketing design inspiration"
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="flex w-full items-center justify-center bg-white px-6 py-10 md:basis-[35%] md:shadow-2xl">
        <LoginForm
          className="w-full md:rounded-none md:shadow-none"
          withSideImage={false}
          onSubmit={handleLogin}
          loading={loading}
        />
      </div>
    </div>
  );
}

function translateAuthError(message: string) {
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "האימייל או הסיסמה אינם נכונים.";
  }
  if (message.toLowerCase().includes("email not confirmed")) {
    return "יש לאשר את כתובת האימייל לפני ההתחברות.";
  }
  return message;
}
