import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Gamepad2, MessageCircle, Heart, Zap, Shield, Sun, Moon } from "lucide-react";

const FloatingShape = ({ delay, x, y, size, children }: { delay: number; x: string; y: string; size: string; children: React.ReactNode }) => (
  <div
    className="absolute pointer-events-none animate-float will-change-transform"
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

export default function AuthLayout() {
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
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("kalie-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 overflow-hidden flex items-center justify-center transition-colors">
      <style>{`
        .glass {
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.35);
          box-shadow: 0 8px 32px rgba(0,0,0,0.06), inset 0 1.5px 0 rgba(255,255,255,0.7);
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
        .dark .glass {
          background: rgba(30,30,40,0.6);
          border-color: rgba(255,255,255,0.08);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1.5px 0 rgba(255,255,255,0.08);
        }
        .dark .glass::after {
          background: linear-gradient(135deg, rgba(255,60,60,0.06) 0%, transparent 25%, rgba(60,60,255,0.06) 75%);
        }
      `}</style>

      {/* Background gradients */}
      <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] bg-purple-200/40 dark:bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-200px] left-[-200px] w-[500px] h-[500px] bg-blue-200/40 dark:bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Floating shapes */}
      <div className="hidden lg:block">
        <FloatingShape delay={0} x="8%" y="15%" size="w-28 h-28">
          <Gamepad2 className="w-10 h-10 text-purple-500" />
        </FloatingShape>
        <FloatingShape delay={2.5} x="82%" y="10%" size="w-24 h-24">
          <MessageCircle className="w-9 h-9 text-blue-500" />
        </FloatingShape>
        <FloatingShape delay={4} x="85%" y="55%" size="w-20 h-20">
          <Heart className="w-8 h-8 text-pink-500" />
        </FloatingShape>
        <FloatingShape delay={1.5} x="5%" y="65%" size="w-24 h-24">
          <Zap className="w-9 h-9 text-amber-500" />
        </FloatingShape>
        <FloatingShape delay={3} x="48%" y="80%" size="w-16 h-16">
          <Shield className="w-6 h-6 text-cyan-500" />
        </FloatingShape>
      </div>

      {/* Theme toggle */}
      <button onClick={() => setIsDark(!isDark)}
        className="fixed top-6 right-6 z-50 w-10 h-10 rounded-full glass flex items-center justify-center text-gray-600 dark:text-gray-300 hover:scale-110 transition-transform">
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-[420px] px-4"
      >
        <Outlet />
      </motion.div>
    </div>
  );
}
