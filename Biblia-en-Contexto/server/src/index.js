import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { z } from 'zod';
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT ?? 4000;
const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
const authSecret = process.env.AUTH_SECRET ?? 'dev-secret-change-me';
const bibleProviderUrl = process.env.BIBLE_PROVIDER_URL;
const bibleProviderKey = process.env.BIBLE_PROVIDER_KEY;
const lexiconProviderUrl = process.env.LEXICON_PROVIDER_URL;
const lexiconProviderKey = process.env.LEXICON_PROVIDER_KEY;
const allowedOrigins = new Set([
  clientUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
]);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  }
}));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/salud', (_req, res) => {
  res.json({
    ok: true,
    nombre: 'Biblia en Contexto API',
    mensaje: 'API lista para servir estudios bíblicos en español'
  });
});

const authSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(120)
});

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, storedHash] = passwordHash.split(':');
  if (!salt || !storedHash) return false;
  const hash = pbkdf2Sync(password, salt, 120000, 64, 'sha512');
  return timingSafeEqual(Buffer.from(storedHash, 'hex'), hash);
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', authSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token) {
  const [body, signature] = token?.split('.') ?? [];
  if (!body || !signature) return null;
  const expected = createHmac('sha256', authSecret).update(body).digest('base64url');
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
}

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const payload = verifyToken(token);
  if (!payload?.userId) {
    return res.status(401).json({ mensaje: 'Sesión requerida' });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, role: true }
  });

  if (!user) {
    return res.status(401).json({ mensaje: 'Usuario no encontrado' });
  }

  req.user = user;
  next();
}

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const data = authSchema.required({ name: true }).parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ mensaje: 'Ese correo ya está registrado' });
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: hashPassword(data.password)
      },
      select: { id: true, name: true, email: true, role: true }
    });

    res.status(201).json({
      user,
      token: signToken({ userId: user.id })
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const data = authSchema.omit({ name: true }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      return res.status(401).json({ mensaje: 'Correo o contraseña inválidos' });
    }

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: signToken({ userId: user.id })
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

app.get('/api/eventos', async (_req, res, next) => {
  try {
    const eventos = await prisma.chronologicalEvent.findMany({
      orderBy: { order: 'asc' },
      include: {
        passages: {
          orderBy: { order: 'asc' },
          include: { passage: true }
        }
      }
    });
    res.json(eventos);
  } catch (error) {
    next(error);
  }
});

app.get('/api/pasajes/:reference', async (req, res, next) => {
  try {
    const passage = await prisma.passage.findUnique({
      where: { reference: req.params.reference },
      include: {
        exegesisStudies: true,
        resources: true,
        glossaryLinks: { include: { glossaryTerm: true } }
      }
    });

    if (!passage) {
      return res.status(404).json({ mensaje: 'Pasaje no encontrado' });
    }

    res.json(passage);
  } catch (error) {
    next(error);
  }
});

function normalizeTerm(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function searchTerms(value) {
  const normalized = normalizeTerm(value);
  const terms = new Set([value.toString().trim(), normalized]);
  const suffixes = ['aciones', 'acion', 'ccion', 'ciones', 'mente', 'ados', 'adas', 'ido', 'ida', 'es', 'os', 'as', 'ar', 'er', 'ir', 's'];

  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length + 3) {
      terms.add(normalized.slice(0, -suffix.length));
    }
  }

  return Array.from(terms).filter(Boolean);
}

function bibleSearchWhere(query) {
  const terms = searchTerms(query);
  return {
    OR: terms.flatMap((term) => [
      { reference: { contains: term, mode: 'insensitive' } },
      { book: { contains: term, mode: 'insensitive' } },
      { keywords: { has: normalizeTerm(term) } },
      ...(term.length >= 5 ? [{ text: { contains: term, mode: 'insensitive' } }] : [])
    ])
  };
}

async function queryAuthorizedBibleProvider({ version, reference, question }) {
  if (!bibleProviderUrl || !bibleProviderKey) {
    return null;
  }

  const response = await fetch(bibleProviderUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${bibleProviderKey}`
    },
    body: JSON.stringify({ version, reference, question })
  });

  if (!response.ok) {
    throw new Error(`Proveedor bíblico respondió ${response.status}`);
  }

  return response.json();
}

async function queryAuthorizedLexiconProvider({ word, testament }) {
  if (!lexiconProviderUrl || !lexiconProviderKey) {
    return null;
  }

  const response = await fetch(lexiconProviderUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${lexiconProviderKey}`
    },
    body: JSON.stringify({ word, testament, lexicons: ['HALOT', 'BDAG'] })
  });

  if (!response.ok) {
    throw new Error(`Proveedor léxico respondió ${response.status}`);
  }

  return response.json();
}

function lexicalRowsForPassage(verses) {
  const text = verses.map((verse) => normalizeTerm(verse.text)).join(' ');
  const rows = [];

  if (text.includes('predestin')) {
    rows.push({
      lemma: 'proorizo (griego)',
      semantics: 'Decidir o marcar de antemano un destino o propósito.',
      contextualUse: 'En Romanos 8:29 apunta al propósito de Dios de conformar a su pueblo a la imagen de su Hijo.',
      syntax: 'Verbo usado dentro de una cadena de acciones: conocer, predestinar, llamar, justificar y glorificar.'
    });
  }

  if (text.includes('conocio') || text.includes('conoció')) {
    rows.push({
      lemma: 'proginosko (griego)',
      semantics: 'Conocer de antemano; en contexto puede indicar relación previa, no solo información previa.',
      contextualUse: 'La frase “antes conoció” introduce el fundamento de la acción divina posterior.',
      syntax: 'Verbo principal coordinado con “predestinó”.'
    });
  }

  if (text.includes('hijo')) {
    rows.push({
      lemma: 'huios (griego)',
      semantics: 'Hijo; puede señalar identidad, relación y representación familiar.',
      contextualUse: 'Cristo aparece como modelo de la transformación del creyente.',
      syntax: 'Sustantivo dentro de la frase “imagen de su Hijo”.'
    });
  }

  if (!rows.length) {
    rows.push({
      lemma: 'Por confirmar en texto original',
      semantics: 'La palabra clave debe revisarse en hebreo/arameo o griego según el testamento.',
      contextualUse: 'El sentido se determina primero por el pasaje inmediato.',
      syntax: 'La función gramatical depende de la forma concreta en el texto original.'
    });
  }

  return rows;
}

function verseScopeLabel(verses) {
  if (!verses.length) return 'la consulta';
  const first = verses[0];
  const last = verses.at(-1);
  if (verses.length === 1) return first.reference;
  if (first.book === last.book && first.chapter === last.chapter) {
    return `${first.book} ${first.chapter}:${first.verse}-${last.verse}`;
  }
  return `${first.reference} - ${last.reference}`;
}

function clearVerseText(verse) {
  return readableSpanishText(verse.text);
}

function joinedClearText(verses) {
  return verses.map((verse) => `${verse.reference}: ${clearVerseText(verse)}`).join(' ');
}

function genreForBook(book, testament) {
  const normalizedBook = normalizeTerm(book);
  const evangelios = ['mateo', 'marcos', 'lucas', 'juan'];
  const cartas = ['romanos', '1 corintios', '2 corintios', 'galatas', 'efesios', 'filipenses', 'colosenses', '1 tesalonicenses', '2 tesalonicenses', '1 timoteo', '2 timoteo', 'tito', 'filemon', 'hebreos', 'santiago', '1 pedro', '2 pedro', '1 juan', '2 juan', '3 juan', 'judas'];
  const poesia = ['job', 'salmos', 'proverbios', 'eclesiastes', 'cantares'];
  const profetas = ['isaias', 'jeremias', 'lamentaciones', 'ezequiel', 'daniel', 'oseas', 'joel', 'amos', 'abdias', 'jonas', 'miqueas', 'nahum', 'habacuc', 'sofonias', 'hageo', 'zacarias', 'malaquias'];
  const tora = ['genesis', 'exodo', 'levitico', 'numeros', 'deuteronomio'];

  if (evangelios.includes(normalizedBook)) {
    return 'evangelio narrativo-teológico: cuenta hechos y enseñanzas de Jesús, pero también organiza el material para mostrar identidad, autoridad y respuesta de fe.';
  }
  if (cartas.includes(normalizedBook)) {
    return 'carta apostólica: argumento pastoral dirigido a una comunidad real. Conviene seguir la lógica del párrafo, no aislar una frase.';
  }
  if (poesia.includes(normalizedBook)) {
    return 'poesía o sabiduría: usa paralelismo, imagen, lamento, oración o enseñanza breve. No se lee como prosa técnica moderna.';
  }
  if (profetas.includes(normalizedBook)) {
    return 'profecía: combina denuncia, llamado al pacto, juicio, esperanza y lenguaje simbólico. Hay que ubicar oráculo, audiencia y crisis histórica.';
  }
  if (tora.includes(normalizedBook)) {
    return 'Torá: narración fundacional, ley, pacto, genealogía o instrucción. La estructura suele formar identidad comunitaria y memoria del pueblo.';
  }
  if (normalizedBook === 'apocalipsis') {
    return 'apocalíptica profética: usa visiones, símbolos y contraste entre imperios, juicio y esperanza. No debe reducirse a un cronograma moderno.';
  }
  return testament === 'Nuevo Testamento'
    ? 'texto del Nuevo Testamento: debe leerse dentro del argumento del libro y el mundo judío-grecorromano del siglo I.'
    : 'texto del Antiguo Testamento: debe leerse dentro de la historia de Israel, pacto, culto, tierra, sabiduría o profecía según el libro.';
}

