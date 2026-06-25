import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api, { extractApiError } from "@/services/api";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const token = searchParams.get("token") ?? "";

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token inválido");
      return;
    }
    api.post("/auth/verify-email", { token })
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(extractApiError(err));
      });
  }, [token]);

  const iconMap = {
    loading: <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />,
    success: <CheckCircle2 className="w-8 h-8 text-white" />,
    error: <AlertCircle className="w-8 h-8 text-white" />,
  };

  const bgMap = {
    loading: "bg-purple-50 dark:bg-purple-950/30",
    success: "bg-gradient-to-br from-green-400 to-emerald-500",
    error: "bg-gradient-to-br from-red-400 to-rose-500",
  };

  const titleMap = {
    loading: "A verificar...",
    success: "Email verificado!",
    error: "Erro de verificação",
  };

  const descMap: Record<string, string> = {
    loading: "Por favor, aguarde.",
    success: "A sua conta está activa.",
    error: message,
  };

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="glass rounded-3xl p-8 md:p-10 text-center"
    >
      <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center shadow-sm ${bgMap[status]}`}>
        {iconMap[status]}
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{titleMap[status]}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{descMap[status]}</p>
      {status === "success" && (
        <Link to="/entrar"
          className="w-full inline-block py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/20 text-center">
          Entrar na conta
        </Link>
      )}
      {status === "error" && (
        <Link to="/entrar" className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent hover:from-purple-500 hover:to-blue-500 transition-all">
          Voltar ao login
        </Link>
      )}
    </motion.div>
  );
}
