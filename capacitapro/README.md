# CapacitaPro LMS — Plataforma de Formación Empresarial

LMS empresarial multi-tenant B2B construido con **Next.js 15 (App Router, Server Actions, TypeScript estricto)**, **Tailwind CSS + shadcn/ui** y **Supabase (Auth, PostgreSQL con RLS y Storage)**, listo para desplegar en **Vercel**.

## 1. Configuración en Supabase
1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Abrí **SQL Editor** y ejecutá el contenido completo de:
   - `supabase/migrations/20261119000000_init_capacitapro.sql`
3. Luego ejecutá el archivo de datos iniciales:
   - `supabase/seed.sql`
4. Usuarios demo creados por `seed.sql` (clave para todos: `CapacitaPro2026!`):
   - `superadmin@capacitapro.demo` — Super Admin
   - `rrhh@capacitapro.demo` — Admin de Empresa (RRHH)
   - `instructor@capacitapro.demo` — Instructor
   - `alumno@capacitapro.demo` — Alumno / Empleado

> Si preferís crear tu propio usuario en **Authentication → Users**, ejecutá luego en SQL Editor:
> ```sql
> SELECT public.assign_demo_role_and_enroll('tu@email.com', 'super_admin');
> ```

## 2. Variables de Entorno
Copiá `.env.example` a `.env.local` (o cargalas en Vercel → Settings → Environment Variables):
```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=https://tu-campus.vercel.app
```

## 3. Desarrollo Local
```bash
npm install
npm run dev
```

## 4. Despliegue en Vercel y Conexión con la Landing Page
1. En Vercel, importá el repositorio y configurá **Root Directory** = `capacitapro`.
2. Cargá las 4 variables de entorno anteriores y desplegá.
3. En la landing page de Solution Academy (`/app.js`), actualizá `ACADEMY_CONFIG.lmsLoginUrl` con tu URL de Vercel (por ejemplo `https://campus-solution-academy.vercel.app/login`).

