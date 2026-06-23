import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      <div className="w-full max-w-[935px] flex gap-8 items-center">
        {/* Left: Phone mockup */}
        <div className="hidden lg:flex flex-1 justify-center">
          <div className="relative w-[380px]">
            {/* Phone frame */}
            <div className="relative z-10 rounded-[3rem] border-[4px] border-gray-900 bg-white overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[25px] bg-gray-900 rounded-b-2xl z-20" />
              <div className="pt-[30px] px-2 pb-2 bg-white">
                <div className="aspect-[9/19] bg-gradient-to-b from-purple-50 to-blue-50 rounded-[1.8rem] overflow-hidden flex items-center justify-center">
                  <div className="text-center px-4">
                    <div className="w-14 h-14 mx-auto mb-4">
                      <img src="/images/games/logo.jpeg" alt="Kalie" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                      Kalie
                    </p>
                    <p className="text-xs text-gray-400 mt-2">O Super App de Angola</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Reflection shadow */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[90%] h-8 bg-gradient-to-b from-black/10 to-transparent blur-xl rounded-full" />
          </div>
        </div>

        {/* Right: Form */}
        <div className="flex-1 max-w-[400px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
