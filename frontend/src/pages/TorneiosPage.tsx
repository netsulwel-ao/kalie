import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Trophy, Users, Swords, Crown,
  ChevronRight, Plus, Lock, Gamepad2, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type TournamentStatus = "inscricoes" | "em_curso" | "finalizado";

interface Match {
  p1: string;
  p2: string;
  winner: string | null;
}

interface Round {
  name: string;
  matches: Match[];
}

// ── Bracket data ──────────────────────────────────────────────────────────────
const bracketRounds: Round[] = [
  {
    name: "Quartos de Final",
    matches: [
      { p1: "Carlos M.",  p2: "Ana F.",      winner: "Carlos M." },
      { p1: "João S.",    p2: "Maria L.",    winner: "João S."   },
      { p1: "Pedro A.",   p2: "Sofia R.",    winner: null        },
      { p1: "Luís B.",    p2: "Catarina N.", winner: null        },
    ],
  },
  {
    name: "Meias Finais",
    matches: [
      { p1: "Carlos M.", p2: "João S.", winner: null },
      { p1: "TBD",       p2: "TBD",    winner: null },
    ],
  },
  {
    name: "Final",
    matches: [
      { p1: "TBD", p2: "TBD", winner: null },
    ],
  },
];

// ── Tournaments list ──────────────────────────────────────────────────────────
const torneios = [
  {
    id: 1, game: "Xadrez",
    title: "Campeonato Aberto de Xadrez",
    format: "Eliminatória",
    players: 16, maxPlayers: 16,
    prizePool: 25000, entryFee: 500,
    status: "em_curso" as TournamentStatus,
    round: "Quartos de Final",
  },
  {
    id: 2, game: "NTI",
    title: "Liga Kalie de NTI",
    format: "Grupos + Eliminatória",
    players: 8, maxPlayers: 32,
    prizePool: 10000, entryFee: 200,
    status: "inscricoes" as TournamentStatus,
    round: null,
  },
  {
    id: 3, game: "Xadrez",
    title: "Torneio Relâmpago",
    format: "Todos contra todos",
    players: 6, maxPlayers: 8,
    prizePool: 5000, entryFee: 100,
    status: "inscricoes" as TournamentStatus,
    round: null,
  },
  {
    id: 4, game: "Dama",
    title: "Masters de Dama",
    format: "Eliminatória",
    players: 8, maxPlayers: 8,
    prizePool: 8000, entryFee: 300,
    status: "finalizado" as TournamentStatus,
    round: "Final",
  },
];

const statusConfig: Record<TournamentStatus, { label: string; color: string; bg: string }> = {
  inscricoes: { label: "Inscrições abertas", color: "text-accent-feed",  bg: "bg-accent-feed/10"  },
  em_curso:   { label: "Em curso",           color: "text-accent-bisno", bg: "bg-accent-bisno/10" },
  finalizado: { label: "Finalizado",         color: "text-zinc-500",     bg: "bg-white/5"         },
};

// ── Match card dimensions (used for SVG line calculations) ────────────────────
const CARD_W   = 200;
const CARD_H   = 76;   // height of one match card
const CARD_GAP = 24;   // vertical gap between cards in same round
const COL_GAP  = 80;   // horizontal gap between rounds
const ROUND_W  = CARD_W + COL_GAP;