function bookArgumentContext(book, chapter) {
  const normalizedBook = normalizeTerm(book);

  if (normalizedBook === 'efesios') {
    if (chapter === 4) {
      return 'Dentro de la carta, Efesios 4 abre la sección práctica después de Efesios 1-3. Primero la carta explica la gracia de Dios, la reconciliación de judíos y gentiles y la nueva identidad del pueblo en Cristo. Luego Efesios 4 pregunta cómo debe vivir esa comunidad: con unidad, madurez, abandono de la vida vieja y una conducta coherente con la nueva humanidad.';
    }

    return 'En Efesios, los capítulos 1-3 presentan la identidad del creyente y de la iglesia en Cristo; los capítulos 4-6 muestran cómo esa identidad se vive en comunidad, familia, trabajo y resistencia espiritual.';
  }

  if (normalizedBook === 'romanos') {
    if (chapter === 9) {
      return 'Romanos 9 pertenece a la unidad de Romanos 9-11. Pablo acaba de afirmar en Romanos 8 la seguridad del pueblo amado por Dios, y ahora enfrenta una tensión histórica: muchos israelitas no han recibido al Mesías mientras gentiles sí están entrando. La pregunta del capítulo no es una curiosidad filosófica aislada, sino si la palabra de Dios a Israel ha fallado. Pablo responde usando la historia bíblica de Isaac, Jacob, Esaú, Faraón, Oseas e Isaías para defender la libertad y fidelidad de Dios en su propósito.';
    }

    return 'En Romanos, Pablo construye un argumento amplio sobre la justicia de Dios, el pecado, la gracia, la fe, Israel, los gentiles y la vida transformada. Cada capítulo debe leerse como parte de esa línea argumental, no como colección de frases aisladas.';
  }

  if (normalizedBook === 'mateo') {
    return 'En Mateo, cada pasaje debe leerse dentro de la presentación de Jesús como Mesías davídico, maestro autorizado y cumplimiento de las Escrituras de Israel.';
  }

  if (normalizedBook === 'juan') {
    return 'En Juan, cada pasaje debe leerse dentro del propósito de mostrar la identidad de Jesús mediante señales, discursos, testimonio, conflicto y revelación de vida.';
  }

  return `La lectura debe ubicar ${book} dentro del argumento completo del libro antes de sacar conclusiones del pasaje.`;
}

