import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import { extractApiError } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  username: z
    .string()
    .min(3, "Username deve ter pelo menos 3 caracteres")
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "Apenas letras, números e _"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Deve conter uma maiúscula")
    .regex(/[0-9]/, "Deve conter um número")
    .regex(/[!@#$%^&*]/, "Deve conter um caractere especial"),
  phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuthStore();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      await registerUser(data);
      setSuccess(true);
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  };

  if (success) {
    return (
      <div className="glass-panel rounded-lg p-8 luminous-edge text-center">
        <div className="w-16 h-16 bg-accent-feed/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-accent-feed" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-h3 font-space-grotesk text-white mb-2">Conta criada!</h2>
        <p className="text-body-md text-on-surface-variant mb-6">
          Verifique o seu email para activar a conta.
        </p>
        <Button onClick={() => navigate("/entrar")} className="w-full">
          Ir para o Login
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-lg p-8 luminous-edge">
      <h2 className="text-h2 font-space-grotesk text-white mb-2">{t("auth.register")}</h2>
      <p className="text-body-sm text-on-surface-variant mb-8">
        {t("auth.have_account")}{" "}
        <Link to="/entrar" className="text-accent-bisno hover:underline font-medium">
          {t("auth.login")}
        </Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label={t("auth.full_name")}
          placeholder="João Silva"
          error={errors.full_name?.message}
          {...register("full_name")}
        />
        <Input
          label={t("auth.username")}
          placeholder="joao_silva"
          error={errors.username?.message}
          {...register("username")}
        />
        <Input
          label={t("auth.email")}
          type="email"
          placeholder="joao@exemplo.com"
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
        <Input
          label={t("auth.phone")}
          type="tel"
          placeholder="+244 9XX XXX XXX"
          error={errors.phone?.message}
          {...register("phone")}
        />

        {error && (
          <p className="text-body-sm text-error bg-error-container/20 border border-error/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <Button type="submit" loading={isLoading} className="w-full mt-2">
          {t("auth.register")}
        </Button>
      </form>
    </div>
  );
}