// ── Animated SVG connector lines ──────────────────────────────────────────────
function BracketLines({ rounds }: { rounds: Round[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Calculate total SVG dimensions
  const maxMatches = Math.max(...rounds.map((r) => r.matches.length));
  const totalH = maxMatches * (CARD_H + CARD_GAP) + 40;
  const totalW = rounds.length * ROUND_W + CARD_W;

  // Get vertical centre of a match card in a given round
  function getMatchCY(roundIdx: number, matchIdx: number): number {
    const numMatches = rounds[roundIdx].matches.length;
    const totalHeight = numMatches * CARD_H + (numMatches - 1) * CARD_GAP;
    const startY = (totalH - totalHeight) / 2;
    return startY + matchIdx * (CARD_H + CARD_GAP) + CARD_H / 2;
  }

  // Build connector paths between rounds
  const paths: { d: string; hasWinner: boolean; length: number }[] = [];

  for (let ri = 0; ri < rounds.length - 1; ri++) {
    const currentRound = rounds[ri];
    const nextRound    = rounds[ri + 1];

    for (let mi = 0; mi < nextRound.matches.length; mi++) {
      // Each next-round match connects from 2 current-round matches
      const srcMatch1 = mi * 2;
      const srcMatch2 = mi * 2 + 1;

      if (srcMatch1 >= currentRound.matches.length) continue;

      const x1 = ri * ROUND_W + CARD_W;           // right edge of source card
      const x2 = (ri + 1) * ROUND_W;              // left edge of target card
      const xMid = x1 + (x2 - x1) / 2;

      const y1a = getMatchCY(ri, srcMatch1);
      const y1b = srcMatch2 < currentRound.matches.length
        ? getMatchCY(ri, srcMatch2)
        : y1a;
      const y2  = getMatchCY(ri + 1, mi);

      const hasWinner1 = !!currentRound.matches[srcMatch1]?.winner;
      const hasWinner2 = srcMatch2 < currentRound.matches.length
        ? !!currentRound.matches[srcMatch2]?.winner
        : false;
      const hasWinner = hasWinner1 && hasWinner2;

      // Line from match 1 → midpoint
      const d1 = `M ${x1} ${y1a} C ${xMid} ${y1a}, ${xMid} ${y2}, ${xMid} ${y2}`;
      // Line from match 2 → midpoint
      const d2 = `M ${x1} ${y1b} C ${xMid} ${y1b}, ${xMid} ${y2}, ${xMid} ${y2}`;
      // Line from midpoint → target
      const d3 = `M ${xMid} ${y2} L ${x2} ${y2}`;

      const approxLen = Math.abs(y1a - y2) + Math.abs(x2 - xMid) + 20;

      paths.push({ d: d1, hasWinner: hasWinner1, length: approxLen });
      if (srcMatch2 < currentRound.matches.length) {
        paths.push({ d: d2, hasWinner: hasWinner2, length: approxLen });
      }
      paths.push({ d: d3, hasWinner, length: Math.abs(x2 - xMid) + 10 });
    }
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      width={totalW}
      height={totalH}
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="glow-green">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-dim">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke={p.hasWinner ? "#00C853" : "rgba(255,255,255,0.12)"}
          strokeWidth={p.hasWinner ? 2 : 1.5}
          strokeLinecap="round"
          filter={p.hasWinner ? "url(#glow-green)" : "url(#glow-dim)"}
          strokeDasharray={p.length + 10}
          strokeDashoffset={animated ? 0 : p.length + 10}
          style={{
            transition: `stroke-dashoffset ${0.6 + i * 0.08}s cubic-bezier(0.4,0,0.2,1)`,
          }}
        />
      ))}
    </svg>
  );
}

