import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import { extractApiError } from "@/services/api";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, User, AtSign, Mail, Lock, Phone } from "lucide-react";

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

const inputClass = "w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 text-sm";

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
      <div className="glass rounded-3xl p-8 md:p-10 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Conta criada!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
          Verifique o seu email para activar a conta.
        </p>
        <button onClick={() => navigate("/entrar")}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/20">
          Ir para o Login
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="glass rounded-3xl p-8 md:p-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.8, delay: 0.2 }}
            className="w-20 h-20 mx-auto mb-4"
          >
            <img src="/images/games/logo.jpeg" alt="Kalie" className="w-full h-full object-contain" />
          </motion.div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent"
            style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Kalie
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Regista-te para começares</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Nome completo" className={inputClass} {...register("full_name")} />
            </div>
            {errors.full_name && <p className="text-red-500 text-xs flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500" />{errors.full_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Username" className={inputClass} {...register("username")} />
            </div>
            {errors.username && <p className="text-red-500 text-xs flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500" />{errors.username.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" placeholder="Email" className={inputClass} {...register("email")} />
            </div>
            {errors.email && <p className="text-red-500 text-xs flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500" />{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="password" placeholder="Senha" className={inputClass} {...register("password")} />
            </div>
            {errors.password && <p className="text-red-500 text-xs flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500" />{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="tel" placeholder="WhatsApp (opcional)" className={inputClass} {...register("phone")} />
            </div>
            {errors.phone && <p className="text-red-500 text-xs flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500" />{errors.phone.message}</p>}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-xs text-center bg-red-50 dark:bg-red-950/30 py-2.5 px-3 rounded-xl border border-red-100 dark:border-red-900/30"
            >
              {error}
            </motion.p>
          )}

          <button type="submit" disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 mt-2">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t("auth.register")
            )}
          </button>

          <p className="text-xs text-center text-gray-400 dark:text-gray-600 leading-relaxed">
            Ao registar-te, aceitas os nossos{" "}
            <a href="#" className="text-purple-600 dark:text-purple-400 hover:underline">Termos de Serviço</a>{" "}
            e{" "}
            <a href="#" className="text-purple-600 dark:text-purple-400 hover:underline">Política de Privacidade</a>.
          </p>
        </form>
      </div>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-4 glass rounded-2xl py-5 text-center"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("auth.have_account")}{" "}
          <Link to="/entrar" className="font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent hover:from-purple-500 hover:to-blue-500 transition-all">
            {t("auth.login")}
          </Link>
        </p>
      </motion.div>
    </>
  );
}
