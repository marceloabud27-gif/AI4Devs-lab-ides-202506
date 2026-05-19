# Biblia en Contexto

Web app en español para estudiar la Biblia en su contexto histórico, literario y gramatical, con respuestas claras y fáciles de entender.

## Idea central

Biblia en Contexto ayuda a una persona a escribir un versículo, pasaje, palabra bíblica o pregunta, y recibir una explicación ordenada con:

- Texto bíblico disponible en la base local.
- Contexto histórico y cultural.
- Género literario y estructura del pasaje.
- Observaciones lingüísticas y léxicas.
- Intertextualidad responsable.
- Patrística y debates teológicos históricos cuando aportan contexto.
- Síntesis exegética en lenguaje sencillo.

La app evita forzar conclusiones dogmáticas modernas. Primero observa el texto, su mundo original y su uso histórico.

## Stack

```text
Frontend: React + Vite + Tailwind CSS
Backend: Express
ORM: Prisma
Base de datos: PostgreSQL en Neon
Deploy: GitHub -> Render
```

## Estructura

```text
Biblia-en-Contexto/
  client/   # Frontend React/Vite/Tailwind
  server/   # API Express + Prisma
```

## Funciones actuales

- Búsqueda y análisis desde una sola caja principal.
- Reconocimiento de referencias bíblicas, palabras y preguntas.
- Consulta local de la Biblia cargada en Neon.
- Explicación histórico-gramatical en español sencillo.
- Marco histórico contextual según el libro o pasaje buscado.
- Secciones de judaísmo del Segundo Templo, literatura judía, historiadores antiguos y evidencia escrita.
- Secciones de patrística, disputas teológicas y síntesis cronológica.
- Preparación para conectar proveedores autorizados de NBLA/LBLA, HALOT/BDAG o IA externa sin guardar textos protegidos en la base.

## Instalación local

Primero instala dependencias del backend:

```bash
cd Biblia-en-Contexto/server
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

En otra terminal levanta el frontend:

```bash
cd Biblia-en-Contexto/client
npm install
npm run dev
```

En Windows PowerShell, si aparece una restricción de scripts, usa `npm.cmd` y `npx.cmd`:

```bash
npm.cmd run dev
npx.cmd prisma generate
```

## Variables de entorno

En `server/.env`:

```env
DATABASE_URL="postgresql://usuario:password@host/db?sslmode=require"
DIRECT_URL="postgresql://usuario:password@host/db?sslmode=require"
PORT=4000
CLIENT_URL="http://127.0.0.1:5173"
AUTH_SECRET="cambia-este-secreto-en-produccion"
BIBLE_PROVIDER_URL=""
BIBLE_PROVIDER_KEY=""
LEXICON_PROVIDER_URL=""
LEXICON_PROVIDER_KEY=""
AI_PROVIDER_URL=""
AI_PROVIDER_KEY=""
```

En `client/.env`:

```env
VITE_API_URL="http://127.0.0.1:4000"
```

Para Neon, copia la cadena de conexión de tu panel y pégala como `DATABASE_URL`.

Si Neon muestra dos cadenas:

- `DATABASE_URL`: conexión pooled para la aplicación.
- `DIRECT_URL`: conexión directa para migraciones de Prisma.

Si Neon solo muestra una, puedes usar la misma temporalmente en ambas variables.

## Preparar Neon

```bash
cd Biblia-en-Contexto/server
npx.cmd prisma migrate dev
npm.cmd run seed
npm.cmd run import:rv1909
```

El importador carga la Reina-Valera 1909 de dominio público desde:

```text
server/prisma/data/spa-rv1909.usfx.xml
```

## Endpoints principales

```text
GET  /api/health
GET  /api/buscar?q=amor
GET  /api/biblia/versiculos?q=amor
POST /api/consulta-versiones
POST /api/lexico-palabra
POST /api/explicar-pasaje
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/notas
GET  /api/notas
```

## NBLA, LBLA, HALOT y BDAG

NBLA, LBLA, HALOT y BDAG son recursos con derechos/licencias. La app está preparada para consultarlos mediante un proveedor autorizado, pero no los copia ni los guarda completos en Neon.

Mientras las variables del proveedor estén vacías, la app trabaja con la Biblia local disponible y muestra análisis propio basado en el método configurado.

## Deploy en Render

El archivo `render.yaml` permite crear:

- `biblia-en-contexto-api`: backend Express.
- `biblia-en-contexto-web`: frontend estático.

Variables necesarias en Render:

```text
DATABASE_URL
DIRECT_URL
CLIENT_URL
AUTH_SECRET
VITE_API_URL
```

Después de desplegar el backend, usa su URL pública como `VITE_API_URL` en el sitio estático.
