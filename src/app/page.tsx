"use client";

import { useEffect, useState, useCallback } from "react";
import Onboarding from "@/components/Onboarding";
import EventForm from "@/components/EventForm";
import Building from "@/components/Building";
import FloorDetail from "@/components/FloorDetail";
import { CapasEvent, CapasUser, Floor, CATEGORIES, Category, BuildingAnalysis } from "@/lib/types";
import { buildFloors } from "@/lib/floors";

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<CapasUser | null>(null);
  const [events, setEvents] = useState<CapasEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [filterCategory, setFilterCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<BuildingAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const loadUser = useCallback(async (id: string) => {
    const res = await fetch(`/api/users?id=${id}`);
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      return data;
    }
    return null;
  }, []);

  const loadEvents = useCallback(async (id: string) => {
    const res = await fetch(`/api/events?user_id=${id}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data);
    }
  }, []);

  useEffect(() => {
    const storedId = localStorage.getItem("capas_user_id");
    if (storedId) {
      setUserId(storedId);
      Promise.all([loadUser(storedId), loadEvents(storedId)]).then(() =>
        setLoading(false)
      );
    } else {
      setLoading(false);
    }
  }, [loadUser, loadEvents]);

  const handleOnboardingComplete = async (id: string) => {
    setUserId(id);
    await loadUser(id);
    setLoading(false);
  };

  const handleEventAdded = () => {
    if (userId) loadEvents(userId);
  };

  const handleDeleteEvent = async (eventId: string) => {
    await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    if (userId) loadEvents(userId);
    setSelectedFloor(null);
  };

  const handleAnalyzeBuilding = async () => {
    if (!user || events.length === 0) return;
    setAnalyzing(true);
    try {
      const currentFloors = buildFloors(events, user.birth_date);
      const res = await fetch("/api/analyze-building", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floors: currentFloors.map((f) => ({
            label: f.label,
            ageRange: f.ageRange,
            events: f.events.map((e) => ({
              title: e.title,
              description: e.description,
              impact: e.impact,
              impact_type: e.impact_type,
              category: e.category,
              event_date: e.event_date,
            })),
            health: f.health,
            stability: f.stability,
            damageGrade: f.damageGrade,
          })),
          birthDate: user.birth_date,
        }),
      });
      if (res.ok) {
        const analysis = await res.json();
        setAiAnalysis(analysis);
      }
    } catch (err) {
      console.error("Error analyzing building:", err);
    }
    setAnalyzing(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("capas_user_id");
    setUserId(null);
    setUser(null);
    setEvents([]);
    setAiAnalysis(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="text-slate-400 animate-pulse text-lg">Cargando...</div>
      </div>
    );
  }

  if (!userId || !user) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const filteredEvents = filterCategory
    ? events.filter((e) => e.category === filterCategory)
    : events;

  const floors = buildFloors(filteredEvents, user.birth_date);

  const totalPositive = events.filter((e) => e.impact_type === "positivo").length;
  const totalNegative = events.filter((e) => e.impact_type === "negativo").length;

  return (
    <div className="h-screen flex flex-col bg-[#FAFAFA] overflow-hidden">
      {/* Header compacto */}
      <header className="border-b border-slate-300 bg-white/95 backdrop-blur-sm z-40 shrink-0">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Telova" className="h-8 w-auto" />
              <div>
                <h1 className="text-lg font-bold leading-tight" style={{ color: "#8c52ff" }}>Capas</h1>
                <p className="text-slate-400 text-[10px]">
                  {user.name}
                </p>
              </div>
            </div>

            {/* Stats inline */}
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-500">
                <span className="text-slate-800 font-bold">{events.length}</span> eventos
              </span>
              <span className="text-emerald-600">
                <span className="font-bold">{totalPositive}</span> +
              </span>
              <span className="text-red-600">
                <span className="font-bold">{totalNegative}</span> -
              </span>
            </div>

            {/* Filtros inline */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterCategory(null)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  filterCategory === null
                    ? "bg-slate-800 text-white"
                    : "bg-slate-200 text-slate-500 hover:text-slate-700"
                }`}
              >
                Todas
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() =>
                    setFilterCategory(
                      filterCategory === cat.value ? null : cat.value
                    )
                  }
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    filterCategory === cat.value
                      ? "text-white ring-1 ring-white/50"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                  style={{
                    backgroundColor:
                      filterCategory === cat.value ? cat.color : cat.color + "18",
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {events.length > 0 && (
              <button
                onClick={handleAnalyzeBuilding}
                disabled={analyzing}
                className="px-3 py-1.5 text-xs font-medium rounded transition-colors text-white"
                style={{
                  backgroundColor: aiAnalysis ? "#8c52ff33" : "#8c52ff",
                  color: aiAnalysis ? "#8c52ff" : "white",
                }}
              >
                {analyzing ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analizando...
                  </span>
                ) : aiAnalysis ? (
                  "Re-analizar IA"
                ) : (
                  "Analizar con IA"
                )}
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-1.5 text-white text-xs font-medium rounded transition-colors hover:opacity-90"
              style={{ backgroundColor: "#00bf63" }}
            >
              + Nuevo recuerdo
            </button>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-slate-600 text-[10px]"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Building - ocupa todo el espacio restante */}
      <main className="flex-1 min-h-0 overflow-auto p-2">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="text-6xl mb-4">🏗️</div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              Tu edificio está vacío
            </h2>
            <p className="text-slate-500 mb-6 text-sm">
              Agrega tu primer recuerdo para comenzar a construir
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
            >
              Agregar primer recuerdo
            </button>
          </div>
        ) : (
          <div className="h-full">
            <Building floors={floors} onFloorClick={setSelectedFloor} aiAnalysis={aiAnalysis} />
          </div>
        )}
      </main>

      {/* Modals */}
      {showForm && (
        <EventForm
          userId={userId}
          userBirthDate={user.birth_date}
          existingEvents={events.map((e) => ({
            title: e.title,
            impact_type: e.impact_type,
            impact: e.impact,
            category: e.category,
            event_date: e.event_date,
          }))}
          onEventAdded={handleEventAdded}
          onClose={() => setShowForm(false)}
        />
      )}

      {selectedFloor && (
        <FloorDetail
          floor={selectedFloor}
          onClose={() => setSelectedFloor(null)}
          onDeleteEvent={handleDeleteEvent}
        />
      )}
    </div>
  );
}
