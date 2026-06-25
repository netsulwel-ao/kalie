import { useState } from "react";
import {
  User, Lock, Shield, Bell, Palette, Globe, Info,
  ChevronRight, AlertTriangle, Sun, Moon,
  Eye, EyeOff, Smartphone, Mail, Trash2, LogOut,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeStore, type Theme } from "@/stores/themeStore";
import { Button } from "@/components/ui/button";

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 flex-shrink-0 cursor-pointer",
        checked ? "bg-accent-feed" : "bg-white/10",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span className={cn(
        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200",
        checked ? "translate-x-6" : "translate-x-1",
      )} />
    </div>
  );
}

// ── Settings row ──────────────────────────────────────────────────────────────
function SettingsRow({
  icon: Icon, label, description, danger, control, onClick,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  danger?: boolean;
  control?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all text-left",
        "hover:bg-white/5 group",
        !onClick && "cursor-default hover:bg-transparent",
      )}
    >
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", danger ? "bg-accent-sos/10" : "bg-white/5")}>
        <Icon className={cn("w-[18px] h-[18px]", danger ? "text-accent-sos" : "text-zinc-400")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-body-sm font-medium", danger ? "text-accent-sos" : "text-white")}>{label}</p>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      {control ?? (onClick && (
        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
      ))}
    </button>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="glass-panel luminous-edge rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Icon className="w-4 h-4 text-zinc-500" />
        <h2 className="text-label-caps text-zinc-500 uppercase tracking-widest">{title}</h2>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DefinicoesPage() {
  const [pushNotif,     setPushNotif]     = useState(true);
  const [emailNotif,    setEmailNotif]    = useState(false);
  const [smsAlerts,     setSmsAlerts]     = useState(true);
  const [gameInvites,   setGameInvites]   = useState(true);
  const [twoFactor,     setTwoFactor]     = useState(false);
  const [publicProfile, setPublicProfile] = useState(true);
  const [showOnline,    setShowOnline]    = useState(true);

  const { theme, setTheme } = useThemeStore();

  const themeOptions: { value: Theme; label: string; icon: React.ElementType }[] = [
    { value: "light", label: "Claro",  icon: Sun  },
    { value: "dark",  label: "Escuro", icon: Moon },
  ];

  return (
    <div className="py-6 max-w-2xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-h1 font-space-grotesk text-white">Definições</h1>
        <p className="text-on-surface-variant mt-1">Gere a tua conta e preferências.</p>
      </div>

      {/* ── Profile card ─────────────────────────────────────────── */}
      <div className="glass-panel luminous-edge rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full bg-surface-container-high border-2 border-white/10 flex items-center justify-center">
            <User className="w-9 h-9 text-zinc-500" />
          </div>
          <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-accent-bisno flex items-center justify-center border-2 border-surface hover:brightness-110 transition-all">
            <Eye className="w-3.5 h-3.5 text-surface" />
          </button>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-body-lg font-bold text-white">Utilizador Kalie</h2>
          <p className="text-body-sm text-zinc-500">@utilizador</p>
          <p className="text-body-sm text-zinc-500">utilizador@kalie.ao</p>
          <p className="text-body-sm text-zinc-500">+244 9XX XXX XXX</p>
        </div>
        <Button variant="glass" size="sm" className="flex-shrink-0">
          Editar Perfil
        </Button>
      </div>

      <div className="flex flex-col gap-4">

        {/* Segurança */}
        <Section title="Segurança" icon={Shield}>
          <SettingsRow icon={Lock}       label="Alterar senha"                description="Actualiza a tua senha de acesso"          onClick={() => {}} />
          <SettingsRow icon={Smartphone} label="Autenticação de dois factores" description={twoFactor ? "Activada" : "Desactivada"}  control={<Toggle checked={twoFactor} onChange={setTwoFactor} />} />
          <SettingsRow icon={Shield}     label="Sessões activas"              description="Gere os dispositivos com sessão iniciada"  onClick={() => {}} />
        </Section>

        {/* Notificações */}
        <Section title="Notificações" icon={Bell}>
          <SettingsRow icon={Bell}          label="Notificações push"    description="Recebe alertas no dispositivo"          control={<Toggle checked={pushNotif}   onChange={setPushNotif}   />} />
          <SettingsRow icon={Mail}          label="Notificações por email" description="Actualizações e resumos por email"    control={<Toggle checked={emailNotif}  onChange={setEmailNotif}  />} />
          <SettingsRow icon={Smartphone}    label="Alertas SMS"          description="Alertas críticos por SMS"               control={<Toggle checked={smsAlerts}   onChange={setSmsAlerts}   />} />
          <SettingsRow icon={AlertTriangle} label="Convites para jogos"  description="Notificações de torneios e partidas"    control={<Toggle checked={gameInvites} onChange={setGameInvites} />} />
        </Section>

        {/* Aparência */}
        <Section title="Aparência" icon={Palette}>
          <div className="px-4 py-3">
            <p className="text-body-sm font-medium text-white mb-3">Tema</p>
            <div className="flex gap-2">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border transition-all",
                    theme === value
                      ? "bg-white/10 border-white/20 text-white"
                      : "bg-white/3 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <SettingsRow icon={Globe} label="Idioma" description="Português (Angola)" onClick={() => {}} />
        </Section>

        {/* Privacidade */}
        <Section title="Privacidade" icon={Eye}>
          <SettingsRow icon={Eye}    label="Perfil público"       description="Outros utilizadores podem ver o teu perfil"  control={<Toggle checked={publicProfile} onChange={setPublicProfile} />} />
          <SettingsRow icon={EyeOff} label="Mostrar estado online" description="Outros vêem quando estás online"            control={<Toggle checked={showOnline}    onChange={setShowOnline}    />} />
          <SettingsRow icon={Shield} label="Histórico de actividade" description="Gere os teus dados de actividade"         onClick={() => {}} />
        </Section>

        {/* Conta Avançada */}
        <Section title="Conta Avançada" icon={Info}>
          <SettingsRow icon={Download} label="Exportar dados"   description="Descarrega uma cópia dos teus dados"  onClick={() => {}} />
          <SettingsRow icon={Trash2}   label="Eliminar conta"   description="Esta acção é irreversível"            danger onClick={() => {}} />
        </Section>

        {/* Sobre */}
        <Section title="Sobre" icon={Info}>
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-body-sm font-medium text-white">Versão</p>
              <p className="text-xs text-zinc-500">Kalie Super App</p>
            </div>
            <span className="text-body-sm text-zinc-400 font-mono">1.0.0</span>
          </div>
          <SettingsRow icon={Info}   label="Termos de Serviço"       onClick={() => {}} />
          <SettingsRow icon={Shield} label="Política de Privacidade" onClick={() => {}} />
        </Section>

        {/* Logout */}
        <button className="w-full glass-panel rounded-xl p-4 flex items-center justify-center gap-3 text-accent-sos hover:bg-accent-sos/5 transition-all border border-accent-sos/10 hover:border-accent-sos/20">
          <LogOut className="w-5 h-5" />
          <span className="font-semibold">Terminar Sessão</span>
        </button>
      </div>
    </div>
  );
}
