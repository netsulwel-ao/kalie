import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api, { extractApiError } from "@/services/api";
import { motion } from "framer-motion";
import { Loader2, Lock } from "lucide-react";

const schema = z.object({
  new_password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const token = searchParams.get("token") ?? "";

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, ...data });
      navigate("/entrar");
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-8 md:p-10">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Nova senha</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Introduza a sua nova senha.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="space-y-1.5">
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="password" placeholder="Nova senha"
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 text-sm"
              {...register("new_password")} />
          </div>
          {errors.new_password && <p className="text-red-500 text-xs">{errors.new_password.message}</p>}
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

        <button type="submit" disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 mt-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Redefinir senha"}
        </button>
      </form>
    </div>
  );
}
