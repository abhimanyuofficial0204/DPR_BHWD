"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, User, RefreshCw, KeyRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState("operator"); // "operator" or "manager"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Simulate login and redirect based on role
    setTimeout(() => {
      setLoading(false);
      if (role === "operator") {
        router.push("/entry");
      } else {
        router.push("/dashboard");
      }
    }, 800);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      {/* Background visual glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-mintGreen/5 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md p-8 glass-panel rounded-2xl relative overflow-hidden"
      >
        {/* Top card accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-mintGreen to-blue-500" />
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-mintGreen/15 border border-mintGreen/30 rounded-2xl flex items-center justify-center mb-4 text-mintGreen shadow-lg shadow-mintGreen/10">
            <KeyRound size={28} className="animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide font-sans">Sharp Mint</h1>
          <p className="text-gray-400 text-sm mt-1">QC & DPR Production Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Role selector buttons */}
          <div className="grid grid-cols-2 gap-3 p-1 bg-black/40 border border-white/5 rounded-xl">
            <button
              type="button"
              onClick={() => setRole("operator")}
              className={`py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                role === "operator"
                  ? "bg-mintGreen/20 border border-mintGreen/30 text-mintGreen shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Vinod (Operator)
            </button>
            <button
              type="button"
              onClick={() => setRole("manager")}
              className={`py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                role === "manager"
                  ? "bg-mintGreen/20 border border-mintGreen/30 text-mintGreen shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Management
            </button>
          </div>

          {/* Username input */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-medium tracking-wider uppercase">User ID</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <User size={18} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={role === "operator" ? "vinod_operator" : "management_admin"}
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl glass-input"
                required
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-medium tracking-wider uppercase">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Lock size={18} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl glass-input"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center font-medium bg-red-950/20 border border-red-500/30 p-3 rounded-xl">
              {error}
            </p>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-mintGreen text-black font-semibold rounded-xl hover:from-cyan-400 hover:to-mintHover shadow-lg shadow-mintGreen/15 transition-all duration-300 flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <RefreshCw size={18} className="animate-spin-fast" />
            ) : (
              "Sign In"
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
