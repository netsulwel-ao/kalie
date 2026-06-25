import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  MessageCircle,
  Shield,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Gamepad2,
  Gift,
  AlertCircle,
  Wallet,
  Heart,
  Share2,
  MessageSquare,
  MoreVertical,
  Mail,
  Phone,
  Loader2,
  Play,
  Zap,
  Star,
  Sun,
  Moon,
} from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import api from "../services/api";

const waitlistSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  whatsapp: z.string().min(9, "WhatsApp inválido"),
  interests: z.array(z.string()).optional(),
  referral: z.string().optional(),
});

type WaitlistFormData = z.infer<typeof waitlistSchema>;

const KalieLogo = () => (
  <img src="/images/games/logo.jpeg" alt="Kalie Logo" className="w-full h-full object-contain" />
);

const PostCard = ({ author, image, likes, comments }: { author: string; image: string; likes: number; comments: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1"
  >
    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src={image} alt={author} className="w-10 h-10 rounded-full object-cover" />
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{author}</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs">há 2 horas</p>
        </div>
      </div>
      <MoreVertical className="w-5 h-5 text-gray-300 dark:text-gray-600 cursor-pointer" />
    </div>
    {image && (
      <div className="w-full h-48 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center overflow-hidden">
        <img src={image} alt="Post" className="w-full h-full object-cover" />
      </div>
    )}
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
        <button className="flex items-center gap-1 hover:text-red-500 transition"><Heart className="w-5 h-5" /><span className="text-sm">{likes}</span></button>
        <button className="flex items-center gap-1 hover:text-blue-500 transition"><MessageSquare className="w-5 h-5" /><span className="text-sm">{comments}</span></button>
        <button className="flex items-center gap-1 hover:text-green-500 transition"><Share2 className="w-5 h-5" /></button>
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-sm">Adorei este momento! 🎉 A comunidade Kalie é incrível!</p>
    </div>
  </motion.div>
);

const FloatingShape = ({ delay, x, y, size, children }: { delay: number; x: string; y: string; size: string; children: React.ReactNode }) => (
  <div
    className="absolute pointer-events-none z-30 animate-float will-change-transform"
    style={{ left: x, top: y, animationDelay: `${delay}s` }}
  >
    <div
      className={`${size} rounded-2xl flex items-center justify-center glass will-change-transform`}
      style={{
        transform: "rotateX(28deg) rotateY(-15deg)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.08), inset 0 1.5px 0 rgba(255,255,255,0.7)",
      }}
    >
      {children}
    </div>
  </div>
);

export default function LandingPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 400], [0, -80]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistSchema),
  });

  const interests = [
    "Networking", "Comunidade", "Eventos", "Negócios", "Aprendizado", "Entretenimento"
  ];

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const onSubmit = async (data: WaitlistFormData) => {
    setSubmitError(null);
    try {
      await api.post("/waitlist/register", {
        name: data.name,
        email: data.email,
        whatsapp: data.whatsapp,
        interests: selectedInterests.length > 0 ? selectedInterests.join(", ") : undefined,
        referral: data.referral || undefined,
      });
      setIsSubmitted(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 409) {
        setSubmitError(detail || "Este email ou WhatsApp já está registado.");
      } else {
        setSubmitError(detail || "Erro ao registar. Tenta novamente.");
      }
    }
  };

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("kalie-theme");
      if (stored) return stored === "dark";
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("kalie-theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("kalie-theme", "light");
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 overflow-x-hidden">
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-text {
          background-size: 200% 200%;
          animation: gradient-shift 4s ease infinite;
        }
        .glass {
          position: relative;
          will-change: transform, backdrop-filter;
          transform: translateZ(0);
          background:
            linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 30%, transparent 60%),
            linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0.03) 100%);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.35);
          box-shadow: 0 8px 32px rgba(0,0,0,0.06), inset 0 1.5px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(255,255,255,0.1), inset 1px 0 0 rgba(255,255,255,0.15), inset -1px 0 0 rgba(0,0,0,0.04);
          overflow: hidden;
        }
        .glass::after {
          content: '';
          position: absolute;
          z-index: -1;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,60,60,0.12) 0%, transparent 25%, rgba(60,60,255,0.12) 75%);
          pointer-events: none;
          border-radius: inherit;
        }
        .animate-float {
          animation: float 7s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(5deg); }
        }
      `}</style>
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-center px-4 py-4">
          <div className="flex items-center justify-between px-6 py-3 rounded-full glass will-change-transform w-full max-w-7xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10"><KalieLogo /></div>
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent" style={{ fontFamily: "'Orbitron', sans-serif" }}>Kalie</span>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/entrar"
                className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Entrar
              </Link>
              <button onClick={() => setIsDark(!isDark)}
                className="w-9 h-9 rounded-full glass flex items-center justify-center text-gray-600 dark:text-gray-300 hover:scale-110 transition-transform">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <a href="#waitlist" className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:from-purple-500 hover:to-blue-500 transition-all font-semibold text-sm shadow-lg shadow-purple-500/20">
                Inscrever-se
              </a>
            </div>
          </div>
        </div>
      </nav>

      <section className="px-6 pt-20 pb-16 sm:pb-24 relative overflow-hidden min-h-screen flex flex-col transition-colors">
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] bg-purple-200/40 dark:bg-purple-900/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[350px] h-[350px] bg-blue-200/40 dark:bg-blue-900/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="hidden lg:block">
          <FloatingShape delay={0} x="12%" y="8%" size="w-36 h-36">
            <Gamepad2 className="w-14 h-14 text-purple-500" />
          </FloatingShape>
          <FloatingShape delay={2} x="78%" y="12%" size="w-32 h-32">
            <MessageCircle className="w-12 h-12 text-blue-500" />
          </FloatingShape>
          <FloatingShape delay={4} x="82%" y="48%" size="w-28 h-28">
            <Heart className="w-10 h-10 text-pink-500" />
          </FloatingShape>
          <FloatingShape delay={1.5} x="3%" y="55%" size="w-32 h-32">
            <Zap className="w-12 h-12 text-amber-500" />
          </FloatingShape>
        </div>

        <motion.div className="max-w-7xl mx-auto relative z-10" style={{ y: heroParallax }}>
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:pt-12"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight">
                Conecte-se de forma
                <span className="animate-gradient-text bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 bg-clip-text text-transparent"> extraordinária</span>
              </h1>

              <p className="text-base sm:text-lg lg:text-xl text-gray-500 dark:text-gray-400 mb-8 leading-relaxed max-w-lg">
                Junte-se à revolução das conexões digitais. Kalie é mais que uma rede social — é uma plataforma onde comunidades reais se encontram, colaboram e crescem juntas.
              </p>

              <div className="flex flex-wrap gap-3 sm:gap-6 mb-10">
                {[
                  { icon: <Users className="w-5 h-5 text-purple-500" />, label: "Comunidades ativas" },
                  { icon: <MessageCircle className="w-5 h-5 text-pink-500" />, label: "Conexões reais" },
                  { icon: <Shield className="w-5 h-5 text-blue-500" />, label: "100% Seguro" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 px-4 py-2 rounded-full border border-gray-100 dark:border-gray-800">
                    {item.icon}
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-6 bg-gradient-to-br from-purple-50 dark:from-purple-950/50 to-blue-50 dark:to-blue-950/50 rounded-2xl border border-purple-100/60 dark:border-purple-900/40">
                {[
                  { value: "10K+", label: "Na lista de espera" },
                  { value: "50+", label: "Países" },
                  { value: "4.9", label: "Avaliação" },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{stat.value}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative lg:mt-24"
            >
              <div className="absolute -inset-4 bg-gradient-to-br from-purple-200/50 dark:from-purple-900/30 via-transparent to-blue-200/50 dark:to-blue-900/30 rounded-3xl blur-2xl pointer-events-none" />
              <div className="relative space-y-4 px-4 sm:px-0">
                <PostCard author="Sofia Mendes" image="/images/games/beautiful-woman-looking-her-phone.jpg" likes={342} comments={45} />
                <PostCard author="João Silva" image="/images/games/person-using-video-call-phone-talk-colleagues-from-home-entrepreneur-doing-business-meeting-smartphone-with-online-video-conference-waving-mobile-phone-camera-remote-work.jpg" likes={1203} comments={98} />
                <PostCard author="Ana Costa" image="/images/games/intercultural-friends-looking-mobile.jpg" likes={567} comments={72} />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <section id="showcase" className="px-6 py-24 bg-gray-50 dark:bg-gray-900/50 relative overflow-hidden transition-colors">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-purple-100/30 dark:from-purple-900/20 to-blue-100/30 dark:to-blue-900/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-full mb-4">
              <Play className="w-3.5 h-3.5" /> Dá o play
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Vê como o <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent" style={{ fontFamily: "'Orbitron', sans-serif" }}>Kalie</span> funciona
            </h2>
            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Descobre tudo o que podes fazer na plataforma
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 shadow-2xl group cursor-pointer"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 glass rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center pl-1 relative z-10">
                    <Play className="w-8 h-8 text-gray-900 dark:text-gray-100" />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white text-lg font-semibold">Conhece o Kalie em 60 segundos</p>
                <p className="text-gray-300 text-sm">Vê como podes conectar, jogar e muito mais</p>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: <Gamepad2 className="w-6 h-6" />, title: "Jogos", desc: "Xadrez, NTI e mais", color: "from-purple-500 to-purple-600", bg: "bg-purple-50", darkBg: "dark:bg-purple-950/30" },
                { icon: <MessageCircle className="w-6 h-6" />, title: "Chat ao vivo", desc: "Conversas em tempo real", color: "from-blue-500 to-blue-600", bg: "bg-blue-50", darkBg: "dark:bg-blue-950/30" },
                { icon: <Wallet className="w-6 h-6" />, title: "Carteira digital", desc: "Transações seguras", color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50", darkBg: "dark:bg-emerald-950/30" },
                { icon: <Users className="w-6 h-6" />, title: "Comunidades", desc: "Grupos para todos", color: "from-pink-500 to-pink-600", bg: "bg-pink-50", darkBg: "dark:bg-pink-950/30" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-5 ${item.bg} ${item.darkBg} rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all hover:-translate-y-0.5`}
                >
                  <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-lg flex items-center justify-center text-white mb-3 shadow-md`}>
                    {item.icon}
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{item.title}</h4>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="waitlist" className="px-6 py-24 bg-white dark:bg-gray-950 relative overflow-hidden transition-colors">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-300 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent" />
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Garanta seu lugar na{" "}
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">revolução</span>
            </h2>
            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Seja um dos primeiros a experimentar o futuro das redes sociais
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-stretch">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative rounded-2xl overflow-hidden min-h-[400px] lg:min-h-full bg-gradient-to-br from-purple-100 dark:from-purple-950/40 to-blue-100 dark:to-blue-950/40 border border-purple-200 dark:border-purple-900/50"
            >
              <img
                src="/images/games/intercultural-friends-looking-mobile.jpg"
                alt="Conecte-se com pessoas"
                className="absolute inset-0 w-full h-full object-cover opacity-40"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-gray-950 via-transparent to-transparent" />
              <div className="relative z-10 p-6 sm:p-10 h-full flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-6">
                  {[1,2,3,4].map(i => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="w-10 h-10 rounded-full border-2 border-white overflow-hidden shadow-md"
                    >
                      <img src={`/images/${i}.jpg`} alt={`Avatar ${i}`} className="w-full h-full object-cover" />
                    </motion.div>
                  ))}
                  <span className="text-gray-500 dark:text-gray-400 text-sm font-medium ml-2">+2.5K online agora</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Comunidade vibrante</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed max-w-sm">
                  Milhares de pessoas já estão conectadas. Faz parte desta revolução digital.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              {!isSubmitted ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 md:p-10 shadow-xl border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500" />
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Nome</label>
                        <div className="relative">
                          <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                          <input {...register("name")} type="text" placeholder="Seu nome"
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all" />
                        </div>
                        {errors.name && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.name.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                          <input {...register("email")} type="email" placeholder="seu@email.com"
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all" />
                        </div>
                        {errors.email && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email.message}</p>}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">WhatsApp</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input {...register("whatsapp")} type="tel" placeholder="+244 9XX XXX XXX"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all" />
                      </div>
                      {errors.whatsapp && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.whatsapp.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Interesses <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional)</span></label>
                      <div className="flex flex-wrap gap-2">
                        {interests.map((interest) => (
                          <button key={interest} type="button" onClick={() => toggleInterest(interest)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedInterests.includes(interest)
                              ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md shadow-purple-200 dark:shadow-purple-900/40"
                              : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}>
                            {interest}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Código de indicação <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional)</span></label>
                      <div className="relative">
                        <Gift className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input {...register("referral")} type="text" placeholder="Código se foi indicado"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all" />
                      </div>
                    </div>

                    {submitError && (
                      <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-950/30 py-2 px-4 rounded-lg border border-red-200 dark:border-red-900/50">
                        {submitError}
                      </p>
                    )}

                    <button type="submit" disabled={isSubmitting}
                      className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20">
                      {isSubmitting ? (
                        <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Processando...</span>
                      ) : (
                        <>Entrar na lista de espera <ArrowRight className="w-5 h-5" /></>
                      )}
                    </button>

                    <p className="text-center text-gray-400 dark:text-gray-500 text-xs">
                      Ao se inscrever, você concorda com nossos <a href="#" className="text-purple-600 dark:text-purple-400 hover:underline">Termos de Serviço</a> e <a href="#" className="text-purple-600 dark:text-purple-400 hover:underline">Política de Privacidade</a>
                    </p>
                  </form>
                </div>
              ) : (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                  className="bg-white dark:bg-gray-900 rounded-2xl p-12 shadow-xl border border-gray-200 dark:border-gray-700 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.5 }}
                    className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Você está na lista! 🎉</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">Obrigado por se juntar à revolução Kalie. Enviaremos um email assim que estivermos prontos para você.</p>
                  <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400 font-semibold">
                    <TrendingUp className="w-5 h-5" />
                    <span>Sua posição: #{Math.floor(Math.random() * 1000) + 1}</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      <section id="descobrir" className="px-6 py-24 bg-white dark:bg-gray-950 relative overflow-hidden transition-colors">
        <div className="absolute top-[-80px] right-[-80px] w-[400px] h-[400px] bg-purple-100/40 dark:bg-purple-900/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] bg-blue-100/40 dark:bg-blue-900/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="hidden lg:block">
          <FloatingShape delay={0} x="5%" y="10%" size="w-28 h-28">
            <Zap className="w-10 h-10 text-purple-500" />
          </FloatingShape>
          <FloatingShape delay={2} x="88%" y="35%" size="w-24 h-24">
            <TrendingUp className="w-9 h-9 text-blue-500" />
          </FloatingShape>
          <FloatingShape delay={4} x="10%" y="65%" size="w-24 h-24">
            <Star className="w-9 h-9 text-amber-500" />
          </FloatingShape>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-20"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-full mb-4">
              <Zap className="w-3.5 h-3.5" /> Porquê o Kalie?
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              O teu mundo digital{" "}
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">num só lugar</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Joga, vende, conecta-te e cresce com o Kalie.
            </p>
          </motion.div>

          <div className="space-y-16 lg:space-y-24">
            {[
              {
                headline: "Ganha enquanto te divertes",
                desc: "Joga xadrez, damas e participa em torneios. Cada vitória tua vira recompensa de verdade.",
                img: "/images/c4.png",
              },
              {
                headline: "Ajuda quando mais precisas",
                desc: "O SOS Emergencial conecta-te a apoio da comunidade em segundos. Nunca estás sozinho.",
                img: "/images/c5.png",
              },
              {
                headline: "Joga e ganha recompensas",
                desc: "Xadrez, damas, torneios ao vivo. Cada vitória tua vale prémios de verdade dentro do Kalie.",
                img: "/images/c6.png",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-6 lg:gap-10 justify-center items-center`}
              >
                <div className="max-w-[540px] w-full shrink-0">
                  <img src={item.img} alt="" className="w-full h-auto" />
                </div>

                <div>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
                    {item.headline}
                  </h3>
                  <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-24 bg-gradient-to-br from-purple-600 via-purple-700 to-blue-700 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 bottom-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjAgMjB2LTEwSDEwdjEwaDEweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-30" />
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 px-4">
              Pronto para o{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-yellow-200">futuro</span>?
            </h2>
            <p className="text-lg sm:text-xl text-purple-200 mb-8 max-w-2xl mx-auto px-4">
              Junta-te a milhares de pessoas que já estão na lista de espera
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-8 py-4 bg-white text-purple-700 dark:text-purple-600 font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-50 transition-all transform hover:scale-105 inline-flex items-center gap-2 shadow-xl"
            >
              Inscrever-se agora
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      <footer className="px-6 py-10 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8"><KalieLogo /></div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent" style={{ fontFamily: "'Orbitron', sans-serif" }}>Kalie</span>
          </div>
          <p className="text-gray-400 dark:text-gray-500 text-sm">© 2026 Kalie. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <a href="#" className="text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition text-sm font-medium">Privacidade</a>
            <a href="#" className="text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition text-sm font-medium">Termos</a>
            <a href="#" className="text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition text-sm font-medium">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}