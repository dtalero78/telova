# Capas — Edificio de Vida

## Proyecto
App de desarrollo personal que visualiza eventos de vida como pisos de un edificio arquitectónico. Usa metáforas de ingeniería civil (fallas estructurales, grietas, estabilidad) combinadas con psicología del desarrollo.

## Tech Stack
- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4)
- **PostgreSQL** en DigitalOcean (tablas con prefijo `capas_`)
- **OpenAI API**: GPT-4o (análisis estructural), DALL-E 3 (fachada)
- **Three.js + React Three Fiber** (vista 3D alternativa)
- **Framer Motion** (animaciones)

## Estructura de archivos clave
```
src/
├── app/
│   ├── page.tsx              # Página principal, estado global, modales
│   ├── layout.tsx            # Layout con fuentes
│   └── api/
│       ├── users/route.ts    # CRUD usuarios
│       ├── events/route.ts   # CRUD eventos (GET, POST)
│       ├── events/[id]/route.ts
│       ├── evaluate/route.ts # IA: evalúa impacto de evento
│       ├── analyze-building/route.ts # IA: análisis estructural completo
│       └── generate-facade/route.ts  # DALL-E: genera imagen fachada
├── components/
│   ├── Building.tsx          # Visualización principal SVG (corte de sección)
│   ├── Building3D.tsx        # Vista 3D alternativa (Three.js)
│   ├── EventForm.tsx         # Formulario de eventos (2 pasos: input → IA)
│   ├── FloorDetail.tsx       # Modal detalle de piso
│   └── Onboarding.tsx        # Registro inicial
└── lib/
    ├── types.ts              # Tipos: Floor, CapasEvent, BuildingAnalysis, etc.
    ├── floors.ts             # Motor de métricas (Park-Ang, ASCE 7, EMS-98)
    └── db.ts                 # Pool PostgreSQL con SSL
```

## Base de datos
- `capas_users`: id (uuid), name, birth_date, created_at
- `capas_events`: id (uuid), user_id, title, description, event_date, category, impact (1-10), impact_type, reflection, created_at
- Test user ID: `191a0c9a-3b5b-4d73-a4a4-21c535368ae9`

## Variables de entorno (.env.local)
- `DATABASE_URL` — PostgreSQL connection string
- `OPENAI_API_KEY` — Para GPT-4o y DALL-E 3

## Convenciones de código
- Idioma de UI y prompts: **español**
- Puerto de desarrollo: **3004**
- El componente `Building.tsx` tiene constantes de configuración `CFG` y estilos `S` al inicio
- Los colores de muros son `#333`, strokes `#222`, particiones `#444`
- Las métricas estructurales usan fórmulas reales de ingeniería civil adaptadas

## Categorías de eventos
Familiar, Sexual, Laboral, Económico, Salud, Social, Espiritual, Educativo

## Pisos del edificio
Cimientos (0-6), Piso 1 (7-12), Piso 2 (13-17), Piso 3 (18-25), Piso 4 (26-35), Piso 5 (36-50), Piso 6 (51-65), Ático (66+)

## Métricas por piso
- **Health**: balance positivo/negativo ajustado por redundancia y fatiga
- **Stability**: herencia entre pisos (60% del piso inferior + 40% propio)
- **Damage Grade**: EMS-98 (DG0-DG4)
- **Failure Types**: asentamiento, cortante, flexión, torsión, pandeo, none

## Reglas importantes
- **NO cambiar múltiples cosas a la vez**. Solo modificar exactamente lo que se pide
- No cambiar colores, escaleras, o estilos a menos que se pida explícitamente
- Verificar visualmente con Playwright MCP antes de confirmar cambios
- El zoom usa `viewBox` en SVG con wheel handler nativo (no React onWheel) para evitar errores de passive event listener
- Las grietas se excluyen del área de escaleras usando SVG `clipPath`
