import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api, { extractApiError } from "@/services/api";

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

  return (
    <div className="glass-panel rounded-lg p-8 luminous-edge text-center">
      {status === "loading" && (
        <p className="text-on-surface-variant">A verificar o seu email...</p>
      )}
      {status === "success" && (
        <>
          <div className="w-16 h-16 bg-accent-feed/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent-feed" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-h3 font-space-grotesk text-white mb-2">Email verificado!</h2>
          <p className="text-body-md text-on-surface-variant mb-6">A sua conta está activa.</p>
          <Link to="/entrar" className="text-accent-bisno hover:underline font-medium">Entrar na conta</Link>
        </>
      )}
      {status === "error" && (
        <>
          <h2 className="text-h3 font-space-grotesk text-error mb-2">Erro de verificação</h2>
          <p className="text-body-md text-on-surface-variant mb-6">{message}</p>
          <Link to="/entrar" className="text-accent-bisno hover:underline">Voltar ao login</Link>
        </>
      )}
    </div>
  );
}