function chapterDepthProfile(book, chapter) {
  const key = `${normalizeTerm(book)} ${chapter}`;
  const profiles = {
    'romanos 1': {
      unit: 'Romanos 1:1-7 saludo y evangelio prometido; 1:8-15 deseo misionero de Pablo; 1:16-17 tesis de la carta sobre evangelio y justicia de Dios; 1:18-32 revelación de la ira contra la idolatría y degradación humana.',
      keyTerms: 'evangelio, justicia de Dios, fe, ira, revelación, creación, idolatría, pasiones, mente reprobada.',
      intertext: 'Habacuc 2:4 sostiene la frase "el justo por la fe vivirá". Génesis 1 y el lenguaje de creación están detrás de la acusación contra la idolatría: la humanidad cambia la gloria del Creador por imágenes creadas.',
      caution: 'No leer Romanos 1 como ataque aislado a un grupo externo. Pablo prepara el argumento de Romanos 1-3: gentiles y judíos quedan bajo pecado antes de exponer la gracia.',
      synthesis: 'La conclusión cruda es que Pablo abre la carta mostrando que el evangelio revela la justicia salvadora de Dios porque la humanidad, al rechazar al Creador, queda moral y religiosamente desordenada.'
    },
    'romanos 2': {
      unit: 'Romanos 2:1-11 juicio imparcial de Dios; 2:12-16 Ley, conciencia y juicio; 2:17-24 crítica al judío que presume de la Ley; 2:25-29 circuncisión exterior e interior.',
      keyTerms: 'juicio, arrepentimiento, Ley, conciencia, judío, circuncisión, corazón, Espíritu.',
      intertext: 'Deuteronomio y los Profetas ya habían criticado la confianza externa en señales del pacto sin obediencia del corazón. Pablo trabaja esa línea profética contra la falsa seguridad religiosa.',
      caution: 'No usar Romanos 2 para decir que Pablo niega el valor histórico de Israel. Su punto es que privilegio religioso sin obediencia no evita el juicio.',
      synthesis: 'La conclusión cruda es que Dios juzga con imparcialidad: conocer la Ley o portar señales externas no reemplaza una vida transformada ante Dios.'
    },
    'romanos 3': {
      unit: 'Romanos 3:1-8 ventaja judía y fidelidad de Dios; 3:9-20 todos bajo pecado; 3:21-26 justicia de Dios manifestada en Cristo; 3:27-31 exclusión de jactancia y confirmación de la Ley.',
      keyTerms: 'fidelidad, pecado, Ley, justicia de Dios, redención, propiciación, fe, jactancia.',
      intertext: 'Pablo encadena Salmos e Isaías para probar que el pecado es universal. La lógica sacrificial aparece en el lenguaje de redención y propiciación.',
      caution: 'No separar Romanos 3:21-26 de 1:18-3:20. La buena noticia responde al diagnóstico previo: todos están bajo pecado.',
      synthesis: 'La conclusión cruda es que Dios justifica por gracia mediante Cristo sin negar su justicia: la jactancia humana queda excluida y la fidelidad de Dios queda vindicada.'
    },
    'romanos 4': {
      unit: 'Romanos 4:1-8 Abraham justificado por fe; 4:9-12 fe antes de circuncisión; 4:13-17 promesa antes de la Ley; 4:18-25 Abraham como modelo de confianza en el Dios que da vida.',
      keyTerms: 'Abraham, fe, contar, justicia, promesa, circuncisión, descendencia, resurrección.',
      intertext: 'Génesis 15:6 es el texto central. Salmo 32 apoya la bendición del perdón. Pablo usa la historia de Abraham para integrar judíos y gentiles bajo promesa.',
      caution: 'No leer Abraham solo como ejemplo moral. En Romanos 4 funciona como argumento histórico-bíblico sobre cómo Dios declara justo y cumple promesa.',
      synthesis: 'La conclusión cruda es que Abraham muestra que la pertenencia al pueblo de la promesa se basa en la fe en el Dios que justifica y da vida, no en marcas étnicas o méritos.'
    },
    'romanos 5': {
      unit: 'Romanos 5:1-11 paz con Dios, esperanza y amor derramado; 5:12-21 contraste Adán/Cristo: pecado, muerte, gracia y vida.',
      keyTerms: 'justificación, paz, esperanza, sufrimiento, amor, Adán, muerte, gracia, obediencia, vida.',
      intertext: 'Génesis 2-3 está detrás del contraste Adán/Cristo. La historia humana se lee como dominio de pecado y muerte, superado por la obediencia de Cristo.',
      caution: 'No reducir Romanos 5 a consuelo psicológico. Pablo está explicando una nueva posición histórica y representativa en Cristo.',
      synthesis: 'La conclusión cruda es que la gracia no solo perdona pecados individuales: inaugura un nuevo régimen de vida bajo Cristo frente al viejo dominio de Adán, pecado y muerte.'
    },
    'romanos 6': {
      unit: 'Romanos 6:1-14 unión con Cristo en muerte y vida; 6:15-23 cambio de señorío: del pecado a la obediencia y justicia.',
      keyTerms: 'bautismo, muerte, vida nueva, pecado, obediencia, esclavos, justicia, santificación.',
      intertext: 'La lógica de éxodo y cambio de señorío está de fondo: ya no se pertenece al antiguo amo. Pablo usa muerte/resurrección de Cristo como base de vida nueva.',
      caution: 'No leer la gracia como permiso para pecar. Pablo anticipa esa mala lectura y la rechaza de raíz.',
      synthesis: 'La conclusión cruda es que quien participa de Cristo no puede seguir tratando al pecado como dueño legítimo: la gracia crea una nueva obediencia.'
    },
    'romanos 7': {
      unit: 'Romanos 7:1-6 liberación de la Ley mediante muerte; 7:7-13 la Ley revela pecado; 7:14-25 conflicto bajo el poder del pecado.',
      keyTerms: 'Ley, pecado, mandamiento, carne, muerte, querer, hacer, mente, esclavitud.',
      intertext: 'El mandamiento "no codiciarás" remite al Decálogo. La dinámica de deseo y transgresión recuerda Génesis 3: el mandato bueno es usado por el pecado para producir muerte.',
      caution: 'No usar Romanos 7 como excusa cómoda para la derrota moral. El capítulo prepara Romanos 8 y muestra la incapacidad humana bajo pecado y Ley sin la liberación del Espíritu.',
      synthesis: 'La conclusión cruda es que la Ley es buena, pero no puede liberar al ser humano dominado por el pecado; revela el problema y conduce a la necesidad de rescate.'
    },
    'romanos 8': {
      unit: 'Romanos 8:1-11 vida en el Espíritu; 8:12-17 adopción e hijos de Dios; 8:18-30 sufrimiento, creación y esperanza; 8:31-39 seguridad del amor de Dios.',
      keyTerms: 'condenación, Espíritu, carne, adopción, creación, gemir, esperanza, predestinar, amor de Dios.',
      intertext: 'El lenguaje de adopción, herencia y liberación dialoga con la historia de Israel y con la esperanza profética de nueva creación. Romanos 8:36 cita Salmo 44 para mostrar sufrimiento de los justos.',
      caution: 'No aislar Romanos 8:28-30 de la sección sobre sufrimiento. La seguridad que Pablo afirma no niega el dolor; lo ubica dentro del propósito de Dios.',
      synthesis: 'La conclusión cruda es que la vida en el Espíritu no elimina el sufrimiento presente, pero asegura que Dios lleva a su pueblo hacia conformidad con Cristo y nada lo separa de su amor.'
    },
    'romanos 9': {
      unit: 'Romanos 9:1-5 dolor de Pablo por Israel; 9:6-13 promesa y elección en Isaac/Jacob; 9:14-18 misericordia y endurecimiento; 9:19-29 imagen del alfarero, Oseas e Isaías; 9:30-33 tropiezo de Israel y entrada de gentiles por fe.',
      keyTerms: 'Israel, promesa, descendencia, elección, misericordia, endurecimiento, vasos, remanente, justicia, fe.',
      intertext: 'Génesis 18, 21 y 25; Éxodo 9; Oseas 1-2; Isaías 10 y 28. Pablo no cita esos textos como adornos: los usa para defender que Dios sigue siendo fiel aunque la pertenencia al pueblo se defina por promesa y no solo por linaje.',
      caution: 'No leer Romanos 9 separado de Romanos 10-11. El capítulo trata la fidelidad de Dios a Israel y la incorporación de gentiles, no solo un debate abstracto sobre predestinación individual.',
      synthesis: 'La conclusión cruda es que Pablo defiende la libertad de Dios para cumplir su promesa de manera inesperada: preserva remanente de Israel, llama gentiles y deja expuesta la tensión entre misericordia divina, responsabilidad humana y tropiezo ante Cristo.'
    },
    'romanos 10': {
      unit: 'Romanos 10:1-4 celo de Israel y Cristo como meta de la Ley; 10:5-13 justicia por fe y confesión; 10:14-17 necesidad de predicación; 10:18-21 respuesta de Israel ante el mensaje.',
      keyTerms: 'celo, justicia, Ley, Cristo, creer, confesar, invocar, predicación, oír.',
      intertext: 'Pablo usa Deuteronomio 30 para hablar de cercanía de la palabra, Joel 2 para invocar el nombre del Señor, Isaías 52 para la predicación e Isaías 65 para Israel resistente.',
      caution: 'No separar Romanos 10 de Romanos 9. Pablo no abandona la soberanía de Dios; muestra también responsabilidad humana ante el mensaje anunciado.',
      synthesis: 'La conclusión cruda es que la justicia no se alcanza estableciendo mérito propio, sino respondiendo con fe al Cristo proclamado; por eso la predicación importa.'
    },
    'romanos 11': {
      unit: 'Romanos 11:1-10 remanente por gracia; 11:11-24 olivo, ramas y gentiles injertados; 11:25-32 misterio de Israel y misericordia; 11:33-36 doxología.',
      keyTerms: 'remanente, gracia, endurecimiento, gentiles, olivo, injertar, misterio, misericordia.',
      intertext: 'Pablo usa la historia de Elías, Deuteronomio, Isaías y Salmos para explicar remanente y endurecimiento. La imagen del olivo organiza la relación Israel-gentiles.',
      caution: 'No leer Romanos 11 como licencia para orgullo gentil ni como negación del lugar histórico de Israel. Pablo advierte contra la arrogancia.',
      synthesis: 'La conclusión cruda es que Dios gobierna la historia de Israel y gentiles de modo que nadie pueda jactarse: todo termina en misericordia y adoración.'
    },
    'romanos 12': {
      unit: 'Romanos 12:1-2 culto racional y mente renovada; 12:3-8 dones en el cuerpo; 12:9-21 amor sincero, hospitalidad, paciencia y respuesta al mal.',
      keyTerms: 'misericordias, cuerpo, sacrificio vivo, mente, dones, amor, enemigo, vencer el mal.',
      intertext: 'El lenguaje sacrificial se reubica en la vida entera del creyente. Proverbios 25 aparece en la respuesta al enemigo con bien.',
      caution: 'No convertir Romanos 12 en lista de consejos desconectados. Es la respuesta ética a la misericordia expuesta en Romanos 1-11.',
      synthesis: 'La conclusión cruda es que la doctrina de la gracia debe tomar forma corporal y comunitaria: adoración, humildad, servicio y amor al enemigo.'
    },
    'romanos 13': {
      unit: 'Romanos 13:1-7 autoridades civiles; 13:8-10 amor como cumplimiento de la Ley; 13:11-14 urgencia escatológica y vida sobria.',
      keyTerms: 'autoridades, someterse, espada, tributo, amor, Ley, noche, día, Cristo.',
      intertext: 'El mandamiento de amar al prójimo resume preceptos del Decálogo. La imagen noche/día pertenece al lenguaje escatológico de vigilancia.',
      caution: 'No leer Romanos 13 como cheque en blanco para cualquier poder político. Pablo habla de orden civil, pero el conjunto bíblico también limita la obediencia cuando el poder exige idolatría o injusticia.',
      synthesis: 'La conclusión cruda es que la comunidad cristiana debe vivir públicamente con responsabilidad, amor y sobriedad, sabiendo que pertenece al día que viene.'
    },
    'romanos 14': {
      unit: 'Romanos 14:1-12 débiles y fuertes ante comidas y días; 14:13-23 no destruir al hermano por libertad personal.',
      keyTerms: 'débil, fuerte, juzgar, comida, día, tropiezo, conciencia, reino de Dios, paz.',
      intertext: 'Las tensiones sobre alimentos y días vienen del mundo judío-gentil y de prácticas de pureza, identidad y conciencia religiosa.',
      caution: 'No usar Romanos 14 para relativizar cualquier doctrina. Pablo trata asuntos disputables dentro de una comunidad que confiesa al mismo Señor.',
      synthesis: 'La conclusión cruda es que la libertad cristiana no existe para ganar discusiones, sino para edificar al hermano y preservar la paz del cuerpo.'
    },
    'romanos 15': {
      unit: 'Romanos 15:1-6 fuertes cargan con débiles; 15:7-13 Cristo recibe a judíos y gentiles; 15:14-21 ministerio de Pablo; 15:22-33 planes misioneros y colecta.',
      keyTerms: 'sobrellevar, recibir, esperanza, gentiles, ministro, evangelio, España, Jerusalén, colecta.',
      intertext: 'Pablo cita Salmos, Deuteronomio e Isaías para mostrar que la alabanza de los gentiles ya estaba dentro de la esperanza bíblica.',
      caution: 'No separar la ética comunitaria de la misión. Para Pablo, recibir al otro y llevar el evangelio a las naciones son parte del mismo plan de Dios.',
      synthesis: 'La conclusión cruda es que Cristo confirma las promesas a Israel y abre misericordia a los gentiles; por eso la iglesia debe recibirse mutuamente y vivir en misión.'
    },
    'romanos 16': {
      unit: 'Romanos 16:1-16 recomendación de Febe y saludos; 16:17-20 advertencia contra divisores; 16:21-24 saludos finales; 16:25-27 doxología.',
      keyTerms: 'Febe, Priscila, Aquila, colaboradores, iglesias en casas, divisiones, misterio, obediencia de fe.',
      intertext: 'La doxología retoma el tema del misterio ahora revelado a las naciones, en línea con la apertura de Romanos 1: obediencia de fe entre los gentiles.',
      caution: 'No saltar Romanos 16 como si fuera solo lista de nombres. Muestra redes reales de misión, mujeres y hombres colaboradores, casas-iglesia y unidad comunitaria.',
      synthesis: 'La conclusión cruda es que el evangelio de Romanos no queda en teoría: aparece encarnado en comunidades, colaboradores, hospitalidad, vigilancia doctrinal y misión entre las naciones.'
    },
    'efesios 1': {
      unit: 'Efesios 1:1-2 saludo; 1:3-14 bendición extensa por elección, adopción, redención, herencia y sello del Espíritu; 1:15-23 oración para comprender esperanza, herencia y poder de Dios en Cristo.',
      keyTerms: 'bendición, elección, adopción, redención, perdón, misterio, herencia, sello, Espíritu, plenitud.',
      intertext: 'El lenguaje de elección, adopción, herencia y redención viene del mundo de Israel, éxodo, familia y promesa. La exaltación de Cristo sobre poderes prepara el tema de potestades en la carta.',
      caution: 'No leer Efesios 1 como lista fría de conceptos doctrinales. Es una bendición litúrgica que ubica la identidad de la iglesia en la obra de Dios en Cristo.',
      synthesis: 'La conclusión cruda es que la identidad cristiana nace de la iniciativa de Dios: el pueblo es bendecido, redimido, sellado y orientado hacia la plenitud de Cristo.'
    },
    'efesios 2': {
      unit: 'Efesios 2:1-10 muerte espiritual, gracia y nueva creación; 2:11-22 gentiles alejados, reconciliación con Israel y formación de un solo pueblo como templo santo.',
      keyTerms: 'muertos, delitos, gracia, fe, obras, hechura, gentiles, pared, paz, reconciliación, templo.',
      intertext: 'El trasfondo incluye creación, éxodo, templo, ciudadanía de Israel y promesas pactales. La imagen del templo santo reubica la presencia de Dios en una comunidad reconciliada.',
      caution: 'No aislar Efesios 2:8-9 de 2:10 ni de 2:11-22. La salvación por gracia produce una nueva humanidad reconciliada, no solo una experiencia individual.',
      synthesis: 'La conclusión cruda es que Dios salva por gracia a personas muertas en pecado y las incorpora a una comunidad nueva donde judíos y gentiles son reconciliados en Cristo.'
    },
    'efesios 3': {
      unit: 'Efesios 3:1-13 misterio revelado a Pablo: los gentiles son coherederos; 3:14-21 oración para ser fortalecidos, comprender el amor de Cristo y participar de la plenitud de Dios.',
      keyTerms: 'misterio, revelación, gentiles, coherederos, evangelio, administración, multiforme sabiduría, amor, plenitud.',
      intertext: 'El misterio no significa algo oscuro, sino un propósito antes escondido y ahora revelado: la incorporación de gentiles al mismo pueblo prometido. La oración retoma lenguaje de arraigo, amor y plenitud.',
      caution: 'No leer “misterio” como código esotérico. En Efesios es la revelación histórica de que gentiles participan plenamente en Cristo.',
      synthesis: 'La conclusión cruda es que el plan de Dios une a gentiles y judíos en Cristo y muestra su sabiduría mediante la iglesia, no mediante privilegio étnico o poder humano.'
    },
    'efesios 4': {
      unit: 'Efesios 4:1-6 llamado a vivir dignamente y guardar la unidad; 4:7-16 dones para madurez del cuerpo; 4:17-24 abandono de la vida vieja; 4:25-32 ética concreta de verdad, ira, trabajo, palabra y perdón.',
      keyTerms: 'andar, vocación, unidad, cuerpo, dones, madurez, viejo hombre, nuevo hombre, verdad, perdón.',
      intertext: 'Salmo 68 aparece detrás de Efesios 4:8. La imagen del cuerpo conecta con la unidad judío-gentil ya expuesta en Efesios 2.',
      caution: 'No convertir Efesios 4 en moralismo aislado. La ética del capítulo sale de Efesios 1-3: gracia, reconciliación y nueva humanidad en Cristo.',
      synthesis: 'La conclusión cruda es que la iglesia debe vivir como un solo cuerpo maduro: la doctrina de la reconciliación se verifica en unidad, palabra limpia, vida renovada y perdón concreto.'
    },
    'efesios 5': {
      unit: 'Efesios 5:1-14 imitar a Dios y andar en amor/luz; 5:15-21 andar sabiamente, llenura del Espíritu y vida comunitaria; 5:22-33 matrimonio leído desde Cristo y la iglesia.',
      keyTerms: 'imitar, amor, luz, tinieblas, sabiduría, Espíritu, someterse, marido, esposa, Cristo, iglesia.',
      intertext: 'El contraste luz/tinieblas es común en tradición bíblica y judía. Génesis 2:24 es citado para explicar el matrimonio dentro del argumento sobre Cristo y la iglesia.',
      caution: 'No leer Efesios 5:22-33 aislado de 5:21 ni del modelo de Cristo que se entrega. El texto no autoriza dominio egoísta; reordena la casa bajo amor sacrificial.',
      synthesis: 'La conclusión cruda es que la nueva humanidad vive como luz en medio de una cultura oscura, y aun las relaciones domésticas deben ser reinterpretadas desde la entrega de Cristo.'
    },
    'efesios 6': {
      unit: 'Efesios 6:1-9 hijos, padres, esclavos y amos bajo el señorío de Cristo; 6:10-20 armadura de Dios y resistencia contra poderes; 6:21-24 cierre y paz.',
      keyTerms: 'obedecer, padres, esclavos, amos, Señor, armadura, potestades, verdad, justicia, evangelio, fe, Espíritu.',
      intertext: 'La armadura toma lenguaje de Isaías sobre Dios como guerrero justo y lo aplica a la resistencia de la iglesia. El conflicto no se reduce a personas, sino a poderes espirituales y estructuras de mal.',
      caution: 'No usar Efesios 6 para romantizar esclavitud ni para convertir la vida cristiana en espectáculo de guerra espiritual. Pablo habla dentro de casas romanas reales y llama a vivir bajo el señorío de Cristo.',
      synthesis: 'La conclusión cruda es que la vida nueva llega hasta la casa, el trabajo y la resistencia espiritual: la iglesia se mantiene firme no por fuerza humana, sino por la verdad, la justicia, la fe y la palabra de Dios.'
    },
    'juan 3': {
      unit: 'Juan 3:1-12 diálogo con Nicodemo sobre nuevo nacimiento; 3:13-21 revelación del Hijo y respuesta de fe o rechazo; 3:22-36 testimonio final de Juan el Bautista.',
      keyTerms: 'nacer de arriba, Espíritu, reino, Hijo del Hombre, creer, vida eterna, luz, juicio, testimonio.',
      intertext: 'Números 21 está detrás de la serpiente levantada. Ezequiel 36 ayuda a entender agua y Espíritu como renovación prometida.',
      caution: 'No reducir Juan 3 a una frase devocional aislada. El capítulo contrapone autoridad religiosa, necesidad de nuevo nacimiento y revelación del Hijo.',
      synthesis: 'La conclusión cruda es que la entrada al reino no depende de estatus religioso, sino de una obra de Dios que exige respuesta ante la luz revelada en el Hijo.'
    },
    'mateo 5': {
      unit: 'Mateo 5:1-12 bienaventuranzas; 5:13-16 identidad pública de los discípulos; 5:17-20 Jesús y la Torá; 5:21-48 seis contrastes que profundizan la justicia del reino.',
      keyTerms: 'reino de los cielos, justicia, cumplimiento, ley, profetas, corazón, enemigo, perfecto.',
      intertext: 'La montaña evoca a Moisés y la Torá, pero Mateo presenta a Jesús como maestro autorizado que interpreta la voluntad de Dios.',
      caution: 'No leer el Sermón del Monte como simple lista ética universal. Es instrucción del reino dirigida a discípulos dentro de la historia de Israel.',
      synthesis: 'La conclusión cruda es que Jesús no rebaja la justicia de la Torá; expone una justicia más profunda que llega al corazón, las relaciones y la lealtad total a Dios.'
    },
    'genesis 1': {
      unit: 'Génesis 1:1-2:3 presenta creación ordenada en seis días y reposo del séptimo, con repeticiones literarias: Dios dice, separa, nombra, ve que es bueno y bendice.',
      keyTerms: 'crear, cielo y tierra, bueno, imagen de Dios, dominio, bendición, reposo.',
      intertext: 'El capítulo funciona como inicio canónico: prepara temas de creación, humanidad, imagen, bendición, tierra y reposo que reaparecen en toda la Biblia.',
      caution: 'No leer Génesis 1 como si fuera un manual científico moderno ni como mito pagano sin matices. Es teología narrativa de creación en lenguaje antiguo.',
      synthesis: 'La conclusión cruda es que el mundo no nace del caos sin propósito: Dios ordena, limita, bendice y coloca a la humanidad como imagen responsable dentro de la creación.'
    },
    'exodo 12': {
      unit: 'Éxodo 12 regula la Pascua, la sangre en las casas, el juicio sobre Egipto, la salida y la memoria ritual para generaciones futuras.',
      keyTerms: 'Pascua, cordero, sangre, casa, juicio, memoria, liberación, primogénito.',
      intertext: 'El capítulo conecta con la memoria del éxodo en la Torá, los Profetas y el Nuevo Testamento, donde la Pascua provee lenguaje para redención y liberación.',
      caution: 'No saltar directo a aplicaciones cristianas sin leer primero el evento como liberación histórica de Israel de Egipto.',
      synthesis: 'La conclusión cruda es que la Pascua une juicio y rescate: Israel es liberado mediante una señal de sustitución y esa memoria forma su identidad como pueblo redimido.'
    },
    'salmos 23': {
      unit: 'Salmo 23 se mueve desde YHWH como pastor que guía y provee hasta YHWH como anfitrión que protege y recibe.',
      keyTerms: 'pastor, nada faltará, aguas, sendas, valle, vara, cayado, mesa, misericordia.',
      intertext: 'El pastor es una imagen real y pastoral de Israel; luego será usada para líderes, reyes y esperanza mesiánica.',
      caution: 'No suavizar el valle de sombra como si el salmo negara peligro. La confianza aparece precisamente en medio del riesgo.',
      synthesis: 'La conclusión cruda es que la seguridad del salmista no está en ausencia de amenaza, sino en la presencia fiel de YHWH que guía, corrige, protege y hospeda.'
    },
    'isaias 53': {
      unit: 'Isaías 52:13-53:12 describe al siervo exaltado mediante sufrimiento, rechazo, sustitución, silencio, muerte y vindicación.',
      keyTerms: 'siervo, despreciado, dolores, transgresiones, paz, heridas, culpa, justificar, muchos.',
      intertext: 'El pasaje pertenece a los cánticos del siervo y dialoga con temas de exilio, restauración, culpa e intervención de YHWH.',
      caution: 'No separar Isaías 53 de Isaías 40-55 ni resolver de inmediato todas las preguntas sobre identidad del siervo sin seguir el argumento del libro.',
      synthesis: 'La conclusión cruda es que la restauración de muchos aparece ligada al sufrimiento vicario del siervo y a la vindicación final de Dios.'
    },
    'hebreos 11': {
      unit: 'Hebreos 11 recorre testigos de fe desde Abel hasta los profetas, mostrando confianza perseverante antes de recibir plenamente lo prometido.',
      keyTerms: 'fe, esperanza, promesa, testimonio, peregrinos, patria, obediencia.',
      intertext: 'El capítulo relee Génesis, Éxodo, Josué, Jueces y la historia de Israel como cadena de fidelidad bajo promesa.',
      caution: 'No leer Hebreos 11 como galería de héroes autónomos. El punto es perseverar mirando la promesa y, en Hebreos 12, a Jesús.',
      synthesis: 'La conclusión cruda es que la fe bíblica no es optimismo; es perseverancia obediente ante promesas aún no consumadas.'
    },
    'apocalipsis 1': {
      unit: 'Apocalipsis 1 presenta prólogo, bendición, saludo a las iglesias, visión del Cristo glorificado y comisión a Juan.',
      keyTerms: 'revelación, testimonio, bienaventurado, iglesias, Alfa y Omega, Hijo del Hombre, candeleros.',
      intertext: 'Daniel 7 y 10, Zacarías y lenguaje profético del Antiguo Testamento moldean la visión de Cristo y las iglesias.',
      caution: 'No empezar Apocalipsis como código de fechas. El libro se presenta como revelación profética para iglesias reales bajo presión.',
      synthesis: 'La conclusión cruda es que las iglesias deben interpretar su sufrimiento y fidelidad desde la soberanía del Cristo resucitado que camina entre ellas.'
    }
  };

  return profiles[key] ?? null;
}

