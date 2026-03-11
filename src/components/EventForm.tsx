"use client";

import { useState } from "react";
import { CATEGORIES, Category, ImpactType } from "@/lib/types";

interface EventFormProps {
  userId: string;
  userBirthDate: string;
  existingEvents: { title: string; impact_type: string; impact: number; category: string; event_date: string }[];
  onEventAdded: () => void;
  onClose: () => void;
}

interface AiSuggestion {
  category: Category;
  impact: number;
  impact_type: ImpactType;
  reasoning: string;
}

export default function EventForm({
  userId,
  userBirthDate,
  existingEvents,
  onEventAdded,
  onClose,
}: EventFormProps) {
  // Step 1: User input
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [reflection, setReflection] = useState("");

  // Step 2: AI suggestion + user adjustment
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [category, setCategory] = useState<Category>("familiar");
  const [impact, setImpact] = useState(5);
  const [impactType, setImpactType] = useState<ImpactType>("neutro");

  const [evaluating, setEvaluating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          eventDate,
          userBirthDate,
          existingEvents,
        }),
      });

      if (res.ok) {
        const suggestion: AiSuggestion = await res.json();
        setAiSuggestion(suggestion);
        setCategory(suggestion.category);
        setImpact(suggestion.impact);
        setImpactType(suggestion.impact_type);
        setStep(2);
      } else {
        // Fallback: go to step 2 without suggestion
        setStep(2);
      }
    } catch {
      setStep(2);
    }
    setEvaluating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        title,
        description,
        event_date: eventDate,
        category,
        impact,
        impact_type: impactType,
        reflection,
      }),
    });
    setSaving(false);
    onEventAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-600 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">
              {step === 1 ? "Nuevo Recuerdo" : "Evaluacion IA"}
            </h2>
            {step === 2 && (
              <p className="text-slate-400 text-xs mt-1">
                Ajusta la sugerencia si lo deseas
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            x
          </button>
        </div>

        {step === 1 ? (
          /* ═══════════════ STEP 1: Describe the event ═══════════════ */
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Titulo del evento
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Ausencia de mi padre"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Descripcion / Recuerdo
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Describe lo que recuerdas de este evento... Mientras mas detalle, mejor la evaluacion."
                rows={4}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Fecha del evento
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-amber-300 mb-1">
                Reflexion
              </label>
              <p className="text-slate-500 text-xs mb-2">
                Como te afecta hoy? Que aprendiste?
              </p>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-700 border border-amber-500/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                placeholder="Tomate un momento para reflexionar..."
                rows={3}
              />
            </div>

            <button
              onClick={handleEvaluate}
              disabled={evaluating || !title || !eventDate}
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {evaluating ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analizando con IA...
                </>
              ) : (
                "Evaluar con IA"
              )}
            </button>

            <button
              onClick={() => setStep(2)}
              disabled={!title || !eventDate}
              className="w-full py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Evaluar manualmente
            </button>
          </div>
        ) : (
          /* ═══════════════ STEP 2: Review & adjust ═══════════════ */
          <div className="space-y-5">
            {/* Event summary */}
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <p className="text-white font-medium text-sm">{title}</p>
              {description && (
                <p className="text-slate-400 text-xs mt-1 line-clamp-2">
                  {description}
                </p>
              )}
              <p className="text-slate-500 text-xs mt-1">{eventDate}</p>
            </div>

            {/* AI Reasoning */}
            {aiSuggestion && (
              <div className="bg-violet-900/30 border border-violet-500/30 rounded-lg p-3">
                <p className="text-violet-300 text-xs font-medium mb-1">
                  Razonamiento del agente IA:
                </p>
                <p className="text-violet-100/80 text-sm leading-relaxed">
                  {aiSuggestion.reasoning}
                </p>
              </div>
            )}

            {/* Impact type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tipo de impacto
                {aiSuggestion && (
                  <span className="text-violet-400 text-xs ml-2">
                    (IA sugirio: {aiSuggestion.impact_type})
                  </span>
                )}
              </label>
              <div className="flex gap-3">
                {[
                  { value: "positivo" as ImpactType, label: "Positivo", emoji: "+" },
                  { value: "neutro" as ImpactType, label: "Neutro", emoji: "o" },
                  { value: "negativo" as ImpactType, label: "Negativo", emoji: "-" },
                ].map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setImpactType(opt.value)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                      impactType === opt.value
                        ? opt.value === "positivo"
                          ? "bg-emerald-600 border-emerald-400 text-white"
                          : opt.value === "negativo"
                          ? "bg-red-600 border-red-400 text-white"
                          : "bg-slate-600 border-slate-400 text-white"
                        : "bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Categoria
                {aiSuggestion && (
                  <span className="text-violet-400 text-xs ml-2">
                    (IA sugirio: {aiSuggestion.category})
                  </span>
                )}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      category === cat.value
                        ? "ring-2 ring-white text-white scale-105"
                        : "text-white/70 hover:text-white"
                    }`}
                    style={{
                      backgroundColor:
                        category === cat.value ? cat.color : cat.color + "33",
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Impact slider */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Impacto:{" "}
                <span className="text-white font-bold text-lg">{impact}</span>
                /10
                {aiSuggestion && (
                  <span className="text-violet-400 text-xs ml-2">
                    (IA sugirio: {aiSuggestion.impact}/10)
                  </span>
                )}
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={impact}
                onChange={(e) => setImpact(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Leve</span>
                <span>Moderado</span>
                <span>Intenso</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg transition-colors"
              >
                Atras
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              >
                {saving ? "Guardando..." : "Guardar recuerdo"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
