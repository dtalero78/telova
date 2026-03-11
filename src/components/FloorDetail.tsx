"use client";

import { Floor, getCategoryColor, CATEGORIES } from "@/lib/types";
import { motion } from "framer-motion";

interface FloorDetailProps {
  floor: Floor;
  onClose: () => void;
  onDeleteEvent: (eventId: string) => void;
}

export default function FloorDetail({
  floor,
  onClose,
  onDeleteEvent,
}: FloorDetailProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-600 shadow-2xl max-h-[80vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{floor.label}</h2>
            <p className="text-slate-400 text-sm">{floor.ageRange}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {floor.events.length === 0 ? (
          <p className="text-slate-500 text-center py-8 italic">
            No hay eventos en este piso aún
          </p>
        ) : (
          <div className="space-y-3">
            {floor.events.map((event) => {
              const catColor = getCategoryColor(event.category);
              const catLabel = CATEGORIES.find(
                (c) => c.value === event.category
              )?.label;

              return (
                <div
                  key={event.id}
                  className="bg-slate-700/50 rounded-lg p-4 border-l-4"
                  style={{ borderColor: catColor }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-sm">
                        {event.title}
                      </h3>
                      {event.description && (
                        <p className="text-slate-400 text-xs mt-1">
                          {event.description}
                        </p>
                      )}
                      {event.reflection && (
                        <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-md p-2.5">
                          <p className="text-amber-300 text-xs font-medium mb-0.5">
                            Reflexión
                          </p>
                          <p className="text-slate-300 text-xs italic">
                            {event.reflection}
                          </p>
                        </div>
                      )}
                      <div className="flex gap-3 mt-2 text-xs">
                        <span
                          className="px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: catColor }}
                        >
                          {catLabel}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            event.impact_type === "positivo"
                              ? "bg-emerald-600 text-white"
                              : event.impact_type === "negativo"
                              ? "bg-red-600 text-white"
                              : "bg-slate-600 text-white"
                          }`}
                        >
                          {event.impact_type} · {event.impact}/10
                        </span>
                        <span className="text-slate-500">
                          {new Date(event.event_date).toLocaleDateString(
                            "es-CO"
                          )}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteEvent(event.id)}
                      className="text-slate-500 hover:text-red-400 text-sm ml-2"
                      title="Eliminar"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