function intrabiblicalContext(book, chapter, testament) {
  const normalizedBook = normalizeTerm(book);

  if (normalizedBook === 'romanos' && chapter === 9) {
    return 'Romanos 9 usa intertextualidad intrabíblica de forma intensa. Pablo razona desde Génesis con Isaac, Jacob y Esaú para mostrar que la promesa no avanza simplemente por descendencia física. Usa Éxodo con Faraón para hablar de la libertad de Dios frente al poder humano. Cita Oseas para describir cómo Dios llama “pueblo mío” a quienes no eran pueblo, y cita Isaías para hablar del remanente de Israel. Estas conexiones no deben usarse como textos sueltos: Pablo las integra para responder si Dios sigue siendo fiel a sus promesas cuando Israel y gentiles aparecen de forma inesperada dentro del plan de Dios.';
  }

  if (normalizedBook === 'efesios' && chapter === 4) {
    return 'Efesios 4 se conecta con el uso intrabíblico de Salmo 68 en la sección sobre dones y ascenso. También depende del trasfondo de la nueva humanidad y del pueblo unido que la carta desarrolla antes. La intertextualidad debe leerse dentro de la lógica de la carta: Cristo forma un cuerpo maduro, unido y renovado.';
  }

  if (testament === 'Nuevo Testamento') {
    return `Para ${book} ${chapter}, la intertextualidad responsable busca primero citas explícitas del Antiguo Testamento, ecos claros o términos que el propio libro reutiliza. No se deben traer referencias lejanas solo porque suenan parecidas; la conexión debe estar sostenida por el texto, el vocabulario o el argumento del autor.`;
  }

  return `Para ${book} ${chapter}, la intertextualidad responsable compara primero el propio libro, la Torá, los Profetas o los Escritos cuando el texto use imágenes, fórmulas de pacto, promesas, juicio, sabiduría o culto. La conexión debe surgir del vocabulario y del contexto, no de asociaciones libres.`;
}

