import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import { extractApiError } from "@/services/api";
import { signInWithGoogle } from "@/services/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
  totp_code: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, loginWithGoogle, isLoading } = useAuthStore();
  const [error, setError] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      await login(data.email, data.password, data.totp_code);
      navigate("/");
    } catch (err: unknown) {
      const msg = extractApiError(err);
      if (msg === "2FA_REQUIRED") {
        setNeeds2FA(true);
      } else {
        setError(msg);
      }
    }
  };

  return (
    <div className="glass-panel rounded-lg p-8 luminous-edge">
      <h2 className="text-h2 font-space-grotesk text-white mb-2">{t("auth.login")}</h2>
      <p className="text-body-sm text-on-surface-variant mb-8">
        {t("auth.no_account")}{" "}
        <Link to="/registar" className="text-accent-bisno hover:underline font-medium">
          {t("auth.register")}
        </Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Input
          label={t("auth.email")}
          type="email"
          placeholder="nome@exemplo.com"
          error={errors.email?.message}
          {...register("email")}
        />

        <Input
          label={t("auth.password")}
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register("password")}
        />

        {needs2FA && (
          <Input
            label={t("auth.totp_code")}
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            error={errors.totp_code?.message}
            {...register("totp_code")}
          />
        )}

        {error && (
          <p className="text-body-sm text-error bg-error-container/20 border border-error/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Link to="/esqueci-senha" className="text-body-sm text-on-surface-variant hover:text-white transition-colors">
            {t("auth.forgot_password")}
          </Link>
        </div>

        <Button type="submit" loading={isLoading} className="w-full mt-2">
          {t("auth.login")}
        </Button>

        <div className="relative flex items-center gap-4 my-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-body-sm text-on-surface-variant">{t("common.or")}</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <Button
          type="button"
          variant="glass"
          className="w-full flex items-center gap-3"
          onClick={async () => {
            setError("");
            try {
              const idToken = await signInWithGoogle();
              await loginWithGoogle(idToken);
              navigate("/");
            } catch (err: unknown) {
              setError(extractApiError(err, "Erro ao entrar com Google"));
            }
          }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t("auth.login_with_google")}
        </Button>
      </form>
    </div>
  );
}
