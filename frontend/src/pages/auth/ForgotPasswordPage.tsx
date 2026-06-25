import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api, { extractApiError } from "@/services/api";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Mail, Lock } from "lucide-react";

const schema = z.object({ email: z.string().email("Email inválido") });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", data);
      setSent(true);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="glass rounded-3xl p-8 md:p-10 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center"
        >
          <Mail className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Verifique o seu email</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
          Enviámos um link para redefinir a sua senha.
        </p>
        <Link to="/entrar"
          className="w-full inline-block py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/20 text-center">
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="glass rounded-3xl p-8 md:p-10">
        <Link to="/entrar" className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </Link>

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Esqueceu a senha?</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Introduza o seu email para receber um link de redefinição.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" placeholder="Email"
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 text-sm"
                {...register("email")} />
            </div>
            {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
          </div>

          {error && (
            <p className="text-red-500 text-xs text-center bg-red-50 dark:bg-red-950/30 py-2.5 px-3 rounded-xl border border-red-100 dark:border-red-900/30">{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 mt-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar link"}
          </button>
        </form>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-4 glass rounded-2xl py-5 text-center"
      >
        <Link to="/entrar" className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent hover:from-purple-500 hover:to-blue-500 transition-all">
          Voltar ao login
        </Link>
      </motion.div>
    </>
  );
}
