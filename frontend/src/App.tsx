import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

// Layouts
import AppLayout from "@/components/layout/AppLayout";
import AuthLayout from "@/components/layout/AuthLayout";

// Auth pages
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import VerifyEmailPage from "@/pages/auth/VerifyEmailPage";

// App pages
import LandingPage from "@/pages/LandingPage";
import FeedPage from "@/pages/FeedPage";
import GamesPage from "@/pages/GamesPage";
import WalletPage from "@/pages/WalletPage";
import RifasPage from "@/pages/RifasPage";
import LeiloesPage from "@/pages/LeiloesPage";
import TorneiosPage from "@/pages/TorneiosPage";
import BisnoPage from "@/pages/BisnoPage";
import MapaPage from "@/pages/MapaPage";
import SOSPage from "@/pages/SOSPage";
import DefinicoesPage from "@/pages/DefinicoesPage";
import AjudaPage from "@/pages/AjudaPage";
import ChessPage from "@/pages/games/ChessPage";
import TicTacToePage from "@/pages/games/TicTacToePage";
import CheckersPage from "@/pages/games/CheckersPage";
import SquidGamePage from "@/pages/games/SquidGamePage";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/entrar" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? <>{children}</> : <Navigate to="/feed" replace />;
}

function HomeRoute() {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/feed" replace /> : <LandingPage />;
}

export default function App() {
  return (
    <Routes>
      {/* Landing Page (raiz — se não logado) */}
      <Route path="/" element={<HomeRoute />} />

      {/* Auth */}
      <Route element={<AuthLayout />}>
        <Route path="/entrar"         element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/registar"       element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/esqueci-senha"  element={<ForgotPasswordPage />} />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="/verificar-email" element={<VerifyEmailPage />} />
      </Route>

      {/* App */}
      <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route path="/feed"      element={<FeedPage />} />
        <Route path="/jogos"     element={<GamesPage />} />
        <Route path="/jogos/xadrez/:challengeId" element={<ChessPage />} />
        <Route path="/jogos/tictactoe/:challengeId" element={<TicTacToePage />} />
        <Route path="/jogos/damas/:challengeId" element={<CheckersPage />} />
        <Route path="/jogos/squid/:code" element={<SquidGamePage />} />
        <Route path="/jogos/squid" element={<SquidGamePage />} />
        <Route path="/torneios"  element={<TorneiosPage />} />
        <Route path="/rifas"     element={<RifasPage />} />
        <Route path="/leiloes"   element={<LeiloesPage />} />
        <Route path="/carteira"  element={<WalletPage />} />
        <Route path="/bisno"     element={<BisnoPage />} />
        <Route path="/mapa"      element={<MapaPage />} />
        <Route path="/sos"       element={<SOSPage />} />
        <Route path="/definicoes" element={<DefinicoesPage />} />
        <Route path="/ajuda"     element={<AjudaPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
