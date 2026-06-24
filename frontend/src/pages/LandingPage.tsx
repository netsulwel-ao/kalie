import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Users, 
  MessageCircle, 
  Shield, 
  ArrowRight,
  CheckCircle2,
  Star,
  TrendingUp,
  Gamepad2,
  Gift,
  AlertCircle,
  Gavel,
  Trophy,
  MapPin,
  Wallet,
  Clock,
  Heart,
  Share2,
  MessageSquare,
  MoreVertical,
  Mail,
  Phone,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";

const waitlistSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  whatsapp: z.string().min(9, "WhatsApp inválido"),
  interests: z.array(z.string()).optional(),
  referral: z.string().optional(),
});

type WaitlistFormData = z.infer<typeof waitlistSchema>;

// Logo Component
const KalieLogo = () => (
  <img src="/images/games/logo.jpeg" alt="Kalie Logo" className="w-full h-full object-contain" />
);

// Post Card Component
const PostCard = ({ author, image, likes, comments }: { author: string; image: string; likes: number; comments: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
  >
    {/* Post Header */}
    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src={image} alt={author} className="w-10 h-10 rounded-full object-cover" />
        <div>
          <p className="font-semibold text-gray-900 text-sm">{author}</p>
          <p className="text-gray-500 text-xs">há 2 horas</p>
        </div>
      </div>
      <MoreVertical className="w-5 h-5 text-gray-400 cursor-pointer" />
    </div>

    {/* Post Image */}
    {image && (
      <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
        <img src={image} alt="Post" className="w-full h-full object-cover" />
      </div>
    )}

    {/* Post Engagement */}
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-4 text-gray-600">
        <button className="flex items-center gap-1 hover:text-red-500 transition">
          <Heart className="w-5 h-5" />
          <span className="text-sm">{likes}</span>
        </button>
        <button className="flex items-center gap-1 hover:text-blue-500 transition">
          <MessageSquare className="w-5 h-5" />
          <span className="text-sm">{comments}</span>
        </button>
        <button className="flex items-center gap-1 hover:text-green-500 transition">
          <Share2 className="w-5 h-5" />
        </button>
      </div>
      <p className="text-gray-700 text-sm">
        Adorei este momento! 🎉 A comunidade Kalie é incrível!
      </p>
    </div>
  </motion.div>
);

export default function LandingPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistSchema),
  });

  const interests = [
    "Networking",
    "Comunidade",
    "Eventos",
    "Negócios",
    "Aprendizado",
    "Entretenimento"
  ];

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const onSubmit = async (data: WaitlistFormData) => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log({ ...data, interests: selectedInterests });
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="pt-8">
        <div className="flex items-center justify-center px-4">
          <div className="flex items-center justify-between px-8 py-4 rounded-full border border-white/20 bg-white/10 backdrop-blur-xl shadow-xl w-full max-w-7xl">
            {/* Logo - Left */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 text-gray-900">
                <KalieLogo />
              </div>
              <span className="text-2xl font-bold text-gray-900">
                Kalie
              </span>
            </div>

            {/* Inscrever-se Button - Right */}
            <a href="#waitlist"
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:from-purple-700 hover:to-blue-700 transition-all font-semibold text-sm"
            >
              Inscrever-se
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 pt-32 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                Conecte-se de forma
                <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 bg-clip-text text-transparent">
                  {" "}extraordinária
                </span>
              </h1>

              <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-lg">
                Junte-se à revolução das conexões digitais. Kalie é mais que uma rede social — é uma plataforma onde comunidades reais se encontram, colaboram e crescem juntas.
              </p>

              <div className="flex flex-wrap gap-6 mb-12">
                <div className="flex items-center gap-2 text-gray-700">
                  <Users className="w-5 h-5 text-purple-600" />
                  <span className="font-medium">Comunidades ativas</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <MessageCircle className="w-5 h-5 text-pink-600" />
                  <span className="font-medium">Conexões reais</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">100% Seguro</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-100">
                <div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">10K+</div>
                  <div className="text-gray-600 text-sm">Na lista de espera</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">50+</div>
                  <div className="text-gray-600 text-sm">Países</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">4.9</div>
                  <div className="text-gray-600 text-sm">Avaliação</div>
                </div>
              </div>
            </motion.div>

            {/* Right Content - Social Preview */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-4"
            >
              <PostCard author="Sofia Mendes" image="/images/games/beautiful-woman-looking-her-phone.jpg" likes={342} comments={45} />
              <PostCard author="João Silva" image="/images/games/person-using-video-call-phone-talk-colleagues-from-home-entrepreneur-doing-business-meeting-smartphone-with-online-video-conference-waving-mobile-phone-camera-remote-work.jpg" likes={1203} comments={98} />
              <PostCard author="Ana Costa" image="/images/games/intercultural-friends-looking-mobile.jpg" likes={567} comments={72} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Waitlist Form Section */}
      <section id="waitlist" className="px-6 py-20 bg-gradient-to-b from-purple-50 to-white">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-3">
              Garanta seu lugar na revolução
            </h2>
            <p className="text-gray-600 text-lg">
              Seja um dos primeiros a experimentar o futuro das redes sociais
            </p>
          </motion.div>

          {!isSubmitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-gray-100 relative overflow-hidden"
            >
              {/* subtle top gradient */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500" />

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-900">
                      Nome
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        {...register("name")}
                        type="text"
                        placeholder="Seu nome"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all hover:border-gray-300"
                      />
                    </div>
                    {errors.name && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-900">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        {...register("email")}
                        type="email"
                        placeholder="seu@email.com"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all hover:border-gray-300"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-900">
                    WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      {...register("whatsapp")}
                      type="tel"
                      placeholder="+244 9XX XXX XXX"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 focus:bg-white transition-all"
                    />
                  </div>
                  {errors.whatsapp && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.whatsapp.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-900">
                    Interesses <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          selectedInterests.includes(interest)
                            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md shadow-purple-200"
                            : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-900">
                    Código de indicação <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <Gift className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      {...register("referral")}
                      type="text"
                      placeholder="Código se foi indicado"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Processando...</span>
                  ) : (
                    <>
                      Entrar na lista de espera
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <p className="text-center text-gray-400 text-xs">
                  Ao se inscrever, você concorda com nossos <a href="#" className="text-purple-600 hover:underline">Termos de Serviço</a> e <a href="#" className="text-purple-600 hover:underline">Política de Privacidade</a>
                </p>
              </form>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-3xl p-12 shadow-lg border border-gray-100 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle2 className="w-10 h-10 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Você está na lista! 🎉
              </h2>
              <p className="text-gray-600 mb-6">
                Obrigado por se juntar à revolução Kalie. Enviaremos um email assim que estivermos prontos para você.
              </p>
              <div className="flex items-center justify-center gap-2 text-purple-600 font-semibold">
                <TrendingUp className="w-5 h-5" />
                <span>Sua posição: #{Math.floor(Math.random() * 1000) + 1}</span>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section id="descobrir" className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Por que escolher o Kalie?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Recursos inovadores que transformam a forma como você se conecta online
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Gamepad2 className="w-8 h-8" />,
                title: "Jogos Desafiadores",
                description: "Xadrez, Damas, Tic-Tac-Toe e Squid Game. Desafie amigos e ganhe recompensas",
                color: "from-purple-500 to-purple-600",
                bgColor: "bg-purple-50"
              },
              {
                icon: <Clock className="w-8 h-8" />,
                title: "Bisnos Rápidos",
                description: "Negócios do dia a dia em tempo real. Compre, venda e troque instantaneamente",
                color: "from-cyan-500 to-cyan-600",
                bgColor: "bg-cyan-50"
              },
              {
                icon: <Gift className="w-8 h-8" />,
                title: "Sorteios Exclusivos",
                description: "Participe de rifas e sorteios com prêmios incríveis. Mais chances, mais ganhos",
                color: "from-yellow-500 to-orange-500",
                bgColor: "bg-yellow-50"
              },
              {
                icon: <AlertCircle className="w-8 h-8" />,
                title: "SOS Emergencial",
                description: "Sistema de ajuda rápida em emergências. Conecte-se com apoio instantâneo",
                color: "from-red-500 to-red-600",
                bgColor: "bg-red-50"
              },
              {
                icon: <Gavel className="w-8 h-8" />,
                title: "Leilões ao Vivo",
                description: "Leilões em tempo real com itens exclusivos. Dê lances e ganhe produtos únicos",
                color: "from-blue-500 to-blue-600",
                bgColor: "bg-blue-50"
              },
              {
                icon: <Trophy className="w-8 h-8" />,
                title: "Torneios Épicos",
                description: "Compita em torneios de jogos e atividades. Suba no ranking e seja o campeão",
                color: "from-emerald-500 to-emerald-600",
                bgColor: "bg-emerald-50"
              },
              {
                icon: <MapPin className="w-8 h-8" />,
                title: "Mapa Interativo",
                description: "Descubra eventos, negócios e pessoas próximas. Conexões geolocalizadas",
                color: "from-indigo-500 to-purple-600",
                bgColor: "bg-indigo-50"
              },
              {
                icon: <Wallet className="w-8 h-8" />,
                title: "Carteira Digital",
                description: "Gerencie suas transações, receba pagamentos e controle seu saldo na plataforma",
                color: "from-teal-500 to-cyan-600",
                bgColor: "bg-teal-50"
              },
              {
                icon: <Users className="w-8 h-8" />,
                title: "Comunidades Ativas",
                description: "Encontre pessoas com interesses similares e construa conexões significativas",
                color: "from-pink-500 to-purple-600",
                bgColor: "bg-pink-50"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`group p-6 ${feature.bgColor} rounded-2xl border border-gray-200 hover:border-gray-300 transition-all hover:shadow-lg`}
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-white shadow-md`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-4xl font-bold text-white mb-4">
              Pronto para o futuro?
            </h2>
            <p className="text-xl text-purple-100 mb-8">
              Junte-se a milhares de pessoas que já estão na lista de espera
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-8 py-4 bg-white text-purple-600 font-semibold rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 inline-flex items-center gap-2"
            >
              Inscrever-se agora
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 text-gray-900">
              <KalieLogo />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Kalie
            </span>
          </div>
          <p className="text-gray-600 text-sm">
            © 2026 Kalie. Todos os direitos reservados.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-gray-600 hover:text-purple-600 transition text-sm font-medium">Privacidade</a>
            <a href="#" className="text-gray-600 hover:text-purple-600 transition text-sm font-medium">Termos</a>
            <a href="#" className="text-gray-600 hover:text-purple-600 transition text-sm font-medium">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
