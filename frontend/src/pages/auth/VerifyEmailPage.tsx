import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api, { extractApiError } from "@/services/api";
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
    loading: <Loader2 className="w-8 h-8 text-[#4CB5F9] animate-spin" />,
    success: <CheckCircle2 className="w-8 h-8 text-white" />,
    error: <AlertCircle className="w-8 h-8 text-white" />,
  };

  const bgMap = {
    loading: "bg-blue-50",
    success: "bg-gradient-to-br from-green-400 to-emerald-500",
    error: "bg-gradient-to-br from-red-400 to-rose-500",
  };

  const titleMap = {
    loading: "A verificar...",
    success: "Email verificado!",
    error: "Erro de verificação",
  };

  const descMap = {
    loading: "Por favor, aguarde.",
    success: "A sua conta está activa.",
    error: message,
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-[40px] text-center mb-3">
      <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center shadow-sm ${bgMap[status]}`}>
        {iconMap[status]}
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{titleMap[status]}</h2>
      <p className="text-sm text-gray-500 mb-6">{descMap[status]}</p>
      {status === "success" && (
        <Link to="/entrar"
          className="w-full inline-block py-[7px] bg-[#4CB5F9] hover:bg-[#3ba5e9] text-white text-sm font-semibold rounded-[8px] transition-colors text-center">
          Entrar na conta
        </Link>
      )}
      {status === "error" && (
        <Link to="/entrar" className="text-sm text-[#4CB5F9] font-semibold hover:text-[#3ba5e9] transition-colors">
          Voltar ao login
        </Link>
      )}
    </div>
  );
}
