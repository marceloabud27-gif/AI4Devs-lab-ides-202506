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

function simplePassageExplanation(reference, verses) {
  if (!verses.length) {
    return {
      summary: 'No encontré ese pasaje en la Biblia cargada. Revisá que la referencia esté escrita como “Juan 3:16” o “Romanos 8”.',
      sections: [],
      lexicalRows: []
    };
  }

  const testament = verses.some((verse) => verse.testament === 'NEW') ? 'Nuevo Testamento' : 'Antiguo Testamento';
  const scope = verses.length === 1 ? 'Este versículo' : 'Este pasaje';
  const sample = verses[0];
  const isRomans829 = normalizeTerm(reference) === 'romanos 8:29';

  const sections = isRomans829
    ? [
        {
          title: 'Contexto',
          body: 'Romanos 8 habla de la vida guiada por el Espíritu, el sufrimiento presente y la esperanza futura. El versículo 29 no aparece aislado: forma parte de una cadena que explica por qué la esperanza del creyente no depende de circunstancias cambiantes.'
        },
        {
          title: 'Género y marco histórico',
          body: 'Es una carta apostólica. Pablo escribe a creyentes en Roma usando argumento teológico y pastoral. No está contando una historia, sino razonando para fortalecer la confianza de la comunidad.'
        },
        {
          title: 'Estructura literaria',
          body: 'La frase avanza en cadena: antes conoció, predestinó, llamó, justificó y glorificó. La estructura muestra una secuencia completa, desde el propósito de Dios hasta el destino final.'
        },
        {
          title: 'Crítica textual en sencillo',
          body: 'Para un estudio académico se compararía el texto griego crítico, como NA28. En esta app todavía no se copia NA28 ni NBLA/LBLA por licencia; el módulo queda listo para consultarlos mediante proveedor autorizado. La idea básica del versículo no depende de una variante textual conocida que cambie radicalmente el sentido.'
        },
        {
          title: 'Intertextualidad restringida',
          body: 'El versículo usa lenguaje de imagen y filiación. La conexión más responsable es intrabíblica y cercana: Cristo como Hijo y modelo del pueblo redimido. No conviene saltar directamente a debates dogmáticos sin terminar primero el argumento de Romanos 8.'
        },
        {
          title: 'Síntesis exegética',
          body: 'La conclusión cruda del texto es que Pablo presenta la salvación como una obra completa de Dios orientada a formar un pueblo semejante a Cristo. La tensión con discusiones actuales sobre libertad humana y predestinación existe, pero el versículo mismo enfatiza primero el propósito divino y la seguridad de esa obra.'
        }
      ]
    : [
        {
          title: 'Contexto',
          body: `${scope} pertenece a ${testament}, dentro de ${sample.book} ${sample.chapter}. La lectura responsable empieza mirando qué viene antes y después, quién habla y qué situación se está tratando.`
        },
        {
          title: 'Género y estructura',
          body: `El género debe definirse según el libro: narración, poesía, profecía, evangelio, carta u otro tipo de texto. La estructura inmediata ayuda a distinguir la idea principal de los detalles secundarios.`
        },
        {
          title: 'Crítica textual en sencillo',
          body: 'Un análisis académico compararía el Texto Masorético para el Antiguo Testamento o NA28 para el Nuevo, además de traducciones como LBLA/NBLA. En esta app se muestra el texto local RVA1909 y se deja lista la consulta autorizada para esas fuentes.'
        },
        {
          title: 'Léxico y sintaxis',
          body: 'Las palabras importantes no deben definirse solo por su raíz. Primero se mira cómo funcionan en la frase y luego se consulta un léxico especializado como HALOT o BDAG si hay acceso autorizado.'
        },
        {
          title: 'Síntesis exegética',
          body: 'La interpretación debe salir del texto en su contexto original. Después se puede pensar en aplicación, pero sin resolver tensiones teológicas antes de escuchar bien el pasaje.'
        }
      ];

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
  const cleaned = input.trim().replace(/\s+/g, ' ');
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
  return /\d+:\d+/.test(input) || /^[1-3]?\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s+\d+/.test(input.trim());
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
        body: 'Primero hay que identificar de qué libro y sección viene el texto. Sin esa ubicación, solo se puede observar el contenido inmediato, no su marco histórico completo.'
      },
      {
        title: 'Género y estructura',
        body: 'Observá si el texto narra, argumenta, manda, promete, lamenta o enseña. Esa forma literaria define cómo debe leerse.'
      },
      {
        title: 'Crítica textual en sencillo',
        body: 'Si el texto pertenece al Antiguo Testamento, se revisaría el Texto Masorético; si pertenece al Nuevo, NA28. LBLA/NBLA servirían como traducciones comparativas cuando haya acceso autorizado.'
      },
      {
        title: 'Léxico',
        body: 'Las palabras importantes deben explicarse por su uso dentro de la oración. HALOT y BDAG ayudan a confirmar el sentido, pero no reemplazan el contexto.'
      },
      {
        title: 'Síntesis',
        body: 'La conclusión debe salir del texto mismo: qué afirma, qué tensión deja abierta y qué no debemos resolver a la fuerza.'
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
        sections: [
          {
            title: 'Uso bíblico',
            body: `Encontré ${totalOccurrences || verses.length} ocurrencia(s) relacionadas. El significado se decide mirando cómo se usa la palabra en frases reales, no por una definición aislada.`
          },
          {
            title: 'Cuidado exegético',
            body: lexicalStudy.academicNote
          },
          {
            title: 'Síntesis',
            body: 'La palabra debe estudiarse en cada pasaje donde aparece. No siempre mantiene exactamente el mismo matiz.'
          }
        ],
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