function passageSections(reference, verses) {
  const testament = verses.some((verse) => verse.testament === 'NEW') ? 'Nuevo Testamento' : 'Antiguo Testamento';
  const sample = verses[0];
  const scope = verseScopeLabel(verses);
  const textPreview = joinedClearText(verses).slice(0, 420);
  const lexicalRows = lexicalRowsForPassage(verses);
  const keyTerms = lexicalRows.map((row) => row.lemma).join(', ');
  const chapterProfile = chapterDepthProfile(sample.book, sample.chapter);
  const originalText = testament === 'Nuevo Testamento' ? 'Nestle-Aland 28 para el griego' : 'Texto Masorético para el hebreo/arameo';
  const comparison = testament === 'Nuevo Testamento' ? 'LBLA/NBLA y NA28' : 'LBLA/NBLA y Texto Masorético';

  return [
    {
      title: 'Contexto',
      body: `${scope} está dentro de ${sample.book} ${sample.chapter}, en el ${testament}. Primero se lee el capítulo completo: qué viene antes, qué problema o tema se está tratando y cómo continúa después. ${bookArgumentContext(sample.book, sample.chapter)} ${chapterProfile ? `Estructura específica del capítulo: ${chapterProfile.unit} ` : ''}En esta consulta, el texto visible dice en resumen: "${textPreview}${joinedClearText(verses).length > 420 ? '...' : ''}". Ese marco evita usar el versículo como frase suelta.`
    },
    {
      title: 'Género y estructura',
      body: `${sample.book} se trabaja como ${genreForBook(sample.book, testament)} En ${scope}, la estructura inmediata debe observar palabras repetidas, conectores, mandatos, promesas, contraste o secuencia de ideas. ${chapterProfile ? `Para este capítulo, la unidad interna debe seguirse así: ${chapterProfile.unit} ` : ''}La pregunta clave es: ¿la frase principal afirma algo, manda algo, narra algo, explica una causa o muestra una consecuencia?`
    },
    {
      title: 'Crítica textual en sencillo',
      body: `Para esta búsqueda se debería comparar ${originalText} con traducciones formales como LBLA/NBLA. En sencillo: crítica textual no significa desconfiar de la Biblia, sino revisar manuscritos y variantes para saber cuál lectura explica mejor el texto. La app usa RVA1909 como base libre; cuando haya proveedor autorizado, puede comparar ${comparison} sin copiar textos protegidos.`
    },
    {
      title: 'Léxico y sintaxis',
      body: `Las palabras de ${scope} se explican por su función en la oración, no solo por su raíz. En este análisis destacan: ${chapterProfile?.keyTerms || keyTerms || 'los términos principales del pasaje'}. "Léxico" pregunta qué campo de significado tiene una palabra; "sintaxis" pregunta qué papel cumple en la frase: sujeto, acción, complemento, contraste, causa, finalidad o resultado. HALOT/BDAG sirven para confirmar, pero el contexto manda.`
    },
    {
      title: 'Intertextualidad intrabíblica',
      body: chapterProfile
        ? `${chapterProfile.intertext} Advertencia: ${chapterProfile.caution}`
        : intrabiblicalContext(sample.book, sample.chapter, testament)
    },
    {
      title: 'Síntesis exegética',
      body: chapterProfile
        ? `${chapterProfile.synthesis} En términos simples: primero se escucha lo que el pasaje afirma en su mundo original; después se reconoce cómo funciona dentro del libro; recién al final se piensa una aplicación responsable sin forzar una doctrina externa sobre el texto.`
        : `La conclusión responsable de ${scope} debe salir del texto, del capítulo, del género literario y del argumento completo de ${sample.book}. En términos simples: primero se escucha lo que el pasaje afirma en su mundo original; después se reconoce cómo funciona dentro del libro; recién al final se piensa una aplicación responsable sin forzar una doctrina externa sobre el texto.`
    }
  ];
}

function simplePassageExplanation(reference, verses) {
  if (!verses.length) {
    return {
      summary: 'No encontré ese pasaje en la Biblia cargada. Revisá que la referencia esté escrita como “Juan 3:16” o “Romanos 8”.',
      sections: [],
      lexicalRows: []
    };
  }

  const sections = passageSections(reference, verses);

  return {
    summary: sections.at(-1).body,
    sections,
    lexicalRows: lexicalRowsForPassage(verses)
  };
}

function exactReferenceWhere(reference) {
  return { reference: { equals: reference.trim(), mode: 'insensitive' } };
}

function looseReferenceWhere(reference) {
  return { reference: { contains: reference.trim(), mode: 'insensitive' } };
}

function readableSpanishText(text) {
  return text
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/(^|[\s,.;:])á(?=\s)/g, '$1a')
    .replace(/(^|[\s,.;:])Á(?=\s)/g, '$1A')
    .replace(/(^|[\s,.;:])é(?=\s)/g, '$1e')
    .replace(/(^|[\s,.;:])É(?=\s)/g, '$1E')
    .replace(/(^|[\s,.;:])ó(?=\s)/g, '$1o')
    .replace(/(^|[\s,.;:])Ó(?=\s)/g, '$1O')
    .replace(/\bEmpero\b/g, 'Pero')
    .replace(/\bempero\b/g, 'pero');
}

function bibleVerseDto(verse) {
  const clearText = readableSpanishText(verse.text);
  return {
    reference: verse.reference,
    text: verse.text,
    clearText: clearText === verse.text ? null : clearText,
    version: verse.version
  };
}

const bookAliases = new Map([
  ['genesis', 'Génesis'],
  ['exodo', 'Éxodo'],
  ['levitico', 'Levítico'],
  ['numeros', 'Números'],
  ['deuteronomio', 'Deuteronomio'],
  ['josue', 'Josué'],
  ['jueces', 'Jueces'],
  ['rut', 'Rut'],
  ['1 samuel', '1 Samuel'],
  ['2 samuel', '2 Samuel'],
  ['1 reyes', '1 Reyes'],
  ['2 reyes', '2 Reyes'],
  ['1 cronicas', '1 Crónicas'],
  ['2 cronicas', '2 Crónicas'],
  ['esdras', 'Esdras'],
  ['nehemias', 'Nehemías'],
  ['ester', 'Ester'],
  ['job', 'Job'],
  ['salmos', 'Salmos'],
  ['salmo', 'Salmos'],
  ['proverbios', 'Proverbios'],
  ['eclesiastes', 'Eclesiastés'],
  ['cantares', 'Cantares'],
  ['isaias', 'Isaías'],
  ['jeremias', 'Jeremías'],
  ['lamentaciones', 'Lamentaciones'],
  ['ezequiel', 'Ezequiel'],
  ['daniel', 'Daniel'],
  ['oseas', 'Oseas'],
  ['joel', 'Joel'],
  ['amos', 'Amós'],
  ['abdias', 'Abdías'],
  ['jonas', 'Jonás'],
  ['miqueas', 'Miqueas'],
  ['nahum', 'Nahúm'],
  ['habacuc', 'Habacuc'],
  ['sofonias', 'Sofonías'],
  ['hageo', 'Hageo'],
  ['zacarias', 'Zacarías'],
  ['malaquias', 'Malaquías'],
  ['mateo', 'Mateo'],
  ['marcos', 'Marcos'],
  ['lucas', 'Lucas'],
  ['juan', 'Juan'],
  ['hechos', 'Hechos'],
  ['romanos', 'Romanos'],
  ['1 corintios', '1 Corintios'],
  ['2 corintios', '2 Corintios'],
  ['galatas', 'Gálatas'],
  ['efesios', 'Efesios'],
  ['filipenses', 'Filipenses'],
  ['colosenses', 'Colosenses'],
  ['1 tesalonicenses', '1 Tesalonicenses'],
  ['2 tesalonicenses', '2 Tesalonicenses'],
  ['1 timoteo', '1 Timoteo'],
  ['2 timoteo', '2 Timoteo'],
  ['tito', 'Tito'],
  ['filemon', 'Filemón'],
  ['hebreos', 'Hebreos'],
  ['santiago', 'Santiago'],
  ['1 pedro', '1 Pedro'],
  ['2 pedro', '2 Pedro'],
  ['1 juan', '1 Juan'],
  ['2 juan', '2 Juan'],
  ['3 juan', '3 Juan'],
  ['judas', 'Judas'],
  ['apocalipsis', 'Apocalipsis']
]);

function canonicalBookName(rawBook) {
  const normalized = normalizeTerm(rawBook).replace(/\s+/g, ' ').trim();
  return bookAliases.get(normalized) ?? rawBook.trim().replace(/\s+/g, ' ');
}

function parseReferenceInput(input) {
  const cleaned = input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bcap[ií]tulo\b/gi, '')
    .replace(/\bvers[ií]culo\b/gi, ':')
    .replace(/\bvers[.]?\b/gi, ':')
    .replace(/\s+:\s+/g, ':')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s+al\s+/gi, '-')
    .replace(/\s+/g, ' ');
  const match = cleaned.match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/i);
  if (!match) return null;

  const [, rawBook, rawChapter, rawStartVerse, rawEndVerse] = match;
  const chapter = Number.parseInt(rawChapter, 10);
  const startVerse = rawStartVerse ? Number.parseInt(rawStartVerse, 10) : null;
  const endVerse = rawEndVerse ? Number.parseInt(rawEndVerse, 10) : startVerse;

  if (!Number.isInteger(chapter) || chapter < 1) return null;
  if (startVerse !== null && (!Number.isInteger(startVerse) || startVerse < 1)) return null;
  if (endVerse !== null && (!Number.isInteger(endVerse) || endVerse < startVerse)) return null;

  return {
    book: canonicalBookName(rawBook),
    chapter,
    startVerse,
    endVerse
  };
}

async function findVersesForReference(reference, take = 120) {
  const parsed = parseReferenceInput(reference);
  if (!parsed) return [];

  const where = {
    book: { equals: parsed.book, mode: 'insensitive' },
    chapter: parsed.chapter
  };

  if (parsed.startVerse !== null) {
    where.verse = { gte: parsed.startVerse, lte: parsed.endVerse };
  }

  return prisma.bibleVerse.findMany({
    where,
    take,
    orderBy: [{ chapter: 'asc' }, { verse: 'asc' }]
  });
}

