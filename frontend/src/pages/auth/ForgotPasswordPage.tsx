import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api, { extractApiError } from "@/services/api";
import { Loader2, ArrowLeft } from "lucide-react";

const schema = z.object({ email: z.string().email("Email inválido") });
type FormData = z.infer<typeof schema>;

const inputClass = "w-full px-3 py-[9px] bg-[#fafafa] border border-gray-300 rounded-[4px] text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors";

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
      <div className="bg-white border border-gray-200 rounded-lg p-[40px] text-center mb-3">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Verifique o seu email</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
          Enviámos um link para redefinir a sua senha.
        </p>
        <Link to="/entrar"
          className="w-full inline-block py-[7px] bg-[#4CB5F9] hover:bg-[#3ba5e9] text-white text-sm font-semibold rounded-[8px] transition-colors text-center">
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-[40px] mb-3">
        <Link to="/entrar" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </Link>

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Esqueceu a senha?</h1>
          <p className="text-sm text-gray-500">Introduza o seu email para receber um link de redefinição.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <input type="email" placeholder="Email" className={inputClass} {...register("email")} />
          {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}

          {error && (
            <p className="text-red-500 text-xs text-center bg-red-50 py-2 px-3 rounded-[4px]">{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-[7px] mt-3 bg-[#4CB5F9] hover:bg-[#3ba5e9] text-white text-sm font-semibold rounded-[8px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar link"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg py-[22px] text-center">
        <Link to="/entrar" className="text-sm text-[#4CB5F9] font-semibold hover:text-[#3ba5e9] transition-colors">
          Voltar ao login
        </Link>
      </div>
    </>
  );
}
