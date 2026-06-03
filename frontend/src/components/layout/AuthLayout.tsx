import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      {/* Background radial gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(0,229,255,0.05) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(191,90,242,0.05) 0%, transparent 60%)",
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-space-grotesk bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500 tracking-tight">
            Kalie
          </h1>
          <p className="text-on-surface-variant text-body-sm mt-1">O Super App de Angola</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