function lexicalStudyForWord(word, verses, glossary) {
  const normalized = normalizeTerm(word);
  const hasOld = verses.some((verse) => verse.testament === 'OLD');
  const hasNew = verses.some((verse) => verse.testament === 'NEW');
  const rowsByWord = {
    presciencia: [{
      lemma: 'prognosis (griego)',
      semantics: 'Conocimiento previo. En uso bíblico puede tener un matiz relacional, no solo saber datos antes de tiempo.',
      contextualUse: 'En 1 Pedro 1:2 aparece vinculada con elección, santificación y obediencia.',
      syntax: 'Sustantivo dentro de una frase que explica la identidad de los destinatarios.'
    }],
    predestinacion: [{
      lemma: 'proorizo (griego)',
      semantics: 'Determinar o señalar de antemano un propósito.',
      contextualUse: 'Cuando aparece en textos como Romanos 8 o Efesios 1, se relaciona con el propósito salvador de Dios.',
      syntax: 'Verbo de acción divina; normalmente se lee dentro de una cadena de acciones de Dios.'
    }],
    amor: [{
      lemma: 'agape / agapao (griego), ahab (hebreo)',
      semantics: 'Amor, afecto, lealtad o entrega según el contexto.',
      contextualUse: 'No siempre significa emoción; muchas veces expresa acción fiel hacia otro.',
      syntax: 'Puede aparecer como sustantivo, verbo o parte de una exhortación.'
    }],
    fe: [{
      lemma: 'pistis (griego)',
      semantics: 'Confianza, fidelidad o convicción confiada.',
      contextualUse: 'El sentido exacto depende de si el texto enfatiza creer, ser fiel o confiar.',
      syntax: 'Sustantivo; puede funcionar como medio, actitud o marca de identidad.'
    }],
    gracia: [{
      lemma: 'charis (griego)',
      semantics: 'Favor, don, bondad inmerecida o disposición generosa.',
      contextualUse: 'En cartas paulinas suele señalar la iniciativa bondadosa de Dios.',
      syntax: 'Sustantivo que a menudo sostiene una explicación teológica.'
    }]
  };

  return {
    meaning:
      glossary?.simpleDefinition ??
      'La palabra aparece en la Biblia cargada. Su significado debe definirse por el contexto, no solo por el diccionario.',
    academicNote:
      `Lectura responsable: primero miramos el uso en el pasaje, luego el idioma original (${hasOld ? 'hebreo/arameo' : ''}${hasOld && hasNew ? ' y ' : ''}${hasNew ? 'griego' : '' || 'según corresponda'}). HALOT y BDAG son fuentes recomendadas para confirmar el sentido cuando haya proveedor autorizado.`,
    recommendedLexicons: [
      ...(hasOld ? ['HALOT: hebreo/arameo del Antiguo Testamento'] : []),
      ...(hasNew ? ['BDAG: griego del Nuevo Testamento'] : [])
    ],
    lexicalRows: rowsByWord[normalized] ?? [{
      lemma: hasNew ? 'Lema griego por confirmar' : hasOld ? 'Lema hebreo/arameo por confirmar' : 'Lema por confirmar',
      semantics: 'Campo de significado por confirmar con el texto original.',
      contextualUse: 'Leé las ocurrencias cercanas para ver cómo se usa la palabra en frases reales.',
      syntax: 'La función gramatical se confirma mirando la oración completa.'
    }]
  };
}

function wordAnalysisSections(word, verses, lexicalStudy, totalOccurrences) {
  const normalizedWord = word.trim();
  const occurrences = totalOccurrences || verses.length;
  const firstRefs = verses.slice(0, 4).map((verse) => verse.reference).join(', ');
  const hasOld = verses.some((verse) => verse.testament === 'OLD');
  const hasNew = verses.some((verse) => verse.testament === 'NEW');
  const corpus = hasOld && hasNew
    ? 'Antiguo y Nuevo Testamento'
    : hasOld
      ? 'Antiguo Testamento'
      : hasNew
        ? 'Nuevo Testamento'
        : 'la Biblia cargada';
  const originalTools = hasOld && hasNew
    ? 'Texto Masorético para hebreo/arameo y NA28 para griego'
    : hasOld
      ? 'Texto Masorético y HALOT'
      : hasNew
        ? 'NA28 y BDAG'
        : 'el texto original que corresponda';

  return [
    {
      title: 'Contexto',
      body: occurrences
        ? `"${normalizedWord}" aparece en ${occurrences} resultado(s) relacionado(s) dentro de ${corpus}. No se define como idea aislada: se mira dónde aparece, quién habla, qué tema trata el capítulo y qué función cumple en cada frase. Primeros lugares para revisar: ${firstRefs || 'sin referencias suficientes'}.`
        : `No encontré "${normalizedWord}" en la Biblia cargada. Aun así, el método correcto sería buscar ocurrencias reales, mirar el capítulo de cada una y evitar construir una definición sin pasajes concretos.`
    },
    {
      title: 'Género y estructura',
      body: `Una palabra no tiene género literario por sí sola; lo tiene el pasaje donde aparece. Por eso "${normalizedWord}" debe leerse de forma distinta si aparece en poesía, narración, profecía, evangelio o carta. La estructura que importa es la frase completa: si la palabra es acción, sujeto, motivo, resultado, promesa, mandato o contraste.`
    },
    {
      title: 'Crítica textual en sencillo',
      body: `Para estudiar "${normalizedWord}" con rigor se revisaría ${originalTools}. En sencillo: no basta preguntar "qué significa la palabra"; también hay que confirmar qué palabra original está detrás, si hay variantes relevantes y si la traducción española refleja bien el uso del pasaje.`
    },
    {
      title: 'Léxico y sintaxis',
      body: `${lexicalStudy.meaning} ${lexicalStudy.academicNote} La sintaxis pregunta cómo trabaja "${normalizedWord}" dentro de la oración: si nombra algo, describe algo, ordena algo, explica causa o señala finalidad. Así evitamos la falacia de definir una palabra solo por su raíz.`
    },
    {
      title: 'Síntesis exegética',
      body: `Síntesis sencilla: "${normalizedWord}" debe explicarse por sus usos reales, especialmente por los pasajes más claros. Si aparece en contextos distintos, puede tener matices distintos. La conclusión responsable no fuerza una doctrina completa desde una sola ocurrencia.`
    }
  ];
}

app.get('/api/glosario', async (req, res, next) => {
  try {
    const search = req.query.q?.toString() ?? '';
    const variants = searchTerms(search);
    const terms = await prisma.glossaryTerm.findMany({
      where: search
        ? {
            OR: variants.flatMap((term) => [
              { term: { contains: term, mode: 'insensitive' } },
              { simpleDefinition: { contains: term, mode: 'insensitive' } },
              { deeperDefinition: { contains: term, mode: 'insensitive' } },
              { example: { contains: term, mode: 'insensitive' } },
              { aliases: { has: normalizeTerm(term) } }
            ])
          }
        : undefined,
      orderBy: { term: 'asc' }
    });
    res.json(terms);
  } catch (error) {
    next(error);
  }
});

app.get('/api/fuentes/textos', async (_req, res, next) => {
  try {
    const sources = await prisma.biblicalTextSource.findMany({
      orderBy: { priority: 'asc' }
    });
    res.json(sources);
  } catch (error) {
    next(error);
  }
});

app.get('/api/fuentes/diccionarios', async (_req, res, next) => {
  try {
    const lexicons = await prisma.lexiconSource.findMany({
      orderBy: { priority: 'asc' }
    });
    res.json(lexicons);
  } catch (error) {
    next(error);
  }
});

app.get('/api/biblia/versiculos', async (req, res, next) => {
  try {
    const search = req.query.q?.toString() ?? '';
    const verses = await prisma.bibleVerse.findMany({
      where: search ? bibleSearchWhere(search) : undefined,
      orderBy: [{ book: 'asc' }, { chapter: 'asc' }, { verse: 'asc' }],
      take: 50
    });
    res.json(verses);
  } catch (error) {
    next(error);
  }
});

app.get('/api/buscar', async (req, res, next) => {
  try {
    const q = req.query.q?.toString().trim() ?? '';
    if (!q) {
      return res.json({ query: q, results: [] });
    }

    const variants = searchTerms(q);
    const [verses, glossary, events, textSources, lexicons] = await Promise.all([
      prisma.bibleVerse.findMany({
        where: bibleSearchWhere(q),
        take: 12,
        orderBy: [{ book: 'asc' }, { chapter: 'asc' }, { verse: 'asc' }]
      }),
      prisma.glossaryTerm.findMany({
        where: {
          OR: variants.flatMap((term) => [
            { term: { contains: term, mode: 'insensitive' } },
            { simpleDefinition: { contains: term, mode: 'insensitive' } },
            { deeperDefinition: { contains: term, mode: 'insensitive' } },
            { example: { contains: term, mode: 'insensitive' } },
            { aliases: { has: normalizeTerm(term) } }
          ])
        },
        take: 8,
        orderBy: { term: 'asc' }
      }),
      prisma.chronologicalEvent.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { stage: { contains: q, mode: 'insensitive' } },
            { summary: { contains: q, mode: 'insensitive' } },
            { guideQuestion: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 8,
        orderBy: { order: 'asc' }
      }),
      prisma.biblicalTextSource.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { abbreviation: { contains: q, mode: 'insensitive' } },
            { baseText: { contains: q, mode: 'insensitive' } },
            { useInApp: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 8,
        orderBy: { priority: 'asc' }
      }),
      prisma.lexiconSource.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { abbreviation: { contains: q, mode: 'insensitive' } },
            { useInApp: { contains: q, mode: 'insensitive' } },
            { reliability: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 8,
        orderBy: { priority: 'asc' }
      })
    ]);

    res.json({
      query: q,
      results: [
        ...verses.map((item) => ({
          id: item.id,
          type: 'Versículo',
          title: item.reference,
          description: item.text,
          target: 'pasaje'
        })),
        ...glossary.map((item) => ({
          id: item.id,
          type: 'Glosario',
          title: item.term,
          description: item.simpleDefinition,
          target: 'glosario'
        })),
        ...events.map((item) => ({
          id: item.id,
          type: 'Cronología',
          title: item.title,
          description: item.summary,
          target: 'cronologia',
          eventSlug: item.slug
        })),
        ...textSources.map((item) => ({
          id: item.id,
          type: 'Fuente textual',
          title: item.name,
          description: item.useInApp,
          target: 'fuentes'
        })),
        ...lexicons.map((item) => ({
          id: item.id,
          type: 'Diccionario',
          title: item.name,
          description: item.useInApp,
          target: 'fuentes'
        }))
      ]
    });
  } catch (error) {
    next(error);
  }
});

