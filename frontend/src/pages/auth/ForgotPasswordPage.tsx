import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api, { extractApiError } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({ email: z.string().email("Email inválido") });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <div className="glass-panel rounded-lg p-8 luminous-edge text-center">
        <h2 className="text-h3 font-space-grotesk text-white mb-2">Email enviado!</h2>
        <p className="text-body-md text-on-surface-variant mb-6">
          Se o email existir, receberá instruções para redefinir a senha.
        </p>
        <Link to="/entrar" className="text-accent-bisno hover:underline">Voltar ao login</Link>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-lg p-8 luminous-edge">
      <h2 className="text-h2 font-space-grotesk text-white mb-2">Esqueci a senha</h2>
      <p className="text-body-sm text-on-surface-variant mb-8">
        Introduza o seu email e enviaremos instruções para redefinir a senha.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Input label="Email" type="email" placeholder="nome@exemplo.com" error={errors.email?.message} {...register("email")} />
        {error && <p className="text-body-sm text-error">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">Enviar instruções</Button>
        <Link to="/entrar" className="text-center text-body-sm text-on-surface-variant hover:text-white transition-colors">
          Voltar ao login
        </Link>
      </form>
    </div>
  );
}
