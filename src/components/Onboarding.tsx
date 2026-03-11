"use client";

import { useState } from "react";

interface OnboardingProps {
  onComplete: (userId: string) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, birth_date: birthDate }),
    });

    const user = await res.json();
    localStorage.setItem("capas_user_id", user.id);
    onComplete(user.id);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="bg-slate-700/50 backdrop-blur-sm rounded-2xl p-8 w-full max-w-md shadow-2xl border border-slate-600">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Telova" className="h-16 w-auto mx-auto mb-3" />
          <p className="text-slate-300 text-sm">
            Descubre las capas que construyeron quien eres
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              ¿Cómo te llamas?
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tu nombre"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              ¿Cuándo naciste?
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name || !birthDate}
            className="w-full py-3 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
            style={{ backgroundColor: "#8c52ff" }}
          >
            {loading ? "Creando..." : "Comenzar a construir"}
          </button>
        </form>
      </div>
    </div>
  );
}