const authorizedBibleQuerySchema = z.object({
  version: z.enum(['NBLA', 'LBLA']),
  reference: z.string().min(3).max(80),
  question: z.string().min(5).max(600)
});

app.post('/api/consulta-versiones', async (req, res, next) => {
  try {
    const data = authorizedBibleQuerySchema.parse(req.body);
    const providerResult = await queryAuthorizedBibleProvider(data);

    if (providerResult) {
      return res.json({
        configured: true,
        version: data.version,
        reference: data.reference,
        provider: 'authorized',
        ...providerResult
      });
    }

    let fallbackVerses = await findVersesForReference(data.reference, 40);

    if (!fallbackVerses.length) {
      const [bookAndChapter] = data.reference.trim().split(':');
      fallbackVerses = await prisma.bibleVerse.findMany({
        where: looseReferenceWhere(bookAndChapter),
        take: 8,
        orderBy: [{ book: 'asc' }, { chapter: 'asc' }, { verse: 'asc' }]
      });
    }

    res.json({
      configured: false,
      version: data.version,
      reference: data.reference,
      answer:
        'El modo online NBLA/LBLA ya está armado, pero todavía falta configurar una API o licencia autorizada en el backend. Mientras tanto, te muestro la base RVA1909 local como apoyo y dejo preparada la consulta para enviarla al proveedor oficial.',
      nextStep:
        'Configura BIBLE_PROVIDER_URL y BIBLE_PROVIDER_KEY en server/.env cuando tengas acceso autorizado a NBLA/LBLA.',
      requestedQuestion: data.question,
      fallbackVersion: 'RVA1909',
      fallbackVerses: fallbackVerses.map(bibleVerseDto)
    });
  } catch (error) {
    next(error);
  }
});

const lexiconQuerySchema = z.object({
  word: z.string().min(2).max(80)
});

app.post('/api/lexico-palabra', async (req, res, next) => {
  try {
    const data = lexiconQuerySchema.parse(req.body);
    const normalized = normalizeTerm(data.word);
    const verses = await prisma.bibleVerse.findMany({
      where: bibleSearchWhere(data.word),
      take: 12,
      orderBy: [{ book: 'asc' }, { chapter: 'asc' }, { verse: 'asc' }]
    });
    const totalOccurrences = await prisma.bibleVerse.count({
      where: { keywords: { has: normalized } }
    });
    const testaments = Array.from(new Set(verses.map((verse) => verse.testament)));
    const glossary = await prisma.glossaryTerm.findFirst({
      where: {
        OR: [
          { term: { contains: data.word, mode: 'insensitive' } },
          { aliases: { has: normalized } }
        ]
      }
    });
    const providerResult = await queryAuthorizedLexiconProvider({
      word: data.word,
      testament: testaments.includes('OLD') && testaments.includes('NEW') ? 'BOTH' : testaments[0] ?? 'UNKNOWN'
    });

    if (providerResult) {
      return res.json({
        configured: true,
        word: data.word,
        ...providerResult,
        occurrences: totalOccurrences,
        sampleVerses: verses.map(bibleVerseDto)
      });
    }

    const lexicalStudy = lexicalStudyForWord(data.word, verses, glossary);

    res.json({
      configured: false,
      word: data.word,
      normalized,
      meaning: lexicalStudy.meaning,
      academicNote: lexicalStudy.academicNote,
      recommendedLexicons: lexicalStudy.recommendedLexicons,
      lexicalRows: lexicalStudy.lexicalRows,
      occurrences: totalOccurrences || verses.length,
      sampleVerses: verses.map(bibleVerseDto)
    });
  } catch (error) {
    next(error);
  }
});

const passageExplainSchema = z.object({
  reference: z.string().min(3).max(80)
});

app.post('/api/explicar-pasaje', async (req, res, next) => {
  try {
    const data = passageExplainSchema.parse(req.body);
    let verses = await findVersesForReference(data.reference, 120);

    if (!verses.length && data.reference.includes(':')) {
      const [bookAndChapter] = data.reference.split(':');
      verses = await prisma.bibleVerse.findMany({
        where: looseReferenceWhere(bookAndChapter),
        take: 20,
        orderBy: [{ book: 'asc' }, { chapter: 'asc' }, { verse: 'asc' }]
      });
    } else if (!verses.length) {
      verses = await prisma.bibleVerse.findMany({
        where: looseReferenceWhere(data.reference),
        take: 20,
        orderBy: [{ book: 'asc' }, { chapter: 'asc' }, { verse: 'asc' }]
      });
    }

    const explanation = simplePassageExplanation(data.reference, verses);

    res.json({
      reference: data.reference,
      found: verses.length > 0,
      explanation: explanation.summary,
      sections: explanation.sections,
      lexicalRows: explanation.lexicalRows,
      verses: verses.map(bibleVerseDto)
    });
  } catch (error) {
    next(error);
  }
});

const analyzeSchema = z.object({
  input: z.string().min(2).max(2000),
  depth: z.enum(['sencillo', 'estudiante', 'academico']).default('estudiante')
});

function looksLikeReference(input) {
  const normalized = input.trim().replace(/\s+/g, ' ');
  return /\d+:\d+/.test(normalized)
    || /\bcap[ií]tulo\s+\d+/i.test(normalized)
    || /^[1-3]?\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s+\d+/.test(normalized);
}

function textStudy(input) {
  return {
    mode: 'text',
    title: 'Texto ingresado',
    found: true,
    explanation:
      'Este análisis trabaja con el texto que escribiste. Para una exégesis completa conviene ubicar la referencia bíblica exacta, comparar el texto original y revisar el contexto literario.',
    sections: [
      {
        title: 'Contexto',
        body: `Voy a trabajar con el texto que escribiste: "${input.slice(0, 280)}${input.length > 280 ? '...' : ''}". Como no hay referencia bíblica exacta, el contexto se limita al contenido visible. Para completar el análisis histórico-gramatical, conviene indicar libro, capítulo y versículo.`
      },
      {
        title: 'Género y estructura',
        body: 'Primero se observa qué hace el texto: narra, argumenta, manda, promete, lamenta, compara o enseña. Luego se separan idea principal, apoyos, conectores y repeticiones. Sin identificar el género, se corre el riesgo de leer poesía como si fuera prosa técnica o una carta como si fuera narración.'
      },
      {
        title: 'Crítica textual en sencillo',
        body: 'Si este texto pertenece al Antiguo Testamento, se revisaría el Texto Masorético; si pertenece al Nuevo, NA28. LBLA/NBLA servirían como traducciones comparativas cuando haya acceso autorizado. En sencillo: primero confirmamos cuál es el texto base antes de sacar conclusiones fuertes.'
      },
      {
        title: 'Léxico y sintaxis',
        body: 'Las palabras importantes deben explicarse por su uso dentro de la oración. HALOT y BDAG ayudan a confirmar el campo de significado, pero no reemplazan el contexto. La sintaxis mira qué papel cumple cada palabra: acción, sujeto, objeto, causa, finalidad, contraste o resultado.'
      },
      {
        title: 'Síntesis exegética',
        body: 'La conclusión debe salir del texto mismo: qué afirma, qué tensión deja abierta y qué no debemos resolver a la fuerza. Si falta la referencia, la síntesis queda como observación provisional, no como explicación final del pasaje.'
      }
    ],
    lexicalRows: [{
      lemma: 'Por identificar',
      semantics: 'Depende del idioma original del pasaje.',
      contextualUse: 'Se confirma cuando ubicamos la referencia exacta.',
      syntax: 'Depende de la frase completa.'
    }],
    verses: [{ reference: 'Texto ingresado', text: input, version: 'Usuario' }]
  };
}

function buildReasoningLayers(result) {
  if (result.mode === 'word') {
    return [
      { label: 'Observación', body: `La palabra o término “${result.title}” debe estudiarse en sus ocurrencias reales, no como concepto aislado.` },
      { label: 'Interpretación', body: 'El sentido se decide por el uso contextual: quién la usa, en qué frase aparece y qué función cumple.' },
      { label: 'Síntesis', body: 'La definición responsable combina ocurrencias bíblicas, contexto inmediato y revisión léxica cuando hay acceso a fuentes especializadas.' }
    ];
  }

  if (normalizeTerm(result.title) === 'romanos 8:29') {
    return [
      { label: 'Observación', body: 'El texto une conocer, predestinar y conformar a la imagen del Hijo dentro de una cadena de acciones divinas.' },
      { label: 'Interpretación', body: 'En el argumento de Romanos 8, Pablo usa esa cadena para afirmar seguridad y propósito en medio del sufrimiento.' },
      { label: 'Síntesis', body: 'El punto central no es resolver todos los debates filosóficos, sino mostrar que la meta de Dios es formar un pueblo semejante a Cristo.' }
    ];
  }

  return [
    { label: 'Observación', body: 'Primero se identifica qué dice el texto y cuáles son sus palabras o acciones principales.' },
    { label: 'Interpretación', body: 'Después se pregunta qué significaba eso para los primeros lectores dentro del libro bíblico.' },
    { label: 'Síntesis', body: 'Finalmente se resume lo que puede afirmarse con responsabilidad sin forzar conclusiones externas.' }
  ];
}

