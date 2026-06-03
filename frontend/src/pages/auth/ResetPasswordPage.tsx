import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api, { extractApiError } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="glass-panel rounded-lg p-8 luminous-edge">
      <h2 className="text-h2 font-space-grotesk text-white mb-2">Nova senha</h2>
      <p className="text-body-sm text-on-surface-variant mb-8">Introduza a sua nova senha.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Input
          label="Nova senha"
          type="password"
          placeholder="••••••••"
          error={errors.new_password?.message}
          {...register("new_password")}
        />
        {error && <p className="text-body-sm text-error">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">Redefinir senha</Button>
      </form>
    </div>
  );
}
