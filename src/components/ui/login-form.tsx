import { FormEvent, type FC } from "react";
import { Mail, Lock } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import { cn } from "../../lib/utils";

export interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface LoginFormProps {
  className?: string;
  sideImageUrl?: string;
  onSubmit?: (values: LoginFormValues) => Promise<void> | void;
  withSideImage?: boolean;
  loading?: boolean;
}

const DEFAULT_SIDE_IMAGE =
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80";

const GoogleIcon: FC = FaGoogle as unknown as FC;

export default function LoginForm({
  className,
  sideImageUrl = DEFAULT_SIDE_IMAGE,
  onSubmit,
  withSideImage = true,
  loading = false,
}: LoginFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values: LoginFormValues = {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      rememberMe: Boolean(formData.get("remember")),
    };

    await onSubmit?.(values);
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-[560px] w-full flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl md:flex-row",
        withSideImage ? "md:h-[720px]" : "md:h-full md:rounded-none md:shadow-none",
        className
      )}
    >
      {withSideImage && (
        <div className="hidden w-full md:block md:w-1/2">
          <img
            className="h-full w-full object-cover"
            src={sideImageUrl}
            alt="Login visual"
            loading="lazy"
          />
        </div>
      )}

      <div
        className={cn(
          "flex w-full flex-col items-center justify-center px-6 py-10",
          withSideImage ? "md:w-1/2" : "md:w-full"
        )}
      >
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-sm flex-col items-center justify-center"
        >
          <div className="w-full space-y-2 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--color-primary)]">
              MarketingMSHUK
            </p>
            <h2 className="text-3xl font-semibold text-slate-900">
              התחבר לחשבון שלך
            </h2>
            <p className="text-sm text-slate-500">
              ברוך שובך! מלא את הפרטים כדי להמשיך
            </p>
          </div>

          <button type="button" className="btn-ghost mt-8 w-full justify-center" disabled={loading}>
            <GoogleIcon />
            התחברות עם Google
          </button>

          <div className="my-6 flex w-full items-center gap-4 text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <p className="text-xs font-medium uppercase tracking-widest">
              או הזן אימייל
            </p>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <label className="sr-only" htmlFor="email-input">
            אימייל
          </label>
          <div className="input-group mt-2">
            <span className="input-icon">
              <Mail className="h-5 w-5" />
            </span>
            <input
              id="email-input"
              required
              name="email"
              type="email"
              placeholder="הקלד כתובת אימייל"
              className="input-control"
            />
          </div>

          <label className="sr-only" htmlFor="password-input">
            סיסמה
          </label>
          <div className="input-group mt-4">
            <span className="input-icon">
              <Lock className="h-5 w-5" />
            </span>
            <input
              id="password-input"
              required
              name="password"
              type="password"
              placeholder="הכנס סיסמה"
              className="input-control"
            />
          </div>

          <div className="mt-6 flex w-full flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] accent-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-opacity-30"
              />
              <span>זכור אותי</span>
            </label>
            <button
              type="button"
              className="text-[var(--color-primary)] hover:underline"
              onClick={(event) => event.preventDefault()}
            >
              שכחת סיסמה?
            </button>
          </div>

          <button type="submit" className="btn-primary mt-8 w-full justify-center" disabled={loading}>
            {loading ? "מתחבר..." : "התחברות"}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            עדיין אין לכם משתמש?{" "}
            <button
              type="button"
              className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
              onClick={(event) => event.preventDefault()}
            >
              צרו קשר עם מנהל המערכת
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
