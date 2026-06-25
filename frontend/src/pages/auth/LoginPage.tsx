import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import { extractApiError } from "@/services/api";
import { signInWithGoogle } from "@/services/firebase";
import { motion } from "framer-motion";
import {
  Mail, Lock, Shield, Loader2, Eye, EyeOff, LogIn, AlertCircle,
} from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      await login(data.email, data.password, data.totp_code);
      navigate("/feed");
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent"
            style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Kalie
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">O Super App de Angola</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email" placeholder="Email"
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 text-sm"
                {...register("email")}
              />
            </div>
            {errors.email && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"} placeholder="Senha"
                className="w-full pl-10 pr-10 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 text-sm"
                {...register("password")}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.password.message}</p>}
          </div>

          {needs2FA && (
            <div className="space-y-1.5">
              <div className="relative">
                <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" inputMode="numeric" maxLength={6} placeholder="Código 2FA"
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 text-sm"
                  {...register("totp_code")}
                />
              </div>
              {errors.totp_code && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.totp_code.message}</p>}
            </div>
          )}

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-xs text-center bg-red-50 dark:bg-red-950/30 py-2.5 px-3 rounded-xl border border-red-100 dark:border-red-900/30"
            >
              {error}
            </motion.p>
          )}

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-purple-600 focus:ring-purple-500/40 bg-white dark:bg-gray-900 cursor-pointer"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">Mantenha-me conectado</span>
          </label>

          <button type="submit" disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 mt-1">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <><LogIn className="w-4 h-4" /> {t("auth.login")}</>
            )}
          </button>

          {/* Terms */}
          <p className="text-xs text-center text-gray-400 dark:text-gray-600 leading-relaxed">
            Ao continuar, aceitas os nossos{" "}
            <a href="#" className="text-purple-600 dark:text-purple-400 hover:underline">Termos de Serviço</a>{" "}
            e{" "}
            <a href="#" className="text-purple-600 dark:text-purple-400 hover:underline">Política de Privacidade</a>.
          </p>
        </form>

        {/* OR divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">OU</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
        </div>

        {/* Social login */}
        <div className="flex flex-col gap-3">
          <button type="button" onClick={async () => {
            setError("");
            try {
              const idToken = await signInWithGoogle();
              await loginWithGoogle(idToken);
              navigate("/feed");
            } catch (err: unknown) {
              setError(extractApiError(err, "Erro ao entrar com Google"));
            }
          }}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all text-sm font-semibold text-gray-700 dark:text-gray-300">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Entrar com Google
          </button>

          <button type="button" disabled
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-60">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Entrar com Apple
            <span className="text-[10px] text-gray-400 dark:text-gray-600">(em breve)</span>
          </button>
        </div>

        {/* Forgot password */}
        <div className="text-center mt-6">
          <Link to="/esqueci-senha" className="text-sm text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
            {t("auth.forgot_password")}
          </Link>
        </div>
      </div>

      {/* Signup card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-4 glass rounded-2xl py-5 text-center"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("auth.no_account")}{" "}
          <Link to="/registar" className="font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent hover:from-purple-500 hover:to-blue-500 transition-all">
            {t("auth.register")}
          </Link>
        </p>
      </motion.div>
    </>
  );
}
