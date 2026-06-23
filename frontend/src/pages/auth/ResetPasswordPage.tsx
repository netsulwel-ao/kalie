import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api, { extractApiError } from "@/services/api";
import { Loader2 } from "lucide-react";

const schema = z.object({
  new_password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});
type FormData = z.infer<typeof schema>;

const inputClass = "w-full px-3 py-[9px] bg-[#fafafa] border border-gray-300 rounded-[4px] text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors";

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
    <div className="bg-white border border-gray-200 rounded-lg p-[40px] mb-3">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Nova senha</h1>
        <p className="text-sm text-gray-500">Introduza a sua nova senha.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <input type="password" placeholder="Nova senha" className={inputClass} {...register("new_password")} />
        {errors.new_password && <p className="text-red-500 text-xs">{errors.new_password.message}</p>}

        {error && (
          <p className="text-red-500 text-xs text-center bg-red-50 py-2 px-3 rounded-[4px]">{error}</p>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-[7px] mt-3 bg-[#4CB5F9] hover:bg-[#3ba5e9] text-white text-sm font-semibold rounded-[8px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Redefinir senha"}
        </button>
      </form>
    </div>
  );
}