// ── Single match card ─────────────────────────────────────────────────────────
function MatchCard({ match, roundIdx }: { match: Match; roundIdx: number }) {
  const isFinal = roundIdx === bracketRounds.length - 1;

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden flex-shrink-0 transition-all duration-300",
        isFinal
          ? "border-accent-gold/40 shadow-[0_0_20px_rgba(255,215,0,0.1)]"
          : "border-white/10",
      )}
      style={{ width: CARD_W, minHeight: CARD_H }}
    >
      {[match.p1, match.p2].map((player, pi) => {
        const isWinner = match.winner === player;
        const isLoser  = match.winner !== null && match.winner !== player;
        const isTBD    = player === "TBD";

        return (
          <div
            key={pi}
            className={cn(
              "flex items-center justify-between px-3 py-2.5 text-sm transition-all",
              pi === 0 && "border-b border-white/5",
              isWinner && "bg-accent-feed/10",
              isLoser  && "opacity-40",
              isTBD    && "opacity-30",
            )}
          >
            <span className={cn(
              "font-medium truncate",
              isWinner ? "text-accent-feed" : isTBD ? "text-zinc-600 italic" : "text-zinc-200",
            )}>
              {isTBD ? "A definir" : player}
            </span>
            {isWinner && (
              <Crown className="w-3.5 h-3.5 text-accent-gold flex-shrink-0 ml-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Bracket column ────────────────────────────────────────────────────────────
function BracketColumn({ round, roundIdx, totalH }: {
  round: Round;
  roundIdx: number;
  totalH: number;
}) {
  const numMatches  = round.matches.length;
  const totalCards  = numMatches * CARD_H + (numMatches - 1) * CARD_GAP;
  const startOffset = (totalH - totalCards) / 2;

  return (
    <div
      className="flex flex-col absolute"
      style={{
        left: roundIdx * ROUND_W,
        top: startOffset,
        gap: CARD_GAP,
        width: CARD_W,
      }}
    >
      {round.matches.map((match, mi) => (
        <MatchCard key={mi} match={match} roundIdx={roundIdx} />
      ))}
    </div>
  );
}

// ── Full bracket ──────────────────────────────────────────────────────────────
function TournamentBracket() {
  const maxMatches = Math.max(...bracketRounds.map((r) => r.matches.length));
  const totalH     = maxMatches * (CARD_H + CARD_GAP) + 40;
  const totalW     = bracketRounds.length * ROUND_W + CARD_W;

  return (
    <div className="glass-panel luminous-edge rounded-xl p-6 overflow-x-auto">
      {/* Legend */}
      <div className="flex items-center gap-6 mb-8 flex-wrap">
        {bracketRounds.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              i === bracketRounds.length - 1 ? "bg-accent-gold" : "bg-white/30",
            )} />
            <span className={cn(
              "text-label-caps uppercase tracking-widest",
              i === bracketRounds.length - 1 ? "text-accent-gold" : "text-zinc-500",
            )}>
              {r.name}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <div className="w-6 h-0.5 bg-accent-feed rounded" />
          <span className="text-xs text-zinc-500">Vencedor avança</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-white/15 rounded" />
          <span className="text-xs text-zinc-500">A aguardar</span>
        </div>
      </div>

      {/* Round headers */}
      <div className="flex mb-4" style={{ width: totalW }}>
        {bracketRounds.map((r, i) => (
          <div
            key={i}
            className="text-center"
            style={{ width: CARD_W, marginLeft: i > 0 ? COL_GAP : 0 }}
          >
            <span className={cn(
              "text-label-caps uppercase tracking-widest font-bold",
              i === bracketRounds.length - 1 ? "text-accent-gold" : "text-zinc-400",
            )}>
              {r.name}
            </span>
          </div>
        ))}
      </div>

      {/* Bracket canvas */}
      <div className="relative" style={{ width: totalW, height: totalH }}>
        <BracketLines rounds={bracketRounds} />
        {bracketRounds.map((round, ri) => (
          <BracketColumn
            key={ri}
            round={round}
            roundIdx={ri}
            totalH={totalH}
          />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TorneiosPage() {
  const [activeTab, setActiveTab] = useState<"todos" | "meus" | "bracket">("todos");

  return (
    <div className="py-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-h1 font-space-grotesk text-white">Torneios</h1>
          <p className="text-on-surface-variant mt-1">
            Compete, convida amigos e sobe no ranking. Prémios reais em AOA.
          </p>
        </div>
        <Button className="bg-accent-games text-white hover:brightness-110 w-fit">
          <Plus className="w-4 h-4 mr-2" />
          Criar Torneio
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-panel p-1 rounded-full w-fit mb-8">
        {(["todos", "meus", "bracket"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2 rounded-full text-body-sm font-medium transition-all",
              activeTab === tab
                ? "bg-white/10 text-white border border-white/15"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {tab === "todos" ? "Todos" : tab === "meus" ? "Os Meus" : "Bracket"}
          </button>
        ))}
      </div>

      {/* Tournament list */}
      {activeTab === "todos" && (
        <div className="flex flex-col gap-4">
          {torneios.map((t) => {
            const cfg  = statusConfig[t.status];
            const pct  = Math.round((t.players / t.maxPlayers) * 100);
            const isFull = t.players >= t.maxPlayers;

            return (
              <div key={t.id} className="glass-panel luminous-edge rounded-lg p-5 hover:border-white/20 transition-all">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0 border border-white/5">
                    {t.game === "Xadrez" ? (
                      <Swords className="w-7 h-7 text-accent-bisno" />
                    ) : t.game === "NTI" ? (
                      <Gamepad2 className="w-7 h-7 text-accent-games" />
                    ) : (
                      <Shield className="w-7 h-7 text-accent-gold" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-body-md font-bold text-white">{t.title}</h3>
                      <span className={cn("text-label-caps px-2 py-0.5 rounded-full uppercase text-xs font-bold", cfg.color, cfg.bg)}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-body-sm text-zinc-400">
                      <span className="flex items-center gap-1"><Gamepad2 className="w-3.5 h-3.5" /> {t.game}</span>
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {t.players}/{t.maxPlayers}</span>
                      <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-accent-gold" /> {(t.prizePool / 100).toLocaleString("pt-AO")} AOA</span>
                      {t.round && <span className="flex items-center gap-1"><Crown className="w-3.5 h-3.5 text-accent-games" /> {t.round}</span>}
                    </div>
                    {t.status === "inscricoes" && (
                      <div className="mt-2 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-feed rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-label-caps text-zinc-500 uppercase">Entrada</p>
                      <p className="text-white font-bold">{(t.entryFee / 100).toLocaleString("pt-AO")} AOA</p>
                    </div>
                    {t.status === "inscricoes" && !isFull && (
                      <Button size="sm" className="bg-accent-games text-white hover:brightness-110">Inscrever</Button>
                    )}
                    {t.status === "em_curso" && (
                      <Button size="sm" variant="glass" onClick={() => setActiveTab("bracket")}>
                        Ver Bracket <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                    {t.status === "finalizado" && (
                      <Button size="sm" variant="ghost" className="text-zinc-500">Resultados</Button>
                    )}
                    {isFull && t.status === "inscricoes" && (
                      <span className="text-label-caps text-accent-sos uppercase px-3 py-1 bg-accent-sos/10 rounded-full">Lotado</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* My tournaments */}
      {activeTab === "meus" && (
        <div className="glass-panel rounded-lg p-8 text-center">
          <Lock className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-h3 font-space-grotesk text-white mb-2">Sem torneios activos</h3>
          <p className="text-on-surface-variant mb-6">Inscreve-te num torneio para começar a competir.</p>
          <Button onClick={() => setActiveTab("todos")}>Ver Torneios</Button>
        </div>
      )}

      {/* Bracket */}
      {activeTab === "bracket" && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setActiveTab("todos")} className="text-zinc-500 hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h2 className="text-h2 font-space-grotesk text-white">Campeonato Aberto de Xadrez</h2>
            <span className="text-label-caps text-accent-bisno bg-accent-bisno/10 px-3 py-1 rounded-full uppercase">Em curso</span>
          </div>
          <TournamentBracket />
        </div>
      )}
    </div>
  );
}
