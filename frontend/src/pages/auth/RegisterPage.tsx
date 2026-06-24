import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import { extractApiError } from "@/services/api";
import { Loader2, CheckCircle2 } from "lucide-react";

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

const inputClass = "w-full px-3 py-[9px] bg-[#fafafa] border border-gray-300 rounded-[4px] text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors";

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
      <div className="bg-white border border-gray-200 rounded-lg p-[40px] text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Conta criada!</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
          Verifique o seu email para activar a conta.
        </p>
        <button onClick={() => navigate("/entrar")}
          className="w-full py-[7px] bg-[#4CB5F9] hover:bg-[#3ba5e9] text-white text-sm font-semibold rounded-[8px] transition-colors">
          Ir para o Login
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-[40px] mb-3">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-[64px] h-[64px] mx-auto mb-2">
            <img src="/images/games/logo.jpeg" alt="Kalie" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Kalie</span>
          </h1>
          <p className="text-sm text-gray-400 mt-2">Regista-te para começares</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <input type="text" placeholder="Nome completo" className={inputClass} {...register("full_name")} />
          {errors.full_name && <p className="text-red-500 text-xs">{errors.full_name.message}</p>}

          <input type="text" placeholder="Username" className={inputClass} {...register("username")} />
          {errors.username && <p className="text-red-500 text-xs">{errors.username.message}</p>}

          <input type="email" placeholder="Email" className={inputClass} {...register("email")} />
          {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}

          <input type="password" placeholder="Senha" className={inputClass} {...register("password")} />
          {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}

          <input type="tel" placeholder="WhatsApp (opcional)" className={inputClass} {...register("phone")} />
          {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}

          {error && (
            <p className="text-red-500 text-xs text-center bg-red-50 py-2 px-3 rounded-[4px]">{error}</p>
          )}

          <button type="submit" disabled={isLoading}
            className="w-full py-[7px] mt-3 bg-[#4CB5F9] hover:bg-[#3ba5e9] text-white text-sm font-semibold rounded-[8px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (t("auth.register"))}
          </button>
        </form>
      </div>

      {/* Login card */}
      <div className="bg-white border border-gray-200 rounded-lg py-[22px] text-center">
        <p className="text-sm text-gray-600">
          {t("auth.have_account")}{" "}
          <Link to="/entrar" className="text-[#4CB5F9] font-semibold hover:text-[#3ba5e9] transition-colors">
            {t("auth.login")}
          </Link>
        </p>
      </div>
    </>
  );
}
