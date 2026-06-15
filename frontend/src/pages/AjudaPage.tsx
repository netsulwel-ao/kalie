import { useState } from "react";
import {
  Search, MessageCircle, ChevronDown, ChevronUp,
  Mail, Phone, ExternalLink, CheckCircle, AlertCircle,
  HelpCircle, Ticket, Zap, Shield, Wallet, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── FAQ data  ──────────────────────────────────────────────────────────────────
const faqItems = [
  {
    icon: Shield,
    question: "Como funciona o Provably Fair?",
    answer:
      "O sistema Provably Fair usa criptografia HMAC-SHA256 para garantir que os resultados dos jogos são justos e verificáveis. Antes de cada jogo, geramos um hash do resultado. Após o jogo, podes verificar que o resultado não foi alterado usando a nossa ferramenta de verificação na secção de jogos.",
  },
  {
    icon: Wallet,
    question: "Como depositar Kwanzas?",
    answer:
      "Na secção Carteira, clica em 'Depositar'. Podes depositar via Sulin, transferência bancária ou Multicaixa Express. O valor mínimo de depósito é 500 AOA. Os depósitos via Sulin são instantâneos; transferências bancárias demoram 1 a 3 dias úteis.",
  },
  {
    icon: Trophy,
    question: "Como criar um torneio?",
    answer:
      "Na secção Torneios, clica em 'Criar Torneio'. Define o nome, jogo, formato (eliminatória, grupos, etc.), número máximo de participantes, taxa de entrada e prémio. Após a criação, partilha o link com os teus amigos para se inscreverem.",
  },
  {
    icon: Zap,
    question: "Como funciona o Bisno Rápido?",
    answer:
      "O Bisno Rápido é um marketplace de trabalho rápido. Podes publicar tarefas ou candidatar-te a trabalhos disponíveis. O pagamento é feito através da carteira Kalie — o valor fica bloqueado até a conclusão e confirmação do trabalho.",
  },
  {
    icon: Shield,
    question: "Como activar o 2FA?",
    answer:
      "Vai a Definições → Segurança → Autenticação de dois factores. Activa o toggle e segue as instruções para configurar a aplicação autenticadora (Google Authenticator ou similar). Guarda os códigos de recuperação num local seguro.",
  },
  {
    icon: AlertCircle,
    question: "Como reportar um problema?",
    answer:
      "Podes reportar um problema de várias formas: usa o botão 'Reportar Problema' nesta página, envia um email para suporte@kalie.ao, ou contacta-nos via WhatsApp. A nossa equipa responde em até 24 horas nos dias úteis.",
  },
];

// ── FAQ accordion item ────────────────────────────────────────────────────────
function FaqItem({ item, isOpen, onToggle }: {
  item: typeof faqItems[0];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = item.icon;
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-white/3 transition-colors rounded-xl"
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
          isOpen ? "bg-accent-bisno/15" : "bg-white/5",
        )}>
          <Icon className={cn("w-4 h-4", isOpen ? "text-accent-bisno" : "text-zinc-500")} />
        </div>
        <span className={cn("flex-1 text-body-sm font-medium transition-colors text-left", isOpen ? "text-white" : "text-zinc-300")}>
          {item.question}
        </span>
        {isOpen
          ? <ChevronUp className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        }
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? "300px" : "0px" }}
      >
        <p className="px-4 pb-4 pl-16 text-body-sm text-zinc-400 leading-relaxed">
          {item.answer}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AjudaPage() {
  const [search,    setSearch]    = useState("");
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  function toggleItem(i: number) {
    setOpenItems((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const filtered = faqItems.filter(
    (item) =>
      search === "" ||
      item.question.toLowerCase().includes(search.toLowerCase()) ||
      item.answer.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="py-6 max-w-3xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-accent-bisno/10 border border-accent-bisno/20 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-7 h-7 text-accent-bisno" />
        </div>
        <h1 className="text-h1 font-space-grotesk text-white mb-2">Centro de Ajuda</h1>
        <p className="text-on-surface-variant mb-6">
          Encontra respostas rápidas ou fala com a nossa equipa de suporte.
        </p>
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full pl-11 pr-5 py-3 text-body-sm focus:ring-1 focus:ring-white/20 outline-none text-on-surface placeholder:text-zinc-500"
            placeholder="Pesquisar na ajuda..."
            type="text"
          />
        </div>
      </div>

      {/* ── FAQ accordion ─────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-h3 font-space-grotesk text-white mb-4">Perguntas Frequentes</h2>
        <div className="glass-panel luminous-edge rounded-xl overflow-hidden">
          {filtered.length > 0 ? (
            filtered.map((item, i) => (
              <FaqItem
                key={i}
                item={item}
                isOpen={openItems.has(i)}
                onToggle={() => toggleItem(i)}
              />
            ))
          ) : (
            <div className="p-8 text-center">
              <Search className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-body-sm">Nenhum resultado para "{search}"</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Contact section ───────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-h3 font-space-grotesk text-white mb-4">Contactar Suporte</h2>
        <div className="glass-panel luminous-edge rounded-xl p-6">
          <p className="text-body-sm text-zinc-500 mb-6">
            A nossa equipa está disponível de segunda a sexta, das 08h00 às 18h00 (hora de Luanda).
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <a
              href="mailto:suporte@kalie.ao"
              className="flex-1 flex items-center justify-center gap-2 glass-panel rounded-xl py-3 px-4 text-body-sm text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            >
              <Mail className="w-4 h-4 text-accent-bisno" />
              suporte@kalie.ao
              <ExternalLink className="w-3.5 h-3.5 text-zinc-600 ml-auto" />
            </a>
            <a
              href="https://wa.me/244900000000"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-body-sm font-semibold text-white transition-all hover:brightness-110"
              style={{ background: "#25D366" }}
            >
              <Phone className="w-4 h-4" />
              WhatsApp
              <ExternalLink className="w-3.5 h-3.5 opacity-70 ml-auto" />
            </a>
          </div>
          <Button variant="glass" className="w-full">
            <Ticket className="w-4 h-4 mr-2" />
            Abrir Ticket de Suporte
          </Button>
          <p className="text-xs text-zinc-600 mt-4 text-center">
            Horário: Segunda a Sexta, 08h00 – 18h00 (WAT)
          </p>
        </div>
      </section>

      {/* ── Status section ────────────────────────────────────────── */}
      <section>
        <h2 className="text-h3 font-space-grotesk text-white mb-4">Estado do Sistema</h2>
        <div className="glass-panel luminous-edge rounded-xl p-5 flex flex-col gap-4">
          {/* API Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-feed opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-feed" />
              </div>
              <div>
                <p className="text-body-sm font-medium text-white">API Kalie</p>
                <p className="text-xs text-zinc-500">Todos os serviços</p>
              </div>
            </div>
            <span className="text-xs font-bold text-accent-feed bg-accent-feed/10 px-3 py-1 rounded-full">
              Operacional
            </span>
          </div>

          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-accent-feed" />
              <p className="text-body-sm font-medium text-white">Sem incidentes activos</p>
            </div>
            <p className="text-xs text-zinc-500 pl-6">
              Último incidente: Manutenção programada — 15 Jan 2025, 02h00–04h00 WAT. Resolvido.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Subscreve as actualizações de estado em status.kalie.ao</span>
          </div>
        </div>
      </section>
    </div>
  );
}