function buildCertaintyRows(result) {
  if (normalizeTerm(result.title) === 'romanos 8:29') {
    return [
      { kind: 'Dato textual seguro', claim: 'Romanos 8:29 contiene una cadena de acciones atribuidas a Dios.', confidence: 'Alta' },
      { kind: 'Inferencia probable', claim: 'La cadena busca sostener la seguridad del creyente en el argumento de Romanos 8.', confidence: 'Alta' },
      { kind: 'Posibilidad abierta', claim: 'La relación exacta entre presciencia, predestinación y libertad humana queda discutida por tradiciones posteriores.', confidence: 'Media' },
      { kind: 'Lectura dogmática posterior', claim: 'Usar el texto para cerrar todo debate filosófico excede lo que el versículo desarrolla por sí solo.', confidence: 'Advertencia' }
    ];
  }

  return [
    { kind: 'Dato textual seguro', claim: 'El análisis debe partir de las palabras y estructura visibles en el texto.', confidence: 'Alta' },
    { kind: 'Inferencia probable', claim: 'El contexto inmediato orienta el sentido principal.', confidence: 'Alta' },
    { kind: 'Posibilidad abierta', claim: 'Algunos matices dependen de comparar el texto original y variantes.', confidence: 'Media' },
    { kind: 'Lectura dogmática posterior', claim: 'Las doctrinas sistemáticas deben venir después de la lectura contextual.', confidence: 'Advertencia' }
  ];
}

function buildCommonMistakes(result) {
  if (result.mode === 'word') {
    return [
      'Tratar la palabra como si tuviera un solo significado fijo en toda la Biblia.',
      'Definirla por etimología sin mirar la frase concreta.',
      'Ignorar si el uso pertenece al Antiguo o Nuevo Testamento.'
    ];
  }

  return [
    'Leer el versículo como frase suelta.',
    'Resolver tensiones doctrinales antes de terminar la observación del texto.',
    'Confundir una aplicación posible con el significado original.'
  ];
}

function buildHermeneuticWarnings(result) {
  if (result.mode === 'word') {
    return [
      'No definas una palabra solo por su raíz. Mirá cómo funciona en la frase.',
      'No asumas que la palabra significa exactamente lo mismo en todos los pasajes.',
      'No conviertas una ocurrencia aislada en doctrina completa.'
    ];
  }

  if (normalizeTerm(result.title) === 'romanos 8:29') {
    return [
      'No leas Romanos 8:29 separado de Romanos 8:28-30.',
      'No saltes directo al debate filosófico sobre libertad y predestinación antes de seguir el argumento de Pablo.',
      'No uses el versículo para borrar la tensión del texto; Pablo enfatiza seguridad y propósito divino.'
    ];
  }

  return [
    'No saques el versículo de su capítulo.',
    'No importes una doctrina externa antes de observar el texto.',
    'No confundas aplicación personal con el significado original.'
  ];
}

function buildTranslationNotes(result) {
  if (!result.verses?.length || result.verses[0].version === 'Usuario') {
    return [
      'Para comparar traducciones, conviene consultar una versión autorizada como LBLA/NBLA junto con el texto original.',
      'La app usa RVA1909 como base local porque es de dominio público.'
    ];
  }

  return [
    'RVA1909 sirve como texto español local y libre para búsqueda.',
    'LBLA/NBLA serían útiles para comparar redacción moderna y precisión formal cuando tengamos proveedor autorizado.',
    'NA28 o Texto Masorético sirven para revisar el texto base, no para reemplazar la lectura contextual.'
  ];
}

function buildSimpleSummary(result) {
  if (result.mode === 'word') {
    return `En simple: “${result.title}” debe entenderse mirando dónde aparece y cómo se usa. El diccionario ayuda, pero el contexto manda.`;
  }

  if (normalizeTerm(result.title) === 'romanos 8:29') {
    return 'En simple: Pablo dice que Dios tiene un propósito completo para su pueblo: hacerlo parecido a Cristo. El texto abre tensiones sobre predestinación, pero su punto principal es dar seguridad dentro del sufrimiento.';
  }

  return 'En simple: primero leemos el texto en su contexto, después miramos palabras importantes, y recién al final sacamos una conclusión cuidadosa.';
}

function buildPastoralPerspectives(result) {
  const target = result.mode === 'word'
    ? `la palabra o tema “${result.title}”`
    : result.mode === 'text'
      ? 'el texto ingresado'
      : `el pasaje ${result.title}`;
  const firstSection = result.sections?.[0]?.body ?? result.explanation;
  const synthesis = result.sections?.find((section) => normalizeTerm(section.title).includes('sintesis'))?.body ?? result.explanation;

  return {
    note: 'Orientaciones resumidas con palabras propias. No reproducen comentarios completos protegidos por copyright.',
    items: [
      {
        author: 'R.C. Sproul / Ligonier',
        emphasis: 'Doctrina, santidad de Dios, gracia, pacto y lectura reformada responsable.',
        body: `Para ${target}, una lectura en la línea de Sproul empezaría preguntando qué revela el texto sobre el carácter de Dios antes de convertirlo en aplicación personal. En este caso, conviene sostener la tensión del texto, respetar su contexto y dejar que la doctrina nazca de la exégesis, no al revés.`,
        officialUrl: 'https://www.ligonier.org/'
      },
      {
        author: 'John MacArthur / Grace to You',
        emphasis: 'Exposición versículo por versículo, argumento del capítulo y conexión con el libro completo.',
        body: `Para ${target}, una orientación expositiva al estilo MacArthur seguiría el flujo del capítulo: observar palabras, conectores, mandatos, sujetos y propósito del autor. La prioridad sería explicar qué dice el texto en su párrafo y cómo ese párrafo funciona dentro del libro completo.`,
        officialUrl: 'https://www.gty.org/'
      },
      {
        author: 'Sugel Michelén',
        emphasis: 'Claridad pastoral, predicación expositiva, aplicación sobria y lenguaje comprensible.',
        body: `Para ${target}, una lectura pastoral como la de Sugel buscaría explicar el sentido sin tecnicismos innecesarios: primero el contexto, luego la idea central, después las implicaciones. La aplicación debe salir de la síntesis exegética: ${synthesis}`,
        officialUrl: 'https://www.coalicionporelevangelio.org/'
      }
    ],
    guardrails: [
      `Estas perspectivas deben revisarse a la luz del texto: ${firstSection}`,
      'No sustituyen el análisis bíblico ni citan obras completas.',
      'Si se agregan enlaces específicos en el futuro, deben apuntar a recursos oficiales o autorizados.'
    ]
  };
}

function depthNote(depth) {
  if (depth === 'sencillo') {
    return 'Nivel sencillo: prioriza claridad, frases cortas y conclusiones fáciles de seguir.';
  }
  if (depth === 'academico') {
    return 'Nivel académico claro: mantiene el método técnico, pero explica cada término difícil en palabras comunes.';
  }
  return 'Nivel estudiante: equilibrio entre detalle exegético y lectura clara.';
}

function enrichAnalysis(result, depth) {
  return {
    ...result,
    depth,
    methodNote: depthNote(depth),
    reasoningLayers: buildReasoningLayers(result),
    certaintyRows: buildCertaintyRows(result),
    commonMistakes: buildCommonMistakes(result),
    simpleSummary: buildSimpleSummary(result),
    warnings: buildHermeneuticWarnings(result),
    translationNotes: buildTranslationNotes(result),
    pastoralPerspectives: buildPastoralPerspectives(result),
    aiReady: Boolean(process.env.AI_PROVIDER_URL && process.env.AI_PROVIDER_KEY)
  };
}

app.post('/api/analizar', async (req, res, next) => {
  try {
    const data = analyzeSchema.parse(req.body);
    const input = data.input.trim();
    const wordCount = input.split(/\s+/).filter(Boolean).length;

    if (looksLikeReference(input)) {
      let verses = await findVersesForReference(input, 120);

      if (!verses.length && input.includes(':')) {
        const [bookAndChapter] = input.split(':');
        verses = await prisma.bibleVerse.findMany({
          where: looseReferenceWhere(bookAndChapter),
          take: 20,
          orderBy: [{ book: 'asc' }, { chapter: 'asc' }, { verse: 'asc' }]
        });
      } else if (!verses.length) {
        verses = await prisma.bibleVerse.findMany({
          where: looseReferenceWhere(input),
          take: 20,
          orderBy: [{ book: 'asc' }, { chapter: 'asc' }, { verse: 'asc' }]
        });
      }

      const explanation = simplePassageExplanation(input, verses);
      return res.json(enrichAnalysis({
        mode: 'passage',
        title: input,
        found: verses.length > 0,
        explanation: explanation.summary,
        sections: explanation.sections,
        lexicalRows: explanation.lexicalRows,
        verses: verses.map(bibleVerseDto)
      }, data.depth));
    }

    if (wordCount <= 3) {
      const normalized = normalizeTerm(input);
      const verses = await prisma.bibleVerse.findMany({
        where: bibleSearchWhere(input),
        take: 12,
        orderBy: [{ book: 'asc' }, { chapter: 'asc' }, { verse: 'asc' }]
      });
      const totalOccurrences = await prisma.bibleVerse.count({
        where: { keywords: { has: normalized } }
      });
      const glossary = await prisma.glossaryTerm.findFirst({
        where: {
          OR: [
            { term: { contains: input, mode: 'insensitive' } },
            { aliases: { has: normalized } }
          ]
        }
      });
      const lexicalStudy = lexicalStudyForWord(input, verses, glossary);

      return res.json(enrichAnalysis({
        mode: 'word',
        title: input,
        found: verses.length > 0,
        explanation: lexicalStudy.meaning,
        sections: wordAnalysisSections(input, verses, lexicalStudy, totalOccurrences),
        lexicalRows: lexicalStudy.lexicalRows,
        verses: verses.map(bibleVerseDto)
      }, data.depth));
    }

    return res.json(enrichAnalysis(textStudy(input), data.depth));
  } catch (error) {
    next(error);
  }
});

const noteSchema = z.object({
  passageId: z.string().uuid().optional(),
  title: z.string().min(1).max(120),
  body: z.string().min(1),
  tags: z.array(z.string()).default([])
});

app.post('/api/notas', requireAuth, async (req, res, next) => {
  try {
    const data = noteSchema.parse(req.body);
    const note = await prisma.note.create({
      data: {
        ...data,
        userId: req.user.id
      }
    });
    res.status(201).json(note);
  } catch (error) {
    next(error);
  }
});

app.get('/api/notas', requireAuth, async (req, res, next) => {
  try {
    const notes = await prisma.note.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        passage: {
          select: { reference: true, title: true }
        }
      }
    });
    res.json(notes);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      mensaje: 'Datos inválidos',
      errores: error.flatten()
    });
  }

  console.error(error);
  res.status(500).json({
    mensaje: 'Error interno del servidor'
  });
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Biblia en Contexto API escuchando en http://localhost:${port}`);
});
