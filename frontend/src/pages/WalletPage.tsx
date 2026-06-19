import { useEffect, useState } from "react";
import {
  Send, ArrowLeftRight, CreditCard, QrCode,
  TrendingUp, ShieldCheck, Loader2, Plus, X,
  ArrowUpRight, ArrowDownLeft, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { walletApi, formatAOA, timeAgo, type Wallet, type WalletTransaction } from "@/services/modules";
import { extractApiError } from "@/services/api";

const TX_ICONS: Record<string, React.ElementType> = {
  deposit: ArrowDownLeft, withdrawal: ArrowUpRight,
  transfer_in: ArrowDownLeft, transfer_out: ArrowUpRight,
  raffle_entry: CreditCard, raffle_win: TrendingUp,
  auction_bid: CreditCard, auction_refund: RefreshCw,
  game_win: TrendingUp, game_loss: CreditCard, fee: CreditCard,
};

const TX_LABELS: Record<string, string> = {
  deposit: "Depósito", withdrawal: "Levantamento",
  transfer_in: "Transferência recebida", transfer_out: "Transferência enviada",
  raffle_entry: "Bilhete de sorteio", raffle_win: "Prémio de sorteio",
  auction_bid: "Lance de leilão", auction_refund: "Reembolso de leilão",
  game_win: "Ganho de jogo", game_loss: "Perda de jogo", fee: "Taxa",
};

type ModalType = "deposit" | "withdraw" | "transfer" | null;

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [amount, setAmount] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [w, t] = await Promise.all([walletApi.get(), walletApi.transactions()]);
      setWallet(w);
      setTxs(t);
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit() {
    const centavos = Math.round(parseFloat(amount) * 100);
    if (!centavos || centavos <= 0) { setError("Valor inválido."); return; }
    setSubmitting(true); setError("");
    try {
      let updated: Wallet;
      if (modal === "deposit") updated = await walletApi.deposit(centavos, desc || undefined);
      else if (modal === "withdraw") updated = await walletApi.withdraw(centavos, desc || undefined);
      else updated = await walletApi.transfer(toUserId, centavos, desc || undefined);
      setWallet(updated);
      const t = await walletApi.transactions();
      setTxs(t);
      setModal(null); setAmount(""); setToUserId(""); setDesc("");
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-10 h-10 animate-spin text-themed-muted" />
    </div>
  );

  const available = wallet?.available_centavos ?? 0;
  const balance = wallet?.balance_centavos ?? 0;
  const locked = wallet?.locked_centavos ?? 0;

  return (
    <div className="py-6 max-w-5xl mx-auto">

      {/* ── Saldo ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        <div className="lg:col-span-8 glass-panel rounded-xl p-8 relative overflow-hidden min-h-[240px] flex flex-col justify-between luminous-edge">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent-bisno/10 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
          <div className="relative z-10">
            <p className="text-label-caps text-themed-muted uppercase mb-2">Saldo disponível</p>
            <h1 className="text-h1 font-space-grotesk text-themed-primary flex items-baseline gap-3">
              {formatAOA(available)}
            </h1>
            {locked > 0 && (
              <p className="text-body-sm text-themed-muted mt-1">
                {formatAOA(locked)} bloqueado em licitações activas
              </p>
            )}
          </div>
          <div className="relative z-10 flex flex-wrap gap-3 mt-6">
            <Button className="bg-accent-bisno text-zinc-950 hover:brightness-110" onClick={() => { setModal("deposit"); setError(""); }}>
              <Plus className="w-4 h-4 mr-2" /> Depositar
            </Button>
            <Button variant="glass" onClick={() => { setModal("withdraw"); setError(""); }}>
              <ArrowUpRight className="w-4 h-4 mr-2" /> Levantar
            </Button>
            <Button variant="glass" onClick={() => { setModal("transfer"); setError(""); }}>
              <Send className="w-4 h-4 mr-2" /> Transferir
            </Button>
          </div>
          <div className="absolute bottom-6 right-6 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-accent-bisno" />
            <span className="text-xs text-themed-muted">Protegido por HMAC</span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-3">
          {[
            { icon: ArrowDownLeft, label: "Total depositado", value: formatAOA(txs.filter(t => t.type === "deposit").reduce((s, t) => s + t.amount_centavos, 0)), color: "text-accent-feed" },
            { icon: ArrowUpRight,  label: "Total levantado",  value: formatAOA(txs.filter(t => t.type === "withdrawal").reduce((s, t) => s + t.amount_centavos, 0)), color: "text-accent-sos" },
            { icon: TrendingUp,    label: "Ganhos",           value: formatAOA(txs.filter(t => ["raffle_win","game_win"].includes(t.type)).reduce((s, t) => s + t.amount_centavos, 0)), color: "text-accent-gold" },
            { icon: CreditCard,    label: "Transacções",      value: String(txs.length), color: "text-accent-bisno" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="glass-panel rounded-xl p-4 flex flex-col gap-2 luminous-edge">
              <Icon className={cn("w-5 h-5", color)} />
              <p className="text-xs text-themed-muted">{label}</p>
              <p className={cn("font-bold text-sm", color)}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Transacções ───────────────────────────────────────── */}
      <div className="glass-panel rounded-xl p-6 luminous-edge">
        <h3 className="text-h3 font-space-grotesk text-themed-primary mb-4">Actividade Recente</h3>
        {txs.length === 0 ? (
          <p className="text-themed-muted text-center py-8">Sem transacções ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {txs.map((tx) => {
              const Icon = TX_ICONS[tx.type] ?? CreditCard;
              const positive = ["deposit","transfer_in","raffle_win","game_win","auction_refund"].includes(tx.type);
              return (
                <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      positive ? "bg-accent-feed/10 text-accent-feed" : "bg-white/5 text-themed-muted")}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-body-sm font-semibold text-themed-primary">
                        {tx.description || TX_LABELS[tx.type] || tx.type}
                      </p>
                      <p className="text-xs text-themed-muted">{timeAgo(tx.created_at)}</p>
                    </div>
                  </div>
                  <span className={cn("font-bold text-body-sm", positive ? "text-accent-feed" : "text-themed-primary")}>
                    {positive ? "+" : "-"}{formatAOA(tx.amount_centavos)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">
                {modal === "deposit" ? "Depositar" : modal === "withdraw" ? "Levantar" : "Transferir"}
              </h3>
              <button onClick={() => setModal(null)} className="text-themed-muted hover:text-themed-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modal === "transfer" && (
              <div className="mb-4">
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">ID do destinatário</label>
                <input
                  value={toUserId} onChange={e => setToUserId(e.target.value)}
                  className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                  placeholder="UUID do utilizador"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Valor (AOA)</label>
              <input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                placeholder="0.00" min="0" step="0.01"
              />
            </div>

            <div className="mb-5">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Descrição (opcional)</label>
              <input
                value={desc} onChange={e => setDesc(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                placeholder="Motivo..."
              />
            </div>

            {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}

            <Button
              className="w-full bg-accent-bisno text-zinc-950 hover:brightness-110"
              onClick={handleSubmit} disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
