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
    'juan 1': {
      unit: 'Juan 1:1-18 prólogo sobre el Verbo, creación, luz, encarnación y revelación del Padre; 1:19-34 testimonio de Juan el Bautista; 1:35-51 primeros discípulos y títulos cristológicos.',
      keyTerms: 'Verbo, Dios, vida, luz, tinieblas, carne, gloria, gracia, verdad, Cordero de Dios, Mesías.',
      intertext: 'Génesis 1 está detrás de "en el principio". Éxodo 33-34 ilumina gloria, gracia y verdad. El Cordero de Dios evoca sacrificio, Pascua y lenguaje de remoción del pecado.',
      caution: 'No leer el prólogo como filosofía abstracta separada de la historia. Juan afirma que el Verbo eterno se hizo carne y fue testificado en hechos concretos.',
      synthesis: 'La conclusión cruda es que Juan presenta a Jesús como revelación definitiva de Dios: creador, vida, luz y presencia divina encarnada entre su pueblo.'
    },
    'juan 2': {
      unit: 'Juan 2:1-12 señal del agua convertida en vino en Caná; 2:13-25 purificación del templo y anuncio del templo de su cuerpo.',
      keyTerms: 'señal, gloria, creer, bodas, vino, hora, templo, cuerpo, resurrección.',
      intertext: 'Las bodas y el vino conectan con imágenes proféticas de restauración. El templo remite al centro cultual de Israel, pero Jesús reorienta la presencia de Dios hacia su propia persona.',
      caution: 'No reducir Caná a un milagro social ni la purificación del templo a enojo moral. Ambas escenas revelan reemplazo y cumplimiento en Jesús.',
      synthesis: 'La conclusión cruda es que Jesús inaugura una nueva etapa: revela gloria y desplaza el centro de encuentro con Dios desde el templo hacia sí mismo.'
    },
    'juan 3': {
      unit: 'Juan 3:1-12 diálogo con Nicodemo sobre nuevo nacimiento; 3:13-21 revelación del Hijo y respuesta de fe o rechazo; 3:22-36 testimonio final de Juan el Bautista.',
      keyTerms: 'nacer de arriba, Espíritu, reino, Hijo del Hombre, creer, vida eterna, luz, juicio, testimonio.',
      intertext: 'Números 21 está detrás de la serpiente levantada. Ezequiel 36 ayuda a entender agua y Espíritu como renovación prometida.',
      caution: 'No reducir Juan 3 a una frase devocional aislada. El capítulo contrapone autoridad religiosa, necesidad de nuevo nacimiento y revelación del Hijo.',
      synthesis: 'La conclusión cruda es que la entrada al reino no depende de estatus religioso, sino de una obra de Dios que exige respuesta ante la luz revelada en el Hijo.'
    },
    'juan 4': {
      unit: 'Juan 4:1-42 Jesús y la mujer samaritana; 4:43-54 segunda señal en Galilea con el hijo del oficial.',
      keyTerms: 'Samaría, agua viva, adoración, espíritu, verdad, Mesías, cosecha, creer, señal.',
      intertext: 'El pozo evoca escenas patriarcales de encuentro. La tensión judíos-samaritanos viene de historia de culto, territorio y pureza. La adoración ya no queda atada a Gerizim o Jerusalén.',
      caution: 'No leer la escena solo como conversación moral individual. Juan trata identidad mesiánica, frontera étnica, culto verdadero y misión.',
      synthesis: 'La conclusión cruda es que Jesús cruza fronteras religiosas y sociales para revelar que el culto verdadero nace de la revelación de Dios y alcanza aun a los marginados.'
    },
    'juan 5': {
      unit: 'Juan 5:1-18 sanidad en Betesda y conflicto por sábado; 5:19-47 discurso sobre autoridad del Hijo, vida, juicio y testigos.',
      keyTerms: 'sábado, sanar, Padre, Hijo, vida, juicio, testimonio, Escrituras, Moisés.',
      intertext: 'El sábado remite a creación y pacto. Moisés y las Escrituras funcionan como testigos que apuntan a Jesús, no como rivales de su autoridad.',
      caution: 'No tratar el conflicto como simple discusión legalista. El centro es la autoridad divina de Jesús para dar vida y ejecutar juicio.',
      synthesis: 'La conclusión cruda es que Jesús reclama una relación única con el Padre: su obra de vida y juicio exige escuchar su voz y revisar cómo se leen las Escrituras.'
    },
    'juan 6': {
      unit: 'Juan 6:1-15 alimentación de los cinco mil; 6:16-21 Jesús sobre el mar; 6:22-59 discurso del pan de vida; 6:60-71 crisis de discípulos.',
      keyTerms: 'pan, señal, maná, vida, carne, sangre, creer, venir, permanecer, palabras de vida.',
      intertext: 'Éxodo 16 y el maná son el trasfondo principal. La Pascua cercana intensifica el lenguaje de provisión, liberación y vida.',
      caution: 'No reducir el pan de vida a metáfora general de ayuda espiritual. Juan lo conecta con creer, recibir vida y participar de Jesús mismo.',
      synthesis: 'La conclusión cruda es que Jesús no solo da pan: se presenta como el pan verdadero que desciende del cielo y provoca una división entre fe superficial y adhesión real.'
    },
    'juan 7': {
      unit: 'Juan 7:1-13 tensión familiar y viaje a la fiesta; 7:14-36 enseñanza pública y debate sobre origen de Jesús; 7:37-52 promesa de agua viva y división.',
      keyTerms: 'fiesta, hora, enseñanza, enviado, origen, agua viva, Espíritu, división.',
      intertext: 'La fiesta de Tabernáculos, con agua y memoria del desierto, ilumina la promesa de ríos de agua viva y expectativa escatológica.',
      caution: 'No leer el capítulo sin la fiesta. El marco litúrgico explica por qué agua, origen, presencia y Espíritu son temas centrales.',
      synthesis: 'La conclusión cruda es que Jesús se revela en medio de una fiesta de memoria y esperanza, afirmando que la verdadera provisión del Espíritu viene por medio de él.'
    },
    'juan 8': {
      unit: 'Juan 8:12-30 Jesús como luz del mundo y enviado del Padre; 8:31-59 verdad, libertad, descendencia de Abraham y "antes que Abraham fuese, yo soy".',
      keyTerms: 'luz, mundo, testimonio, verdad, libertad, pecado, Abraham, Padre, yo soy.',
      intertext: 'La luz conecta con creación, éxodo y esperanza profética. Abraham se vuelve eje del debate sobre descendencia física y verdadera fidelidad.',
      caution: 'No usar Juan 8 para desprecio antijudío. Es una disputa intrajudía del siglo I sobre identidad, autoridad y respuesta a Jesús.',
      synthesis: 'La conclusión cruda es que Jesús afirma una autoridad anterior y superior a Abraham; la verdadera libertad depende de permanecer en su palabra.'
    },
    'juan 9': {
      unit: 'Juan 9:1-12 sanidad del ciego de nacimiento; 9:13-34 interrogatorio y expulsión; 9:35-41 revelación del Hijo del Hombre y ceguera espiritual.',
      keyTerms: 'ciego, obras de Dios, sábado, lavar, ver, pecado, expulsión, Hijo del Hombre.',
      intertext: 'La apertura de ojos remite a señales proféticas de restauración. El sábado vuelve a funcionar como campo de disputa sobre identidad y autoridad de Jesús.',
      caution: 'No leer la ceguera como castigo automático por pecado. El mismo texto rechaza esa explicación simplista al inicio.',
      synthesis: 'La conclusión cruda es que el signo físico expone una inversión: el ciego llega a ver quién es Jesús, mientras autoridades seguras de ver quedan ciegas.'
    },
    'juan 10': {
      unit: 'Juan 10:1-21 pastor, puerta, ovejas y vida abundante; 10:22-42 fiesta de Dedicación, unidad con el Padre y nueva división.',
      keyTerms: 'pastor, ovejas, puerta, vida, ladrón, conocer, dar la vida, Padre, uno.',
      intertext: 'Ezequiel 34 es clave: Dios denuncia malos pastores y promete pastorear a su pueblo. Juan aplica esa expectativa a Jesús.',
      caution: 'No leer "vida abundante" como prosperidad material. En el capítulo significa vida bajo el cuidado del Pastor que entrega su vida.',
      synthesis: 'La conclusión cruda es que Jesús se presenta como el pastor prometido que conoce, protege y reúne a sus ovejas mediante su propia muerte.'
    },
    'juan 11': {
      unit: 'Juan 11:1-16 muerte de Lázaro; 11:17-44 Jesús como resurrección y vida; 11:45-57 decisión oficial de matar a Jesús.',
      keyTerms: 'Lázaro, amar, dormir, resurrección, vida, creer, llorar, gloria, muerte.',
      intertext: 'La esperanza de resurrección ya existía en sectores judíos del Segundo Templo. Juan la concentra en la persona de Jesús, no solo en un evento futuro.',
      caution: 'No convertir Juan 11 en simple consuelo funerario. La señal precipita la muerte de Jesús y revela su autoridad sobre la muerte.',
      synthesis: 'La conclusión cruda es que Jesús enfrenta la muerte con dolor real y autoridad real: la vida que ofrece provoca fe, oposición y camino hacia la cruz.'
    },
    'juan 12': {
      unit: 'Juan 12:1-11 unción en Betania; 12:12-19 entrada en Jerusalén; 12:20-36 llegada de la hora; 12:37-50 incredulidad y resumen del ministerio público.',
      keyTerms: 'unción, rey, hora, glorificar, grano de trigo, mundo, luz, creer, juicio.',
      intertext: 'Zacarías 9 está detrás de la entrada del rey humilde. Isaías 6 y 53 ayudan a interpretar incredulidad y gloria en sufrimiento.',
      caution: 'No leer la entrada triunfal como triunfo político normal. Juan la conecta con la hora de muerte y glorificación.',
      synthesis: 'La conclusión cruda es que la gloria de Jesús se revela paradójicamente en muerte: como grano que cae, su entrega abre fruto y juicio sobre el mundo.'
    },
    'juan 13': {
      unit: 'Juan 13:1-20 lavamiento de pies; 13:21-30 anuncio de traición; 13:31-38 nuevo mandamiento y anuncio de negación de Pedro.',
      keyTerms: 'hora, amar hasta el fin, lavar, siervo, traición, gloria, mandamiento nuevo, amar.',
      intertext: 'El lavado evoca purificación y servicio humilde. El amor hasta el fin introduce los discursos de despedida y anticipa la cruz.',
      caution: 'No reducir el lavamiento a ejemplo genérico de humildad. Es señal de la manera en que Jesús purifica y redefine autoridad por servicio.',
      synthesis: 'La conclusión cruda es que la comunidad de Jesús debe entender poder, limpieza y amor desde el Señor que se inclina y sirve antes de entregar su vida.'
    },
    'juan 14': {
      unit: 'Juan 14:1-14 camino al Padre; 14:15-31 promesa del Paráclito, amor, obediencia y paz.',
      keyTerms: 'casa del Padre, camino, verdad, vida, Padre, Paráclito, Espíritu, paz, obedecer.',
      intertext: 'El tema de morada conecta con templo y presencia de Dios. El Espíritu como Paráclito continúa la presencia y enseñanza de Jesús.',
      caution: 'No leer Juan 14 solo como lenguaje funerario. Es consuelo de despedida para una comunidad que deberá vivir por la presencia del Espíritu.',
      synthesis: 'La conclusión cruda es que Jesús no deja huérfanos a los suyos: su partida abre acceso al Padre y la presencia del Espíritu sostiene obediencia y paz.'
    },
    'juan 15': {
      unit: 'Juan 15:1-17 vid verdadera, permanecer y amor; 15:18-27 odio del mundo y testimonio del Paráclito.',
      keyTerms: 'vid, ramas, permanecer, fruto, podar, amor, amigos, mundo, testimonio.',
      intertext: 'Israel como vid aparece en Isaías 5 y Salmos. Jesús se presenta como la vid verdadera, concentrando en sí la identidad fructífera del pueblo.',
      caution: 'No leer "fruto" como productividad religiosa superficial. En Juan 15 nace de permanecer en Cristo y se expresa en amor y testimonio.',
      synthesis: 'La conclusión cruda es que la vida del discípulo depende de unión continua con Jesús: sin permanecer no hay fruto, amor ni testimonio fiel.'
    },
    'juan 16': {
      unit: 'Juan 16:1-15 persecución y obra del Espíritu; 16:16-24 tristeza convertida en gozo; 16:25-33 victoria de Jesús sobre el mundo.',
      keyTerms: 'expulsión, Espíritu, convencer, pecado, justicia, juicio, tristeza, gozo, mundo, vencer.',
      intertext: 'El lenguaje de testimonio, juicio y Espíritu continúa promesas proféticas de renovación y defensa de Dios para su pueblo.',
      caution: 'No leer la victoria de Jesús como ausencia de aflicción. El capítulo dice explícitamente que habrá aflicción, pero dentro de la victoria de Cristo.',
      synthesis: 'La conclusión cruda es que el Espíritu sostendrá a los discípulos en persecución, interpretará la obra de Jesús y transformará tristeza en gozo escatológico.'
    },
    'juan 17': {
      unit: 'Juan 17:1-5 Jesús ora por glorificación; 17:6-19 ora por sus discípulos; 17:20-26 ora por los futuros creyentes y su unidad.',
      keyTerms: 'gloria, vida eterna, nombre, mundo, verdad, santificar, enviar, unidad, amor.',
      intertext: 'La oración sacerdotal retoma temas de nombre divino, santificación, misión y unidad del pueblo de Dios.',
      caution: 'No usar la unidad de Juan 17 como unidad sin verdad. El texto une unidad, santificación en la verdad y misión.',
      synthesis: 'La conclusión cruda es que Jesús interpreta su muerte como glorificación y pide que su pueblo sea guardado, santificado y unido para testimonio ante el mundo.'
    },
    'juan 18': {
      unit: 'Juan 18:1-11 arresto en el huerto; 18:12-27 interrogatorio religioso y negaciones de Pedro; 18:28-40 juicio ante Pilato.',
      keyTerms: 'huerto, yo soy, copa, sacerdote, negar, reino, verdad, Pilato.',
      intertext: 'El huerto contrasta con escenas de caída y obediencia. El tema del reino redefine poder frente al tribunal romano.',
      caution: 'No leer el juicio como pérdida de control. Juan presenta a Jesús entregándose conscientemente y revelando un reino que no opera como los reinos del mundo.',
      synthesis: 'La conclusión cruda es que Jesús aparece como acusado, pero actúa con soberanía: su reino y su testimonio de la verdad confrontan tanto poder religioso como imperial.'
    },
    'juan 19': {
      unit: 'Juan 19:1-16 condena y burla real; 19:17-30 crucifixión y muerte; 19:31-42 sepultura.',
      keyTerms: 'rey, corona, cruz, título, Escritura, madre, consumado, sangre, agua, sepultura.',
      intertext: 'Salmo 22, Zacarías 12 y la Pascua iluminan reparto de vestiduras, mirar al traspasado y huesos no quebrados.',
      caution: 'No leer la cruz en Juan como derrota accidental. "Consumado es" indica cumplimiento de la misión recibida.',
      synthesis: 'La conclusión cruda es que la muerte de Jesús es entronización paradójica y cumplimiento: el rey crucificado completa la obra y revela la gloria en entrega.'
    },
    'juan 20': {
      unit: 'Juan 20:1-10 tumba vacía; 20:11-18 aparición a María; 20:19-23 envío y Espíritu; 20:24-31 Tomás y propósito del libro.',
      keyTerms: 'tumba, ver, creer, María, Rabboni, paz, enviar, Espíritu, Tomás, Señor, Dios.',
      intertext: 'El primer día evoca nueva creación. La confesión de Tomás cierra el arco cristológico iniciado en Juan 1.',
      caution: 'No reducir Juan 20 a prueba apologética fría. El capítulo busca fe: señales escritas para creer que Jesús es el Cristo, el Hijo de Dios.',
      synthesis: 'La conclusión cruda es que la resurrección funda una nueva comunidad enviada en paz, con testimonio suficiente para creer y tener vida en el nombre de Jesús.'
    },
    'juan 21': {
      unit: 'Juan 21:1-14 pesca y comida junto al mar; 21:15-19 restauración y comisión de Pedro; 21:20-25 discípulo amado y cierre testimonial.',
      keyTerms: 'pesca, pan, peces, amar, apacentar, ovejas, seguir, testimonio, escrito.',
      intertext: 'La pesca y la comida evocan provisión y misión. El lenguaje de ovejas conecta con Juan 10: Pedro pastorea bajo el Pastor verdadero.',
      caution: 'No leer Juan 21 como apéndice sin importancia. Cierra temas de misión, restauración, liderazgo y testimonio confiable.',
      synthesis: 'La conclusión cruda es que el Resucitado restaura al discípulo fallido, lo llama a pastorear y centra toda vocación en seguir a Jesús.'
    },
    'mateo 1': {
      unit: 'Mateo 1:1-17 genealogía de Jesús desde Abraham y David; 1:18-25 nacimiento de Jesús, José, concepción virginal y nombre Emanuel.',
      keyTerms: 'Jesucristo, hijo de David, hijo de Abraham, genealogía, José, Espíritu Santo, Jesús, Emanuel.',
      intertext: 'Génesis, Rut, Samuel y Reyes sostienen la línea Abraham-David-exilio-Cristo. Isaías 7:14 aparece en la cita sobre Emanuel.',
      caution: 'No leer la genealogía como relleno introductorio. Mateo la usa para ubicar a Jesús dentro de la historia de Israel, promesa, monarquía y exilio.',
      synthesis: 'La conclusión cruda es que Jesús aparece como cumplimiento de la historia de Israel: hijo de Abraham, hijo de David y presencia de Dios con su pueblo.'
    },
    'mateo 2': {
      unit: 'Mateo 2:1-12 magos, Herodes y Belén; 2:13-15 huida a Egipto; 2:16-18 matanza de niños; 2:19-23 retorno y residencia en Nazaret.',
      keyTerms: 'magos, rey de los judíos, Herodes, Belén, estrella, Egipto, cumplimiento, Nazaret.',
      intertext: 'Miqueas 5:2, Oseas 11:1, Jeremías 31:15 y ecos del éxodo moldean el capítulo. Jesús recapitula la historia de Israel.',
      caution: 'No convertir los magos en detalle decorativo. Mateo contrasta búsqueda gentil, amenaza política y cumplimiento de Escritura.',
      synthesis: 'La conclusión cruda es que el nacimiento del Mesías provoca adoración y oposición: desde el inicio, Jesús está dentro de promesa, exilio, amenaza y restauración.'
    },
    'mateo 3': {
      unit: 'Mateo 3:1-12 ministerio de Juan el Bautista; 3:13-17 bautismo de Jesús y voz celestial.',
      keyTerms: 'arrepentimiento, reino de los cielos, desierto, bautismo, fruto, hacha, Espíritu, Hijo amado.',
      intertext: 'Isaías 40 está detrás de la voz en el desierto. El bautismo de Jesús concentra lenguaje de hijo, siervo y Espíritu.',
      caution: 'No leer el bautismo de Jesús como confesión de pecado. Mateo lo presenta como identificación con Israel y comienzo público de su misión.',
      synthesis: 'La conclusión cruda es que el reino anunciado exige arrepentimiento real, y Jesús entra en escena como Hijo aprobado por Dios y portador del Espíritu.'
    },
    'mateo 4': {
      unit: 'Mateo 4:1-11 tentación en el desierto; 4:12-17 inicio en Galilea; 4:18-22 llamado de discípulos; 4:23-25 enseñanza, predicación y sanidades.',
      keyTerms: 'desierto, tentar, escrito está, reino, Galilea, arrepentíos, discípulos, sanar.',
      intertext: 'Deuteronomio sostiene las respuestas de Jesús al tentador. Isaías 9 ilumina la luz en Galilea. La escena del desierto recuerda la prueba de Israel.',
      caution: 'No leer las tentaciones como simples ejemplos morales. Mateo muestra al Hijo fiel donde Israel falló.',
      synthesis: 'La conclusión cruda es que Jesús inaugura el reino como Hijo obediente, llama discípulos y muestra autoridad en palabra y sanidad.'
    },
    'mateo 5': {
      unit: 'Mateo 5:1-12 bienaventuranzas; 5:13-16 identidad pública de los discípulos; 5:17-20 Jesús y la Torá; 5:21-48 seis contrastes que profundizan la justicia del reino.',
      keyTerms: 'reino de los cielos, justicia, cumplimiento, ley, profetas, corazón, enemigo, perfecto.',
      intertext: 'La montaña evoca a Moisés y la Torá, pero Mateo presenta a Jesús como maestro autorizado que interpreta la voluntad de Dios.',
      caution: 'No leer el Sermón del Monte como simple lista ética universal. Es instrucción del reino dirigida a discípulos dentro de la historia de Israel.',
      synthesis: 'La conclusión cruda es que Jesús no rebaja la justicia de la Torá; expone una justicia más profunda que llega al corazón, las relaciones y la lealtad total a Dios.'
    },
    'mateo 6': {
      unit: 'Mateo 6:1-18 limosna, oración y ayuno sin ostentación; 6:19-34 tesoros, ojo, dos señores y confianza en el Padre.',
      keyTerms: 'justicia, secreto, Padre, oración, reino, pan, perdón, tesoro, Mamón, ansiedad.',
      intertext: 'La oración del Padre Nuestro concentra lenguaje de reino, pan diario, perdón y liberación. La crítica a la ostentación dialoga con prácticas judías de piedad.',
      caution: 'No leer Mateo 6 como rechazo de prácticas religiosas. Jesús critica hacerlas para obtener honor humano.',
      synthesis: 'La conclusión cruda es que la justicia del reino se practica delante del Padre, no para teatro religioso; por eso ordena deseo, dinero y ansiedad.'
    },
    'mateo 7': {
      unit: 'Mateo 7:1-12 juicio, discernimiento, oración y regla de oro; 7:13-29 dos caminos, falsos profetas, verdadero discípulo y casa sobre roca.',
      keyTerms: 'juzgar, pedir, puerta estrecha, frutos, voluntad del Padre, roca, autoridad.',
      intertext: 'Los dos caminos recuerdan Deuteronomio y sabiduría bíblica. La casa sobre roca cierra el sermón con obediencia práctica.',
      caution: 'No usar "no juzguéis" para cancelar todo discernimiento. El mismo capítulo exige evaluar frutos y falsos profetas.',
      synthesis: 'La conclusión cruda es que escuchar a Jesús sin obedecerlo es autoengaño; la entrada al reino se prueba en discernimiento y práctica.'
    },
    'mateo 8': {
      unit: 'Mateo 8:1-17 sanidades del leproso, siervo del centurión y suegra de Pedro; 8:18-22 costo del discipulado; 8:23-34 autoridad sobre tormenta y demonios.',
      keyTerms: 'limpio, fe, centurión, sanar, seguir, Hijo del Hombre, viento, demonios.',
      intertext: 'Isaías 53:4 es citado para interpretar las sanidades. El centurión anticipa entrada de gentiles al banquete del reino.',
      caution: 'No leer los milagros como espectáculo aislado. Mateo los organiza para mostrar autoridad mesiánica y costo de seguir a Jesús.',
      synthesis: 'La conclusión cruda es que Jesús tiene autoridad sobre impureza, enfermedad, naturaleza y demonios, pero esa autoridad demanda seguimiento real.'
    },
    'mateo 9': {
      unit: 'Mateo 9:1-8 paralítico y perdón; 9:9-17 llamado de Mateo y controversias; 9:18-34 sanidades; 9:35-38 compasión y mies.',
      keyTerms: 'perdonar, Hijo del Hombre, misericordia, pecadores, ayuno, fe, compasión, mies.',
      intertext: 'Oseas 6:6 aparece en "misericordia quiero". La imagen de ovejas sin pastor remite a críticas proféticas contra líderes de Israel.',
      caution: 'No separar perdón y sanidad como si Mateo eligiera uno. El capítulo muestra autoridad integral y misericordia hacia excluidos.',
      synthesis: 'La conclusión cruda es que Jesús perdona, llama pecadores y restaura vidas, revelando una misión de misericordia frente a religiosidad defensiva.'
    },
    'mateo 10': {
      unit: 'Mateo 10:1-15 envío de los Doce a Israel; 10:16-25 persecución; 10:26-33 confesión pública; 10:34-42 costo y recompensa.',
      keyTerms: 'Doce, ovejas perdidas, reino, paz, persecución, confesar, cruz, recibir.',
      intertext: 'Los Doce evocan las doce tribus de Israel. La misión se concentra primero en Israel y anticipa oposición similar a la de los profetas.',
      caution: 'No universalizar cada instrucción sin notar el momento de la misión. Mateo 10 tiene contexto específico dentro de la misión a Israel.',
      synthesis: 'La conclusión cruda es que la misión del reino combina autoridad, vulnerabilidad y conflicto; seguir a Jesús exige lealtad superior aun frente a familia y poder.'
    },
    'mateo 11': {
      unit: 'Mateo 11:1-19 pregunta de Juan y testimonio sobre él; 11:20-24 ayes contra ciudades; 11:25-30 revelación a pequeños y descanso en Jesús.',
      keyTerms: 'Juan, obras del Cristo, escandalizarse, Elías, ay, revelación, descanso, yugo.',
      intertext: 'Isaías informa la respuesta de Jesús a Juan: ciegos ven, cojos andan, pobres reciben buenas nuevas. Malaquías está detrás del mensajero.',
      caution: 'No leer "venid a mí" separado del llamado al yugo. El descanso de Jesús no elimina discipulado; redefine el señorío como manso y fiel.',
      synthesis: 'La conclusión cruda es que Jesús confirma su identidad por obras mesiánicas, confronta incredulidad y ofrece descanso bajo su autoridad.'
    },
    'mateo 12': {
      unit: 'Mateo 12:1-14 controversias de sábado; 12:15-21 siervo escogido; 12:22-37 Beelzebú y blasfemia; 12:38-50 señal de Jonás y verdadera familia.',
      keyTerms: 'sábado, misericordia, Señor del sábado, siervo, Espíritu, reino, señal de Jonás, familia.',
      intertext: 'Oseas 6:6 vuelve a aparecer. Isaías 42 interpreta el ministerio del siervo. Jonás funciona como señal de juicio y resurrección.',
      caution: 'No leer la blasfemia contra el Espíritu fuera del conflicto del capítulo. Se refiere a atribuir la obra del Espíritu a poder demoníaco en rechazo deliberado.',
      synthesis: 'La conclusión cruda es que Jesús redefine sábado, familia y señal alrededor de su autoridad, mientras la oposición religiosa endurece su rechazo.'
    },
    'mateo 13': {
      unit: 'Mateo 13:1-23 sembrador; 13:24-43 trigo, cizaña y explicación; 13:44-52 tesoro, perla, red y escriba; 13:53-58 rechazo en Nazaret.',
      keyTerms: 'parábola, reino, sembrador, palabra, misterio, cizaña, tesoro, perla, red.',
      intertext: 'Isaías 6 explica oír sin entender. Las parábolas revelan y ocultan según la respuesta al reino.',
      caution: 'No leer las parábolas como cuentos morales simples. En Mateo 13 explican la recepción mezclada del reino y el juicio final.',
      synthesis: 'La conclusión cruda es que el reino llega de forma humilde y discutida, pero su valor es supremo y su juicio final separará respuestas verdaderas y falsas.'
    },
    'mateo 14': {
      unit: 'Mateo 14:1-12 muerte de Juan; 14:13-21 alimentación de los cinco mil; 14:22-33 Jesús camina sobre el mar; 14:34-36 sanidades.',
      keyTerms: 'Herodes, Juan, compasión, pan, multitud, mar, fe, Hijo de Dios.',
      intertext: 'El alimento en lugar desierto evoca provisión del éxodo. Caminar sobre el mar usa lenguaje de dominio divino sobre aguas.',
      caution: 'No separar la compasión de Jesús de la amenaza política contra Juan. El capítulo contrasta banquete de muerte de Herodes con provisión de vida de Jesús.',
      synthesis: 'La conclusión cruda es que el reino de Jesús se muestra en compasión y autoridad divina, frente al poder violento y temeroso de Herodes.'
    },
    'mateo 15': {
      unit: 'Mateo 15:1-20 tradición, pureza y corazón; 15:21-28 mujer cananea; 15:29-39 sanidades y alimentación de cuatro mil.',
      keyTerms: 'tradición, mandamiento, corazón, contaminar, cananea, migajas, compasión, pan.',
      intertext: 'Isaías 29:13 critica culto de labios sin corazón. La mujer cananea anticipa misericordia extendida más allá de Israel.',
      caution: 'No leer la pureza como simple higiene. Mateo trata autoridad de tradición frente a mandamiento y el problema profundo del corazón.',
      synthesis: 'La conclusión cruda es que Jesús desplaza la pureza superficial hacia el corazón y muestra que la misericordia del reino alcanza fronteras gentiles.'
    },
    'mateo 16': {
      unit: 'Mateo 16:1-12 señal, levadura de fariseos y saduceos; 16:13-20 confesión de Pedro; 16:21-28 primer anuncio de pasión y llamado a tomar la cruz.',
      keyTerms: 'señal, levadura, Cristo, Hijo del Dios viviente, iglesia, llaves, cruz, seguir.',
      intertext: 'La confesión mesiánica se entiende contra expectativas davídicas. La cruz corrige una esperanza mesiánica sin sufrimiento.',
      caution: 'No separar la confesión de Pedro del anuncio de la cruz. Mateo une identidad mesiánica y sufrimiento necesario.',
      synthesis: 'La conclusión cruda es que reconocer a Jesús como Mesías exige abandonar triunfalismo: el camino del Cristo y de sus discípulos pasa por la cruz.'
    },
    'mateo 17': {
      unit: 'Mateo 17:1-13 transfiguración; 17:14-21 niño endemoniado; 17:22-23 segundo anuncio de muerte; 17:24-27 impuesto del templo.',
      keyTerms: 'transfiguración, Moisés, Elías, Hijo amado, fe, montaña, muerte, templo.',
      intertext: 'Moisés y Elías representan Ley y Profetas. La voz celestial retoma el bautismo y manda escuchar al Hijo.',
      caution: 'No leer la transfiguración como experiencia aislada de gloria. Está entre anuncios de sufrimiento y confirma a Jesús como Hijo que debe ser escuchado.',
      synthesis: 'La conclusión cruda es que la gloria de Jesús no cancela la pasión; confirma que el Hijo amado cumple Ley y Profetas camino a la cruz.'
    },
    'mateo 18': {
      unit: 'Mateo 18:1-14 pequeños, humildad y oveja perdida; 18:15-20 disciplina comunitaria; 18:21-35 perdón y siervo inmisericorde.',
      keyTerms: 'pequeños, humildad, tropiezo, oveja perdida, hermano, iglesia, perdón, deuda.',
      intertext: 'La oveja perdida conecta con imágenes pastorales de Israel. La deuda impagable expresa misericordia recibida que debe transformarse en perdón.',
      caution: 'No usar Mateo 18 solo como procedimiento disciplinario. El capítulo completo trata cuidado de pequeños, restauración y perdón.',
      synthesis: 'La conclusión cruda es que la comunidad del reino debe proteger al vulnerable, buscar al perdido, corregir con humildad y perdonar desde la misericordia recibida.'
    },
    'mateo 19': {
      unit: 'Mateo 19:1-12 matrimonio, divorcio y celibato; 19:13-15 niños; 19:16-30 joven rico, riquezas y recompensa.',
      keyTerms: 'matrimonio, divorcio, principio, niños, vida eterna, rico, tesoro, seguir.',
      intertext: 'Génesis 1-2 sostiene la enseñanza sobre matrimonio. El Decálogo aparece en el diálogo con el joven rico.',
      caution: 'No leer el joven rico como simple llamado a caridad. El problema es lealtad: riqueza compite con seguir a Jesús.',
      synthesis: 'La conclusión cruda es que Jesús lleva matrimonio, niños y riqueza al orden del reino: el discipulado reordena vínculos, estatus y seguridad.'
    },
    'mateo 20': {
      unit: 'Mateo 20:1-16 obreros de la viña; 20:17-19 tercer anuncio de pasión; 20:20-28 grandeza como servicio; 20:29-34 sanidad de ciegos.',
      keyTerms: 'viña, jornal, primeros, últimos, beber la copa, servir, rescate, ciegos.',
      intertext: 'La viña es imagen común de Israel. El Hijo del Hombre que sirve y da su vida en rescate dialoga con Daniel 7 e Isaías 53.',
      caution: 'No leer la parábola como economía laboral moderna. Trata generosidad del reino y choque con criterios de mérito.',
      synthesis: 'La conclusión cruda es que el reino invierte jerarquías: Dios es generoso, y la grandeza de Jesús se muestra en servicio y entrega.'
    },
    'mateo 21': {
      unit: 'Mateo 21:1-11 entrada en Jerusalén; 21:12-17 templo; 21:18-22 higuera; 21:23-46 autoridad, dos hijos y labradores malvados.',
      keyTerms: 'rey, humilde, Hosanna, templo, higuera, autoridad, viña, piedra angular.',
      intertext: 'Zacarías 9, Salmo 118, Isaías 56 y Jeremías 7 se cruzan en entrada, templo y juicio profético.',
      caution: 'No leer la entrada como simple celebración popular. Mateo la une con juicio del templo y controversia de autoridad.',
      synthesis: 'La conclusión cruda es que Jesús entra como rey humilde y juez profético: confronta un sistema religioso sin fruto y reclama autoridad sobre el templo.'
    },
    'mateo 22': {
      unit: 'Mateo 22:1-14 banquete de bodas; 22:15-22 tributo al César; 22:23-33 resurrección; 22:34-40 gran mandamiento; 22:41-46 hijo y Señor de David.',
      keyTerms: 'banquete, invitados, César, resurrección, mandamiento, amor, David, Señor.',
      intertext: 'El banquete evoca esperanza profética. Éxodo 3 apoya la resurrección. Deuteronomio 6 y Levítico 19 resumen amor a Dios y prójimo. Salmo 110 redefine al Mesías davídico.',
      caution: 'No aislar "dad al César" como teoría política completa. En el capítulo es una trampa respondida por Jesús dentro de una serie de controversias.',
      synthesis: 'La conclusión cruda es que Jesús responde a trampas religiosas y políticas mostrando que el reino exige invitación aceptada, amor total y una visión más alta del Mesías.'
    },
    'mateo 23': {
      unit: 'Mateo 23:1-12 crítica a ostentación religiosa; 23:13-36 siete ayes contra escribas y fariseos; 23:37-39 lamento sobre Jerusalén.',
      keyTerms: 'hipócritas, escribas, fariseos, ay, justicia, misericordia, fidelidad, Jerusalén.',
      intertext: 'El lenguaje de ayes pertenece a tradición profética. El lamento sobre Jerusalén recuerda rechazo de profetas enviados por Dios.',
      caution: 'No usar Mateo 23 para desprecio antijudío. Es crítica profética interna contra líderes concretos y contra hipocresía religiosa.',
      synthesis: 'La conclusión cruda es que Jesús denuncia una religión que preserva apariencia pero devora justicia, misericordia y fidelidad.'
    },
    'mateo 24': {
      unit: 'Mateo 24:1-14 principio de dolores; 24:15-28 crisis y abominación; 24:29-35 venida del Hijo del Hombre; 24:36-51 vigilancia.',
      keyTerms: 'templo, dolores, abominación, tribulación, Hijo del Hombre, generación, velar.',
      intertext: 'Daniel informa la abominación y el Hijo del Hombre. Lenguaje profético de juicio cósmico describe caída de poderes y vindicación.',
      caution: 'No leer Mateo 24 como calendario moderno simplista. Hay que distinguir destrucción de Jerusalén, lenguaje apocalíptico y esperanza final.',
      synthesis: 'La conclusión cruda es que Jesús anuncia juicio sobre el orden del templo y llama a vigilancia fiel en medio de crisis, engaño y espera.'
    },
    'mateo 25': {
      unit: 'Mateo 25:1-13 diez vírgenes; 25:14-30 talentos; 25:31-46 juicio de las naciones.',
      keyTerms: 'reino, prudentes, velar, talentos, siervo fiel, Hijo del Hombre, ovejas, cabritos.',
      intertext: 'El Hijo del Hombre de Daniel 7 está detrás del juez entronizado. Las imágenes de siervos y vigilancia continúan Mateo 24.',
      caution: 'No leer Mateo 25 como salvación por activismo. El capítulo trata preparación, fidelidad y evidencia concreta de pertenencia al reino.',
      synthesis: 'La conclusión cruda es que la espera del reino debe producir vigilancia, fidelidad responsable y misericordia visible hacia los pequeños.'
    },
    'mateo 26': {
      unit: 'Mateo 26:1-16 complot y unción; 26:17-30 Pascua y cena; 26:31-46 Getsemaní; 26:47-75 arresto, juicio y negaciones.',
      keyTerms: 'Pascua, pacto, sangre, Getsemaní, copa, traición, Hijo del Hombre, negación.',
      intertext: 'Éxodo 12, Zacarías 13:7 y Daniel 7 son claves. La cena reinterpreta Pascua y pacto alrededor de la muerte de Jesús.',
      caution: 'No leer la pasión como accidente político. Mateo muestra cumplimiento, entrega voluntaria y tensión entre debilidad humana y obediencia del Hijo.',
      synthesis: 'La conclusión cruda es que Jesús entra en la muerte como siervo obediente: su sangre funda pacto mientras discípulos fallan y poderes religiosos lo condenan.'
    },
    'mateo 27': {
      unit: 'Mateo 27:1-10 muerte de Judas; 27:11-26 juicio ante Pilato; 27:27-44 burla y crucifixión; 27:45-56 muerte; 27:57-66 sepultura y guardia.',
      keyTerms: 'Pilato, rey de los judíos, Barrabás, cruz, templo, Hijo de Dios, velo, sepulcro.',
      intertext: 'Salmo 22, Jeremías/Zacarías y lenguaje del templo iluminan burla, sufrimiento, precio de sangre y velo rasgado.',
      caution: 'No usar Mateo 27 para culpar colectivamente a un pueblo. El texto narra responsabilidades históricas concretas dentro de líderes, multitud, Roma y discípulos.',
      synthesis: 'La conclusión cruda es que el rey rechazado muere en aparente vergüenza, pero señales cósmicas y del templo indican juicio, acceso abierto y verdadera identidad del Hijo de Dios.'
    },
    'mateo 28': {
      unit: 'Mateo 28:1-10 tumba vacía y anuncio a las mujeres; 28:11-15 reporte de guardias; 28:16-20 gran comisión.',
      keyTerms: 'resurrección, ángel, temor, gozo, Galilea, autoridad, discípulos, naciones, bautizar, enseñar.',
      intertext: 'Daniel 7 está detrás de la autoridad universal del Hijo del Hombre. La misión a las naciones cumple el arco de Abraham y la promesa de bendición.',
      caution: 'No reducir la gran comisión a estrategia institucional. Está fundada en la autoridad del Resucitado y exige formar discípulos obedientes.',
      synthesis: 'La conclusión cruda es que Mateo termina con Jesús vivo, investido de autoridad universal y presente con su comunidad mientras esta discipula a las naciones.'
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
    'hebreos 1': {
      unit: 'Hebreos 1:1-4 Dios habla definitivamente en el Hijo; 1:5-14 cadena de citas que muestra superioridad del Hijo sobre los ángeles.',
      keyTerms: 'Hijo, postreros días, resplandor, sustancia, purificación, ángeles, trono, heredar.',
      intertext: 'Salmo 2, 2 Samuel 7, Deuteronomio 32, Salmo 104, Salmo 45 y Salmo 110 sostienen la identidad real y superior del Hijo.',
      caution: 'No leer Hebreos 1 como especulación abstracta sobre ángeles. El argumento establece desde el inicio que la revelación final de Dios viene por el Hijo.',
      synthesis: 'La conclusión cruda es que el Hijo no es un mensajero más: comparte autoridad real, revela a Dios y sostiene todo, por eso su palabra exige atención superior.'
    },
    'hebreos 2': {
      unit: 'Hebreos 2:1-4 advertencia contra descuidar la salvación; 2:5-18 humillación, sufrimiento y solidaridad del Hijo con sus hermanos.',
      keyTerms: 'descuidar, salvación, mundo venidero, Hijo del Hombre, muerte, hermanos, misericordioso, sumo sacerdote.',
      intertext: 'Salmo 8 organiza la reflexión sobre humanidad y dominio. La encarnación se entiende como solidaridad real para vencer muerte y ayudar a los tentados.',
      caution: 'No separar la grandeza del Hijo de su sufrimiento. Hebreos afirma superioridad precisamente mostrando que el Hijo se hizo hermano y sufrió.',
      synthesis: 'La conclusión cruda es que el Hijo exaltado participó de carne y sangre para destruir el poder de la muerte y convertirse en sumo sacerdote misericordioso.'
    },
    'hebreos 3': {
      unit: 'Hebreos 3:1-6 Jesús superior a Moisés como Hijo sobre la casa; 3:7-19 advertencia desde la generación del desierto.',
      keyTerms: 'apóstol, sumo sacerdote, Moisés, casa, hoy, endurecer, incredulidad, reposo.',
      intertext: 'Números 12 y Salmo 95 son claves. La historia del desierto funciona como advertencia viva para la comunidad.',
      caution: 'No leer la comparación con Moisés como desprecio a Moisés. Hebreos honra a Moisés, pero afirma que Jesús tiene autoridad superior como Hijo.',
      synthesis: 'La conclusión cruda es que la comunidad debe escuchar hoy al Hijo y evitar la incredulidad que impidió a la generación del desierto entrar en el reposo.'
    },
    'hebreos 4': {
      unit: 'Hebreos 4:1-11 promesa de reposo aún abierta; 4:12-13 palabra viva que discierne; 4:14-16 Jesús, gran sumo sacerdote, acceso al trono de gracia.',
      keyTerms: 'reposo, promesa, hoy, palabra de Dios, discernir, sumo sacerdote, misericordia, gracia.',
      intertext: 'Génesis 2, Salmo 95 y la entrada a Canaán se combinan para mostrar que el reposo de Dios sigue teniendo cumplimiento abierto.',
      caution: 'No reducir el reposo a descanso emocional. En Hebreos es participación final en el propósito de Dios, recibida por fe perseverante.',
      synthesis: 'La conclusión cruda es que el reposo prometido exige perseverancia, porque la palabra expone el corazón y el sumo sacerdote abre acceso a misericordia.'
    },
    'hebreos 5': {
      unit: 'Hebreos 5:1-10 sumo sacerdote tomado de entre hombres y Cristo sacerdote según Melquisedec; 5:11-14 reprensión por inmadurez.',
      keyTerms: 'sumo sacerdote, compasión, llamado, Melquisedec, obediencia, padecimientos, madurez, leche.',
      intertext: 'Salmo 2 y Salmo 110 sostienen la filiación y sacerdocio de Cristo. Melquisedec prepara el argumento de Hebreos 7.',
      caution: 'No leer "aprendió obediencia" como si Cristo hubiera sido desobediente. El texto habla de obediencia probada en sufrimiento real.',
      synthesis: 'La conclusión cruda es que Cristo es sacerdote legítimo y compasivo, pero la comunidad necesita madurar para entender la profundidad de ese sacerdocio.'
    },
    'hebreos 6': {
      unit: 'Hebreos 6:1-8 llamado a avanzar y advertencia severa; 6:9-20 seguridad de la promesa jurada a Abraham y esperanza como ancla.',
      keyTerms: 'madurez, arrepentimiento, imposible, fruto, promesa, juramento, Abraham, esperanza, ancla.',
      intertext: 'Génesis 22 sostiene el juramento a Abraham. La imagen de ancla lleva la esperanza hacia el interior del velo, conectando con sacerdocio y santuario.',
      caution: 'No suavizar la advertencia ni usarla para desesperar a creyentes sensibles. El capítulo combina advertencia real y ánimo fuerte en la fidelidad de Dios.',
      synthesis: 'La conclusión cruda es que la perseverancia importa seriamente, pero la esperanza descansa en la promesa jurada de Dios y en el sacerdote que entró por nosotros.'
    },
    'hebreos 7': {
      unit: 'Hebreos 7:1-10 Melquisedec y Abraham; 7:11-19 cambio de sacerdocio y ley; 7:20-28 sacerdocio eterno y perfecto de Cristo.',
      keyTerms: 'Melquisedec, Abraham, diezmos, Leví, sacerdocio, juramento, pacto, interceder, perfecto.',
      intertext: 'Génesis 14 y Salmo 110 son la base. El argumento muestra un sacerdocio anterior y superior al levítico.',
      caution: 'No tratar a Melquisedec como curiosidad misteriosa. Hebreos lo usa para explicar la legitimidad y superioridad del sacerdocio de Cristo.',
      synthesis: 'La conclusión cruda es que Cristo es sacerdote eterno, no por genealogía levítica, sino por juramento divino y vida indestructible.'
    },
    'hebreos 8': {
      unit: 'Hebreos 8:1-6 sacerdote celestial y mejor ministerio; 8:7-13 cita de Jeremías sobre nuevo pacto.',
      keyTerms: 'santuario, tabernáculo verdadero, mediador, mejor pacto, nuevo pacto, corazón, perdón.',
      intertext: 'Jeremías 31:31-34 es central. El nuevo pacto promete ley interior, conocimiento de Dios y perdón definitivo.',
      caution: 'No leer "antiguo" como desprecio simplista del Antiguo Testamento. Hebreos argumenta desde las propias Escrituras que el nuevo pacto era prometido.',
      synthesis: 'La conclusión cruda es que el ministerio de Cristo inaugura el pacto prometido: interior, eficaz y fundado en perdón real.'
    },
    'hebreos 9': {
      unit: 'Hebreos 9:1-10 santuario terrenal y acceso limitado; 9:11-28 Cristo entra con su propia sangre y obtiene redención eterna.',
      keyTerms: 'tabernáculo, lugar santísimo, sangre, conciencia, redención eterna, mediador, una vez, juicio.',
      intertext: 'Levítico 16 y el Día de Expiación son el trasfondo principal. El sistema levítico apunta a una purificación más profunda realizada por Cristo.',
      caution: 'No leer la sangre como símbolo vacío. En Hebreos expresa vida ofrecida, purificación, pacto y acceso a Dios.',
      synthesis: 'La conclusión cruda es que Cristo supera el acceso limitado del santuario antiguo al ofrecerse una vez y abrir redención eficaz para la conciencia.'
    },
    'hebreos 10': {
      unit: 'Hebreos 10:1-18 insuficiencia de sacrificios repetidos y ofrenda única de Cristo; 10:19-25 acceso y perseverancia comunitaria; 10:26-39 advertencia y llamado a no retroceder.',
      keyTerms: 'sombra, sacrificio, cuerpo, santificar, una vez, velo, congregarse, advertencia, perseverar.',
      intertext: 'Salmo 40 y Jeremías 31 sostienen la obediencia del Hijo y el nuevo pacto. El lenguaje del velo conecta sacrificio y acceso.',
      caution: 'No leer "no dejando de congregarnos" como frase aislada. Está dentro de una llamada a perseverar juntos por el acceso abierto por Cristo.',
      synthesis: 'La conclusión cruda es que la ofrenda única de Cristo abre acceso real a Dios y exige perseverancia comunitaria, no retroceso.'
    },
    'hebreos 11': {
      unit: 'Hebreos 11 recorre testigos de fe desde Abel hasta los profetas, mostrando confianza perseverante antes de recibir plenamente lo prometido.',
      keyTerms: 'fe, esperanza, promesa, testimonio, peregrinos, patria, obediencia.',
      intertext: 'El capítulo relee Génesis, Éxodo, Josué, Jueces y la historia de Israel como cadena de fidelidad bajo promesa.',
      caution: 'No leer Hebreos 11 como galería de héroes autónomos. El punto es perseverar mirando la promesa y, en Hebreos 12, a Jesús.',
      synthesis: 'La conclusión cruda es que la fe bíblica no es optimismo; es perseverancia obediente ante promesas aún no consumadas.'
    },
    'hebreos 12': {
      unit: 'Hebreos 12:1-3 correr mirando a Jesús; 12:4-17 disciplina y santidad; 12:18-29 Sion celestial, nuevo pacto y Dios consumidor.',
      keyTerms: 'testigos, carrera, Jesús, disciplina, santidad, Esaú, Sion, mediador, reino inconmovible.',
      intertext: 'Proverbios 3 informa la disciplina. Esaú funciona como advertencia. Sinaí y Sion contrastan acceso temeroso y acceso del nuevo pacto.',
      caution: 'No leer disciplina como castigo cruel. Hebreos la entiende como formación filial para perseverar y participar de la santidad.',
      synthesis: 'La conclusión cruda es que la comunidad debe correr con perseverancia mirando a Jesús, porque ha recibido un reino inconmovible y una responsabilidad mayor.'
    },
    'hebreos 13': {
      unit: 'Hebreos 13:1-6 amor, hospitalidad, presos, matrimonio y contentamiento; 13:7-17 liderazgo, sacrificio de alabanza y salida fuera del campamento; 13:18-25 oración y cierre.',
      keyTerms: 'amor fraternal, hospitalidad, presos, contentamiento, líderes, altar, campamento, alabanza, pacto eterno.',
      intertext: 'El llamado a salir fuera del campamento retoma el sistema sacrificial y lo aplica a la identificación con el rechazo de Jesús.',
      caution: 'No leer Hebreos 13 como apéndice moral desconectado. Es la forma práctica de perseverar bajo el sacerdocio y pacto expuestos en el libro.',
      synthesis: 'La conclusión cruda es que la teología de Hebreos termina en comunidad concreta: amor, fidelidad, hospitalidad, alabanza y disposición a cargar el reproche de Cristo.'
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
