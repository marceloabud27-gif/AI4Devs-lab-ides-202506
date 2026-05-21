import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Clipboard, Eye, History, Loader2, Search, Sparkles, Star, Wand2 } from 'lucide-react';
import { analyzeInput } from './api.js';

const examples = ['Romanos 8:29', 'Juan 3:16', 'presciencia', 'gracia'];
const depthOptions = [
  { id: 'sencillo', label: 'Sencillo' },
  { id: 'estudiante', label: 'Estudiante' },
  { id: 'academico', label: 'Académico claro' }
];
const loadingSteps = ['buscando texto bíblico', 'identificando género', 'preparando léxico', 'generando síntesis'];
const secondTempleSources = [
  {
    source: 'Flavio Josefo',
    work: 'Antigüedades de los judíos; La guerra de los judíos',
    content: 'Historia judía, dinastía herodiana, dominio romano, grupos judíos, revueltas y destrucción del Templo.',
    context: 'Ayuda a ubicar a Jesús, los fariseos, saduceos, zelotes y el conflicto con Roma dentro de un marco político real.'
  },
  {
    source: 'Filón de Alejandría',
    work: 'Sobre la vida contemplativa; Legación a Gayo; tratados alegóricos',
    content: 'Judaísmo helenístico, lectura alegórica de la Torá, vida comunitaria, filosofía grecorromana y piedad judía.',
    context: 'Muestra cómo algunos judíos de la diáspora expresaban la fe bíblica con categorías filosóficas griegas.'
  },
  {
    source: '1 Enoc',
    work: 'Libro de los Vigilantes; Similitudes; Astronómico; Sueños; Epístola',
    content: 'Ángeles, juicio final, Hijo del Hombre, resurrección, castigo de impíos y esperanza escatológica.',
    context: 'Permite ver expectativas apocalípticas judías anteriores o cercanas al Nuevo Testamento.'
  },
  {
    source: 'Salmos de Salomón',
    work: 'Salmos 17-18',
    content: 'Esperanza de un mesías davídico justo, purificación de Jerusalén y derrota de gobernantes impíos.',
    context: 'Evidencia que algunos judíos esperaban un rey mesiánico ligado a justicia, restauración nacional y juicio.'
  },
  {
    source: 'Qumrán',
    work: 'Regla de la Comunidad; Documento de Damasco; Pesher Habacuc; Rollo de la Guerra',
    content: 'Comunidad sectaria, pureza, interpretación profética, guerra escatológica y oposición entre luz y tinieblas.',
    context: 'Muestra un judaísmo separatista que leía su tiempo como crisis final y esperaba intervención divina.'
  },
  {
    source: 'Tácito, Suetonio y Plinio el Joven',
    work: 'Anales; Vida de Claudio; Carta a Trajano',
    content: 'Referencias romanas a Judea, disturbios relacionados con judíos y cristianos, y prácticas cristianas tempranas.',
    context: 'Aportan una mirada externa romana, limitada pero útil, sobre el ambiente imperial y la recepción del movimiento cristiano.'
  }
];

const bookGroups = {
  evangelio: ['Mateo', 'Marcos', 'Lucas', 'Juan'],
  paulina: ['Romanos', '1 Corintios', '2 Corintios', 'Gálatas', 'Efesios', 'Filipenses', 'Colosenses', '1 Tesalonicenses', '2 Tesalonicenses', '1 Timoteo', '2 Timoteo', 'Tito', 'Filemón'],
  general: ['Hebreos', 'Santiago', '1 Pedro', '2 Pedro', '1 Juan', '2 Juan', '3 Juan', 'Judas'],
  apocaliptica: ['Apocalipsis'],
  tora: ['Génesis', 'Éxodo', 'Levítico', 'Números', 'Deuteronomio'],
  historia: ['Josué', 'Jueces', 'Rut', '1 Samuel', '2 Samuel', '1 Reyes', '2 Reyes', '1 Crónicas', '2 Crónicas', 'Esdras', 'Nehemías', 'Ester'],
  poesia: ['Job', 'Salmos', 'Proverbios', 'Eclesiastés', 'Cantares'],
  profetas: ['Isaías', 'Jeremías', 'Lamentaciones', 'Ezequiel', 'Daniel', 'Oseas', 'Joel', 'Amós', 'Abdías', 'Jonás', 'Miqueas', 'Nahúm', 'Habacuc', 'Sofonías', 'Hageo', 'Zacarías', 'Malaquías']
};

const bookAliases = {
  genesis: 'Génesis',
  exodo: 'Éxodo',
  levitico: 'Levítico',
  numeros: 'Números',
  deuteronomio: 'Deuteronomio',
  josue: 'Josué',
  jueces: 'Jueces',
  rut: 'Rut',
  '1 samuel': '1 Samuel',
  '2 samuel': '2 Samuel',
  '1 reyes': '1 Reyes',
  '2 reyes': '2 Reyes',
  '1 cronicas': '1 Crónicas',
  '2 cronicas': '2 Crónicas',
  esdras: 'Esdras',
  nehemias: 'Nehemías',
  ester: 'Ester',
  job: 'Job',
  salmos: 'Salmos',
  salmo: 'Salmos',
  proverbios: 'Proverbios',
  eclesiastes: 'Eclesiastés',
  cantares: 'Cantares',
  isaias: 'Isaías',
  jeremias: 'Jeremías',
  lamentaciones: 'Lamentaciones',
  ezequiel: 'Ezequiel',
  daniel: 'Daniel',
  oseas: 'Oseas',
  joel: 'Joel',
  amos: 'Amós',
  abdias: 'Abdías',
  jonas: 'Jonás',
  miqueas: 'Miqueas',
  nahum: 'Nahúm',
  habacuc: 'Habacuc',
  sofonias: 'Sofonías',
  hageo: 'Hageo',
  zacarias: 'Zacarías',
  malaquias: 'Malaquías',
  mateo: 'Mateo',
  marcos: 'Marcos',
  lucas: 'Lucas',
  juan: 'Juan',
  hechos: 'Hechos',
  romanos: 'Romanos',
  '1 corintios': '1 Corintios',
  '2 corintios': '2 Corintios',
  galatas: 'Gálatas',
  efesios: 'Efesios',
  filipenses: 'Filipenses',
  colosenses: 'Colosenses',
  '1 tesalonicenses': '1 Tesalonicenses',
  '2 tesalonicenses': '2 Tesalonicenses',
  '1 timoteo': '1 Timoteo',
  '2 timoteo': '2 Timoteo',
  tito: 'Tito',
  filemon: 'Filemón',
  hebreos: 'Hebreos',
  santiago: 'Santiago',
  '1 pedro': '1 Pedro',
  '2 pedro': '2 Pedro',
  '1 juan': '1 Juan',
  '2 juan': '2 Juan',
  '3 juan': '3 Juan',
  judas: 'Judas',
  apocalipsis: 'Apocalipsis'
};

const specificBookContexts = {
  Efesios: {
    setting: 'Efesios debe leerse dentro del ambiente urbano de Éfeso y Asia Menor: una región marcada por culto imperial, prestigio cívico, comercio, prácticas religiosas locales y fuerte identidad gentil. La carta trabaja la identidad de una comunidad formada por judíos y gentiles en Cristo, con énfasis en unidad, nueva humanidad, reconciliación y vida comunitaria.',
    culture: 'El trasfondo ayuda a entender imágenes como ciudadanía, herencia, poderes celestiales, templo santo y cuerpo. No conviene leer “misterio”, “potestades” o “unidad” como ideas abstractas: funcionan en un mundo donde religión, ciudad, familia, honor y lealtades públicas estaban conectadas.',
    sources: 'Hechos 19, literatura paulina, contexto de Asia Menor romana, culto imperial y estudios sobre religión urbana del siglo I.'
  },
  Mateo: {
    setting: 'Mateo se entiende mejor en un ambiente judeocristiano que discute identidad, Torá, justicia, autoridad de Jesús y relación con Israel. El Evangelio usa muchas citas y ecos del Antiguo Testamento, presenta a Jesús como Mesías davídico y maestro autorizado, y organiza su enseñanza con fuerte sensibilidad judía.',
    culture: 'El contexto del Judaísmo del Segundo Templo es clave: reino de los cielos, cumplimiento, justicia, fariseos, escribas, sinagoga, pureza, limosna, oración y ayuno no son conceptos modernos, sino prácticas y debates judíos del siglo I.',
    sources: 'Tradiciones sinópticas, Escrituras de Israel, debates fariseos sobre Torá, Josefo, literatura judía temprana y estudios sobre comunidades judeocristianas.'
  },
  Romanos: {
    setting: 'Romanos se dirige a creyentes en la capital imperial, con tensiones entre judíos y gentiles después de conflictos sociales y expulsiones previas. Pablo argumenta sobre justicia de Dios, pecado, Torá, Abraham, Israel, gentiles y vida comunitaria.',
    culture: 'La carta combina Escritura judía, retórica epistolar y realidad imperial romana. Temas como ley, gracia, fe, carne, espíritu e Israel deben leerse dentro del debate judío-gentil del siglo I.',
    sources: 'Romanos, Escrituras de Israel, información romana sobre judíos en Roma, Suetonio, Josefo y estudios de comunidad mixta judío-gentil.'
  },
  Juan: {
    setting: 'Juan presenta a Jesús con lenguaje simbólico denso: vida, luz, verdad, gloria, mundo, señales y testimonio. El libro refleja disputas sobre identidad de Jesús, autoridad, templo, fiestas judías y pertenencia comunitaria.',
    culture: 'Las fiestas, el templo, el agua, el pan, la luz y el pastor no son adornos: son símbolos judíos cargados de memoria bíblica y litúrgica.',
    sources: 'Evangelio de Juan, fiestas judías, Escrituras de Israel, tradición sapiencial, debates sinagogales y contexto judeorromano.'
  }
};

const bookHistoryDetails = {
  Mateo: {
    place: 'Probablemente Siria o una comunidad judeocristiana de habla griega cercana a Antioquía; la ubicación exacta no es segura.',
    audience: 'Creyentes judíos y gentiles que necesitaban entender a Jesús dentro de la historia de Israel, la Torá y las promesas mesiánicas.',
    purpose: 'Mostrar que Jesús es el Mesías davídico, maestro autorizado y cumplimiento de las Escrituras, y formar una comunidad obediente a sus enseñanzas.',
    history: 'Mateo refleja un ambiente donde la identidad judía, la sinagoga, la Torá, los escribas y fariseos, y la pregunta por el verdadero pueblo de Dios eran temas vivos. El libro organiza la vida y enseñanza de Jesús con énfasis en discursos, cumplimiento bíblico, reino de los cielos y justicia del discípulo. Su público parece conocer bien el Antiguo Testamento y los debates judíos del siglo I.'
  },
  Marcos: {
    place: 'Tradicionalmente asociado con Roma, aunque algunos proponen Siria o Galilea; la tradición romana es antigua pero no definitiva.',
    audience: 'Cristianos gentiles o mixtos que necesitaban una narración clara de Jesús en medio de sufrimiento, persecución o presión imperial.',
    purpose: 'Presentar a Jesús como Mesías sufriente e Hijo de Dios, destacando su autoridad, su camino hacia la cruz y el llamado al discipulado.',
    history: 'Marcos es breve, directo y narrativo. Explica costumbres judías más que Mateo, lo que sugiere lectores no plenamente familiarizados con Judea. La cruz no aparece como accidente, sino como centro del camino de Jesús. El trasfondo de presión social ayuda a entender el llamado a seguir a Jesús aun cuando implique pérdida y sufrimiento.'
  },
  Lucas: {
    place: 'Probablemente escrito para comunidades grecorromanas fuera de Palestina; se ha propuesto Antioquía, Asia Menor o Acaya.',
    audience: 'Lectores cristianos de trasfondo gentil, representados por Teófilo, que necesitaban seguridad histórica y ordenada sobre Jesús.',
    purpose: 'Dar un relato ordenado de Jesús y mostrar que la salvación prometida a Israel se abre también a los gentiles, pobres, marginados y pecadores.',
    history: 'Lucas escribe con sensibilidad histórica y literaria. Conecta a Jesús con la historia de Israel, pero también con el mundo romano. Destaca oración, Espíritu, reversión social, misericordia, mujeres, pobres y extranjeros. Su segundo tomo, Hechos, continúa la expansión del evangelio desde Jerusalén hacia las naciones.'
  },
  Juan: {
    place: 'Tradicionalmente asociado con Éfeso o Asia Menor; la ubicación exacta sigue debatida.',
    audience: 'Comunidades cristianas que enfrentaban disputas sobre la identidad de Jesús, su relación con el Padre y su lugar frente a la sinagoga.',
    purpose: 'Llevar al lector a reconocer a Jesús como el Cristo, el Hijo de Dios, y entender sus señales, discursos y muerte a la luz de la vida que él da.',
    history: 'Juan usa lenguaje simbólico profundo: vida, luz, verdad, gloria, mundo, testimonio, pan, agua, vid y pastor. El libro respira ambiente judío: fiestas, templo, Escritura, purificación y debates de autoridad. Su historia no es solo biográfica; organiza los hechos para mostrar quién es Jesús y por qué su rechazo y su muerte revelan su gloria.'
  },
  Hechos: {
    place: 'Probablemente escrito en el mismo entorno de Lucas, para lectores grecorromanos vinculados a comunidades cristianas fuera de Palestina.',
    audience: 'Cristianos gentiles y mixtos que necesitaban entender cómo el movimiento de Jesús pasó de Jerusalén al mundo romano.',
    purpose: 'Mostrar la expansión del evangelio por obra del Espíritu, desde Jerusalén hasta Roma, y legitimar la misión a los gentiles.',
    history: 'Hechos presenta la transición desde una comunidad judía en Jerusalén hacia iglesias compuestas por judíos y gentiles. Narra tensiones con autoridades judías, persecución, viajes misioneros, debates sobre la Ley y presencia del imperio romano. Su historia explica por qué la fe en Jesús no quedó como secta local, sino como movimiento mediterráneo.'
  },
  Romanos: {
    place: 'Probablemente escrita desde Corinto o Cencreas durante el tercer viaje misionero de Pablo.',
    audience: 'Cristianos en Roma, judíos y gentiles, con tensiones de identidad después de conflictos y expulsiones de judíos bajo Claudio.',
    purpose: 'Exponer el evangelio de la justicia de Dios, unir a judíos y gentiles en una misma comunidad y preparar apoyo para la misión hacia España.',
    history: 'Romanos nace en una iglesia que Pablo no fundó. La capital imperial reunía diversidad social, esclavos, libertos, judíos, gentiles y casas-iglesia. La carta trabaja pecado, Ley, gracia, Abraham, Israel, Espíritu, vida comunitaria y autoridad civil. Su trasfondo es pastoral y misionero, no un tratado abstracto separado de una comunidad real.'
  },
  '1 Corintios': {
    place: 'Escrita desde Éfeso.',
    audience: 'La iglesia de Corinto, una comunidad urbana, diversa y conflictiva en una ciudad comercial grecorromana.',
    purpose: 'Corregir divisiones, inmoralidad, abusos en la cena del Señor, confusión sobre dones espirituales y preguntas sobre matrimonio, comida y resurrección.',
    history: 'Corinto era una ciudad portuaria rica, competitiva y marcada por honor social, patronazgo, retórica pública y diversidad religiosa. Pablo responde problemas concretos, no teorías. La carta muestra cómo el evangelio confronta orgullo, estatus, sexualidad, culto comunitario y negación de la resurrección.'
  },
  '2 Corintios': {
    place: 'Probablemente escrita desde Macedonia.',
    audience: 'La misma iglesia de Corinto, después de conflictos severos entre Pablo y parte de la comunidad.',
    purpose: 'Defender el ministerio apostólico de Pablo, restaurar la relación con la iglesia y preparar la colecta para Jerusalén.',
    history: 'La carta refleja tensión emocional, acusaciones contra Pablo y competencia con líderes que se presentaban como superiores. Pablo responde mostrando que el ministerio apostólico se reconoce en debilidad, sufrimiento, integridad y servicio, no en espectáculo retórico o prestigio social.'
  },
  Gálatas: {
    place: 'Probablemente escrita por Pablo a iglesias de Galacia; la fecha y si se trata del norte o sur de Galacia es debatido.',
    audience: 'Comunidades gentiles presionadas por maestros que exigían circuncisión y adopción de marcas de identidad judía.',
    purpose: 'Defender que los gentiles son incorporados al pueblo de Dios por la fe en Cristo y no por convertirse en judíos mediante la Ley.',
    history: 'Gálatas surge de una crisis de identidad. La pregunta central no es religión privada, sino quién pertenece al pueblo de Dios y bajo qué condiciones. Pablo argumenta desde su llamado, Abraham, la promesa, la Ley, el Espíritu y la cruz para proteger la libertad de los gentiles en Cristo.'
  },
  Efesios: {
    era: 'Probablemente década del 60 d.C., si se mantiene la atribución paulina desde prisión. Algunos estudiosos proponen una fecha posterior dentro de la tradición paulina; la app lo presenta como dato probable, no como certeza absoluta.',
    place: 'Tradicionalmente asociada con Pablo en prisión, posiblemente Roma. La carta pudo circular en Éfeso y otras iglesias de Asia Menor, por eso su tono es más amplio que una carta dirigida a un solo problema local.',
    audience: 'Creyentes mayormente gentiles, junto con judíos cristianos, en comunidades urbanas de Asia Menor.',
    purpose: 'Explicar la nueva identidad del pueblo de Dios en Cristo: judíos y gentiles reconciliados en un solo cuerpo, viviendo una nueva humanidad.',
    social: 'Éfeso era una ciudad urbana, comercial y religiosa. La vida social estaba marcada por honor público, familias extendidas, esclavitud doméstica, patronazgo, gremios, relaciones de poder y presión por pertenecer a la vida cívica de la ciudad.',
    cultural: 'La ciudad era famosa por el templo de Artemisa y por prácticas religiosas, mágicas y devocionales. Ese ambiente ayuda a entender el lenguaje de Efesios sobre poderes, potestades, vida nueva, pureza, luz, familia y resistencia espiritual.',
    political: 'Éfeso estaba dentro del orden imperial romano. La ciudadanía, el prestigio urbano, el culto imperial y la estabilidad pública importaban mucho. Por eso la carta no habla solo de vida privada: presenta una comunidad alternativa cuya lealtad principal está en Cristo.',
    generalReading: 'En Efesios, los capítulos 1-3 presentan la identidad y obra de Dios en Cristo: elección, gracia, reconciliación y unión de judíos y gentiles. Los capítulos 4-6 aplican esa identidad a la vida concreta. Por eso Efesios 4 debe leerse como el paso de la doctrina a la práctica: vivir dignamente, guardar la unidad, madurar como cuerpo, abandonar la vida vieja y caminar como nueva humanidad.',
    history: 'Efesios debe leerse como una carta de identidad comunitaria. No se concentra en un conflicto puntual, sino en formar una comunidad que entienda quién es en Cristo y cómo debe vivir dentro de una ciudad poderosa, religiosa y socialmente estratificada. Su historia ayuda a leer “templo”, “cuerpo”, “misterio”, “unidad”, “poderes” y “andar” como lenguaje comunitario, social y espiritual.'
  },
  Filipenses: {
    place: 'Escrita desde prisión, probablemente Roma, aunque Éfeso o Cesarea también son propuestas.',
    audience: 'La iglesia de Filipos, una colonia romana de Macedonia con fuerte identidad cívica imperial.',
    purpose: 'Animar a la comunidad a perseverar, vivir en humildad y unidad, y sostener la misión en medio de sufrimiento.',
    history: 'Filipos era una colonia romana orgullosa de su ciudadanía. Pablo escribe desde prisión a una iglesia que lo apoyó económicamente. El trasfondo de ciudadanía, honor y lealtad imperial ilumina el llamado a vivir como ciudadanos dignos del evangelio y confesar a Cristo como Señor.'
  },
  Colosenses: {
    place: 'Tradicionalmente escrita por Pablo desde prisión.',
    audience: 'Cristianos de Colosas, una comunidad de Asia Menor que Pablo probablemente no conocía personalmente.',
    purpose: 'Afirmar la supremacía de Cristo y advertir contra enseñanzas que mezclaban prácticas ascéticas, poderes espirituales y regulaciones religiosas.',
    history: 'Colosas era una ciudad menor del valle del Lico, cerca de Laodicea y Hierápolis. La carta responde a presiones religiosas que prometían plenitud por prácticas especiales. El énfasis histórico es que la comunidad no necesita añadir sistemas de poder o rituales a Cristo para estar completa.'
  },
  '1 Tesalonicenses': {
    place: 'Escrita probablemente desde Corinto.',
    audience: 'La joven iglesia de Tesalónica, ciudad importante de Macedonia, formada bajo presión social.',
    purpose: 'Animar a creyentes recientes, afirmar su esperanza y aclarar dudas sobre la venida del Señor y los creyentes que habían muerto.',
    history: 'Tesalónica era una ciudad estratégica y leal a Roma. La iglesia nació en medio de oposición. Pablo escribe con tono afectuoso para fortalecer fe, amor, trabajo, santidad y esperanza. El tema escatológico responde a angustias reales, no a curiosidad especulativa.'
  },
  '2 Tesalonicenses': {
    place: 'Probablemente escrita desde Corinto si se acepta autoría paulina temprana.',
    audience: 'La iglesia de Tesalónica, todavía bajo presión y confundida sobre el día del Señor.',
    purpose: 'Corregir alarma escatológica, animar perseverancia y ordenar una vida responsable mientras esperan al Señor.',
    history: 'La carta refleja una comunidad inquieta por persecución y mensajes sobre el fin. Su contexto no es cálculo de fechas, sino resistencia, discernimiento y trabajo fiel. Habla de oposición, engaño y disciplina comunitaria.'
  },
  '1 Timoteo': {
    place: 'Tradicionalmente dirigida a Timoteo en Éfeso; la situación exacta depende del debate sobre las Pastorales.',
    audience: 'Timoteo y la iglesia de Éfeso, con problemas de enseñanza, orden comunitario y liderazgo.',
    purpose: 'Organizar la vida de la iglesia, corregir falsas enseñanzas y establecer criterios para líderes.',
    history: 'La carta refleja una etapa donde la comunidad necesita estabilidad doctrinal y orden público. Éfeso era un centro religioso y urbano complejo. El énfasis está en enseñanza sana, oración, conducta comunitaria, cuidado de viudas y carácter de ancianos y diáconos.'
  },
  '2 Timoteo': {
    place: 'Tradicionalmente escrita desde prisión en Roma, cerca del final de la vida de Pablo.',
    audience: 'Timoteo, colaborador de Pablo, en un contexto de abandono, sufrimiento y necesidad de perseverancia.',
    purpose: 'Animar a Timoteo a guardar el evangelio, enseñar fielmente y soportar sufrimiento.',
    history: 'La carta tiene tono de despedida. Refleja soledad, peligro, falsos maestros y transmisión generacional del ministerio. Su historia no es triunfalista: presenta fidelidad en medio de desgaste, prisión y oposición.'
  },
  Tito: {
    place: 'Dirigida a Tito en Creta.',
    audience: 'Tito y comunidades cristianas cretenses que necesitaban orden, liderazgo y enseñanza sana.',
    purpose: 'Establecer ancianos, corregir enseñanzas dañinas y formar una vida comunitaria visible y honorable.',
    history: 'Creta tenía fama antigua de conflictos morales y sociales, aunque esa fama debe leerse con cuidado. La carta busca organizar iglesias jóvenes para que su conducta pública no desacredite el mensaje. El énfasis está en doctrina sana que produce vida ordenada.'
  },
  Filemón: {
    place: 'Escrita desde prisión, tradicionalmente por Pablo.',
    audience: 'Filemón, Apia, Arquipo y la iglesia que se reunía en su casa.',
    purpose: 'Interceder por Onésimo y transformar una relación social rota a la luz de la fraternidad en Cristo.',
    history: 'Filemón es una carta personal dentro del mundo de esclavitud doméstica romana. Pablo no escribe un tratado social completo, sino una apelación concreta. El trasfondo de honor, deuda, patronazgo y casa-iglesia ayuda a entender la fuerza pastoral de su petición.'
  },
  Hebreos: {
    place: 'Lugar desconocido; “los de Italia” sugiere alguna conexión con Roma, pero no decide el origen.',
    audience: 'Cristianos con fuerte conocimiento del Antiguo Testamento, probablemente bajo presión y tentados a retroceder.',
    purpose: 'Mostrar la superioridad de Cristo, su sacerdocio y su sacrificio, para exhortar a perseverar.',
    history: 'Hebreos combina sermón y carta. Su público conoce templo, sacrificios, sacerdocio, pacto y Escrituras. El trasfondo de cansancio, persecución y peligro de abandonar la confesión explica las advertencias fuertes y el énfasis en Cristo como mediador definitivo.'
  },
  Santiago: {
    place: 'Asociada tradicionalmente con Santiago en Jerusalén, dirigida a creyentes judíos de la diáspora.',
    audience: 'Las “doce tribus en la dispersión”: comunidades creyentes con trasfondo judío, pobreza, tensiones sociales y necesidad de sabiduría práctica.',
    purpose: 'Llamar a una fe íntegra que se muestra en obras, dominio de la lengua, justicia, paciencia y humildad.',
    history: 'Santiago suena como sabiduría judía aplicada a comunidades cristianas. El libro refleja desigualdad económica, favoritismo hacia ricos, conflictos internos y opresión. Su historia se entiende mejor en continuidad con Proverbios, profetas y enseñanza ética judía.'
  },
  '1 Pedro': {
    place: 'Escrita desde “Babilonia”, probablemente una forma simbólica de referirse a Roma.',
    audience: 'Cristianos dispersos en Asia Menor, muchos gentiles, viviendo como minoría social bajo sospecha.',
    purpose: 'Animar a vivir con santidad, esperanza y buen testimonio en medio de sufrimiento injusto.',
    history: '1 Pedro se dirige a comunidades extranjeras y marginadas en su propio entorno social. Usa lenguaje de identidad de Israel aplicado a creyentes en Cristo. El sufrimiento no parece persecución imperial sistemática todavía, sino presión social, calumnia y exclusión.'
  },
  '2 Pedro': {
    place: 'Lugar incierto; se presenta como testamento apostólico de Pedro.',
    audience: 'Comunidades cristianas amenazadas por falsos maestros y burla sobre la venida del Señor.',
    purpose: 'Defender la memoria apostólica, la vida piadosa y la certeza del juicio y promesa futura.',
    history: '2 Pedro refleja preocupación por continuidad después de la generación apostólica. Enfrenta maestros que relativizan juicio, conducta y esperanza. Su historia es de preservación de enseñanza frente a distorsiones internas.'
  },
  '1 Juan': {
    place: 'Probablemente Asia Menor, dentro del círculo joánico.',
    audience: 'Comunidades afectadas por ruptura interna y desacuerdo sobre Jesús, pecado, amor y obediencia.',
    purpose: 'Dar seguridad a los creyentes y distinguir la confesión verdadera de interpretaciones que separaban a Cristo de la vida ética.',
    history: '1 Juan no tiene forma típica de carta. Responde a una crisis comunitaria: algunos salieron y dejaron confusión. El libro insiste en la encarnación, el amor fraternal, la obediencia y el discernimiento espiritual.'
  },
  '2 Juan': {
    place: 'Probablemente Asia Menor.',
    audience: 'La “señora elegida” y sus hijos, quizá una iglesia local.',
    purpose: 'Animar a caminar en verdad y amor, y advertir contra maestros que niegan la venida de Cristo en carne.',
    history: '2 Juan refleja iglesias domésticas y movilidad de maestros cristianos. La hospitalidad era importante, pero también podía facilitar doctrinas dañinas. La carta equilibra amor comunitario y discernimiento.'
  },
  '3 Juan': {
    place: 'Probablemente Asia Menor.',
    audience: 'Gayo, un creyente que apoyaba misioneros itinerantes.',
    purpose: 'Elogiar la hospitalidad de Gayo y denunciar el control abusivo de Diótrefes.',
    history: '3 Juan muestra la vida concreta de iglesias domésticas: hospitalidad, autoridad local, recomendación de enviados y conflictos de liderazgo. Es una ventana breve pero valiosa al funcionamiento comunitario temprano.'
  },
  Judas: {
    place: 'Lugar incierto.',
    audience: 'Cristianos amenazados por maestros inmorales que distorsionaban la gracia.',
    purpose: 'Exhortar a contender por la fe recibida y advertir con ejemplos de juicio.',
    history: 'Judas usa tradiciones judías, ejemplos del Antiguo Testamento y literatura como 1 Enoc. Su contexto muestra comunidades que necesitaban discernir entre gracia verdadera y libertinaje religioso.'
  },
  Apocalipsis: {
    place: 'Escrito desde Patmos, dirigido a iglesias de Asia Menor.',
    audience: 'Siete iglesias de Asia Menor bajo presión imperial, tentación de acomodación y conflicto espiritual.',
    purpose: 'Revelar la soberanía de Dios y del Cordero, llamar a perseverar y desenmascarar el poder imperial idolátrico.',
    history: 'Apocalipsis pertenece al género apocalíptico-profético. Usa símbolos de Daniel, Ezequiel, Éxodo y culto celestial. Su mundo histórico incluye Asia Menor romana, culto imperial, comercio, persecución local y seducción cultural. No fue escrito como código moderno, sino como visión pastoral para iglesias reales.'
  }
};

function getBookHistory(book) {
  if (!book) return null;
  const history = bookHistoryDetails[book];
  return history ? { book, ...history } : null;
}

function detectInputKind(value) {
  const cleaned = value.trim();
  if (!cleaned) return { label: 'Esperando consulta', helper: 'Escribí una palabra, un versículo o pegá un texto.' };
  if (/\d+:\d+/.test(cleaned) || /\bcap[ií]tulo\s+\d+/i.test(cleaned) || /^[1-3]?\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s+\d+/.test(cleaned)) {
    return { label: 'Detecté un pasaje', helper: 'Voy a mostrar primero el texto bíblico y después el análisis.' };
  }
  if (cleaned.split(/\s+/).filter(Boolean).length <= 3) {
    return { label: 'Detecté una palabra o tema', helper: 'Voy a buscar usos bíblicos y explicar el sentido en contexto.' };
  }
  return { label: 'Detecté texto pegado', helper: 'Voy a analizarlo como texto y señalar qué falta para ubicarlo mejor.' };
}

function modeLabel(mode) {
  if (mode === 'passage') return 'Pasaje';
  if (mode === 'word') return 'Palabra';
  return 'Texto';
}

function formatStudyForCopy(result) {
  const lines = [
    `Biblia en Contexto - ${result.title}`,
    '',
    `Tipo: ${modeLabel(result.mode)}`,
    `Resumen: ${result.explanation}`,
    ''
  ];

  if (result.verses?.length) {
    lines.push('Texto bíblico:');
    for (const verse of result.verses) {
      lines.push(`${verse.reference}: ${verse.clearText ?? verse.text}`);
    }
    lines.push('');
  }

  if (result.sections?.length) {
    lines.push('Análisis:');
    for (const section of result.sections) {
      lines.push(`${section.title}: ${section.body}`);
    }
    lines.push('');
  }

  if (result.lexicalRows?.length) {
    lines.push('Palabras clave:');
    for (const row of result.lexicalRows) {
      lines.push(`${row.lemma}: ${row.semantics} Uso: ${row.contextualUse}`);
    }
  }

  return lines.join('\n');
}

function sectionId(title) {
  return title.toLowerCase().replace(/\s+/g, '-');
}

function normalizeText(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function detectBook(value) {
  const normalized = normalizeText(value).replace(/[:.,;].*$/, '');
  const sortedAliases = Object.keys(bookAliases).sort((a, b) => b.length - a.length);
  return sortedAliases.find((alias) => normalized === alias || normalized.startsWith(`${alias} `))
    ? bookAliases[sortedAliases.find((alias) => normalized === alias || normalized.startsWith(`${alias} `))]
    : null;
}

function bookGroup(book) {
  return Object.entries(bookGroups).find(([, books]) => books.includes(book))?.[0] ?? 'general-biblico';
}

function getBookHistoricalContext(value) {
  const book = detectBook(value);

  if (!book) {
    return {
      book: 'Judaísmo del Segundo Templo',
      group: 'general',
      setting: 'Escribí un libro o pasaje para que el marco histórico se adapte a esa búsqueda. Mientras tanto, este módulo muestra el contexto general del judaísmo del siglo I a.C. y siglo I d.C.',
      culture: 'El contexto general ayuda a ubicar Torá, Templo, Roma, escatología, grupos judíos, literatura apocalíptica y metáforas comunes.',
      sources: 'Josefo, Filón, literatura apócrifa y pseudoepigráfica, Qumrán y autores romanos.'
    };
  }

  if (specificBookContexts[book]) {
    return { book, group: bookGroup(book), ...specificBookContexts[book] };
  }

  const group = bookGroup(book);
  const genericByGroup = {
    evangelio: {
      setting: `${book} debe leerse dentro del mundo judío del siglo I: sinagoga, Torá, expectativas del reino, ocupación romana, autoridad de escribas y fariseos, y memoria de las Escrituras de Israel.`,
      culture: 'Las parábolas, disputas, sanidades, comidas, genealogías, títulos mesiánicos y referencias al Templo tienen sentido dentro de prácticas judías concretas, no como ideas religiosas aisladas.',
      sources: 'Tradición sinóptica o joánica, Escrituras de Israel, Josefo, Qumrán, literatura apocalíptica judía y estudios del Judaísmo del Segundo Templo.'
    },
    paulina: {
      setting: `${book} pertenece al mundo de las comunidades cristianas tempranas dentro del imperio romano, con tensiones entre identidad judía, gentiles incorporados, vida urbana, casas-iglesia, honor social y lealtad a Cristo.`,
      culture: 'Conceptos como fe, gracia, ley, cuerpo, santidad, poderes, ciudadanía y herencia deben leerse en diálogo con la Escritura judía y la realidad grecorromana del siglo I.',
      sources: 'Cartas paulinas, Hechos, Escrituras de Israel, inscripciones urbanas, Josefo, Filón y estudios sobre comunidades judío-gentiles.'
    },
    general: {
      setting: `${book} se ubica en comunidades cristianas tempranas que leen a Jesús a la luz de la Escritura judía, bajo presión social, debates internos y expectativas escatológicas.`,
      culture: 'El honor, la perseverancia, la comunidad, la pureza, el sufrimiento justo y la esperanza final son categorías del mundo judío y grecorromano, no abstracciones modernas.',
      sources: 'Cartas generales, Escrituras de Israel, literatura judía temprana, Qumrán y contexto social del imperio romano.'
    },
    apocaliptica: {
      setting: `${book} pertenece al género apocalíptico: visiones simbólicas, conflicto cósmico, juicio, imperios, perseverancia comunitaria y esperanza de intervención divina.`,
      culture: 'Bestias, tronos, sellos, templo, ciudad, bodas, número y juicio deben leerse dentro del lenguaje simbólico judío apocalíptico, no como cronograma moderno directo.',
      sources: 'Daniel, Ezequiel, Zacarías, 1 Enoc, Qumrán, literatura apocalíptica judía y contexto imperial romano.'
    },
    tora: {
      setting: `${book} pertenece a la Torá, núcleo identitario de Israel. Aunque el texto es anterior al Segundo Templo, era leído en el siglo I como fundamento de pacto, pureza, culto, calendario, tierra y obediencia.`,
      culture: 'Las leyes, genealogías, narraciones y ritos funcionaban como memoria formativa para comunidades judías bajo dominio extranjero.',
      sources: 'Texto bíblico hebreo, tradición judía interpretativa, Filón, Josefo, Qumrán y recepción de la Torá en el siglo I.'
    },
    historia: {
      setting: `${book} narra memoria histórica de Israel: tierra, monarquía, templo, exilio, liderazgo, fidelidad e infidelidad. En el siglo I estos relatos alimentaban identidad nacional y esperanza de restauración.`,
      culture: 'Reyes, sacerdotes, pactos, guerras y exilio eran categorías vivas para judíos bajo Roma, especialmente al pensar en restauración y juicio.',
      sources: 'Libros históricos, Josefo, tradición judía, Qumrán y lectura de Israel bajo ocupación extranjera.'
    },
    poesia: {
      setting: `${book} pertenece a poesía o sabiduría de Israel. En el siglo I estos textos formaban oración, ética, lamento, esperanza, culto y enseñanza comunitaria.`,
      culture: 'Salmos, proverbios, sufrimiento, sabiduría, justicia y temor de Dios se leían como lenguaje de vida fiel, no como frases sueltas.',
      sources: 'Poesía hebrea, tradición sapiencial, uso litúrgico judío, Qumrán y recepción en el Nuevo Testamento.'
    },
    profetas: {
      setting: `${book} pertenece al corpus profético. En el siglo I, los profetas eran leídos para entender juicio, exilio, restauración, templo, justicia, naciones y esperanza escatológica.`,
      culture: 'Imágenes como viña, siervo, pastor, nuevo pacto, día del Señor y restauración de Sion eran parte del vocabulario religioso del período.',
      sources: 'Texto profético, Qumrán, literatura apocalíptica, Josefo y recepción de los profetas en el Nuevo Testamento.'
    }
  };

  return { book, group, ...genericByGroup[group] };
}

function historicalSectionsForBook(bookContext) {
  const specific = {
    Mateo: {
      worldview: 'Para Mateo, la cosmovisión relevante es la de un judaísmo del siglo I que discute Torá, justicia, reino, identidad de Israel, autoridad de escribas y fariseos, pureza, oración, limosna, ayuno y esperanza mesiánica. El marco no es cristianismo posterior, sino una comunidad que lee a Jesús dentro de las Escrituras de Israel y de debates judíos vivos.',
      literature: 'En Mateo importan especialmente las formas judías de enseñanza: parábolas, dichos sapienciales, controversias legales, genealogía, tipología de Moisés, cumplimiento profético y ecos de Isaías, Oseas, Jeremías, Daniel y Zacarías. Las imágenes de reino, viña, banquete, siervo, pastor, juez y bodas ya tenían resonancia en la tradición bíblica y judía.',
      historians: 'Josefo ayuda a ubicar fariseos, saduceos, Herodes, templo y tensiones con Roma. Filón sirve para comparar judaísmo helenístico, aunque Mateo es más palestino/judeocristiano en tono. Los romanos aportan el marco imperial que condiciona la vida judía bajo ocupación.',
      evidence: [
        ['Evangelio de Mateo', 'Genealogía, discursos, cumplimiento, reino de los cielos', 'Muestra una lectura judeocristiana de Jesús como Mesías davídico y maestro autorizado.'],
        ['Josefo', 'Antigüedades; Guerra', 'Aporta datos sobre fariseos, saduceos, Herodes, templo y poder romano.'],
        ['Qumrán', 'Regla de la Comunidad; Pesher Habacuc', 'Permite comparar lenguaje de justicia, comunidad fiel, interpretación profética y escatología.'],
        ['Salmos de Salomón', 'Salmos 17-18', 'Ayuda a entender expectativas de un mesías davídico justo y restaurador.']
      ]
    },
    Juan: {
      worldview: 'Para Juan, el contexto relevante incluye judaísmo del siglo I, fiestas judías, templo, sinagoga, pureza, testimonio, conflicto de autoridad y símbolos como luz, agua, pan, vida, verdad y gloria. El texto debe leerse como narración teológica con fuerte densidad simbólica judía.',
      literature: 'Juan usa símbolos ya cargados por la Escritura: maná, agua viva, pastor, vid, templo, serpiente levantada, luz y tinieblas. También dialoga con lenguaje sapiencial y con expectativas judías sobre revelación, profeta, Mesías e Hijo del Hombre.',
      historians: 'Josefo ayuda con el marco de Judea, templo, sacerdocio y tensiones con Roma. Filón es útil por su lenguaje helenístico sobre Logos y alegoría, aunque no debe imponerse automáticamente sobre Juan. Los romanos ayudan a ubicar el ambiente imperial tardío del siglo I.',
      evidence: [
        ['Evangelio de Juan', 'Señales, discursos, fiestas, templo, testimonio', 'Muestra una interpretación de Jesús dentro de símbolos judíos y conflicto comunitario.'],
        ['Filón de Alejandría', 'Tratados alegóricos y lenguaje del Logos', 'Sirve como paralelo cultural helenístico, con cautela metodológica.'],
        ['Josefo', 'Antigüedades; Guerra', 'Ubica templo, sacerdocio, Judea y tensiones políticas.'],
        ['Qumrán', 'Textos de luz/tinieblas', 'Ayuda a comparar lenguaje dualista judío sin asumir dependencia directa.']
      ]
    },
    Efesios: {
      worldview: 'Para Efesios, el marco es una comunidad de Asia Menor en ambiente urbano grecorromano, con creyentes judíos y gentiles. Importan identidad colectiva, reconciliación, familia, poderes espirituales, ciudadanía, herencia, templo y pertenencia a un solo pueblo.',
      literature: 'Efesios no trabaja con parábolas narrativas como los Evangelios, sino con lenguaje epistolar, doxología, oración, exhortación doméstica y metáforas corporativas: cuerpo, edificio, templo, armadura, herencia y nueva humanidad. Estas imágenes mezclan Escritura judía y mundo social grecorromano.',
      historians: 'Hechos 19 aporta una escena narrativa de Éfeso. Josefo y Filón sirven para entender judaísmo de diáspora y relación judío-gentil. Las fuentes romanas y datos urbanos ayudan a ubicar culto imperial, economía, asociaciones y religión cívica.',
      evidence: [
        ['Efesios', 'Unidad, nueva humanidad, templo, poderes, armadura', 'Explica identidad comunitaria judío-gentil en Cristo dentro del mundo romano.'],
        ['Hechos 19', 'Éfeso, culto de Artemisa, conflicto público', 'Aporta trasfondo narrativo de religión urbana y presión social.'],
        ['Inscripciones y contexto de Asia Menor', 'Culto imperial, ciudad, honor, asociaciones', 'Ayuda a leer ciudadanía, lealtad, casa y vida pública.'],
        ['Literatura paulina', 'Romanos, Gálatas, Colosenses', 'Permite comparar ley, gentiles, cuerpo, poderes y reconciliación.']
      ]
    },
    Romanos: {
      worldview: 'Para Romanos, el marco es una comunidad mixta en la capital imperial. El debate gira alrededor de justicia de Dios, pecado, Torá, Abraham, Israel, gentiles, identidad comunitaria y vida bajo el poder de Roma.',
      literature: 'Romanos usa argumentación epistolar, diatriba, citas bíblicas, lectura de Abraham, Adán, Moisés, profetas y salmos. No debe leerse como manual sistemático moderno, sino como argumento dirigido a una situación judío-gentil concreta.',
      historians: 'Suetonio ayuda a ubicar conflictos judíos en Roma bajo Claudio. Josefo aporta contexto judío amplio. Filón muestra judaísmo de diáspora. Tácito ayuda con el imaginario romano sobre judíos y cristianos.',
      evidence: [
        ['Romanos', 'Justicia, Torá, Abraham, Israel, gentiles', 'Muestra una argumentación sobre identidad y salvación en comunidad mixta.'],
        ['Suetonio', 'Vida de Claudio', 'Aporta referencia a disturbios judíos en Roma y expulsiones.'],
        ['Josefo', 'Antigüedades; Guerra', 'Contextualiza diversidad judía y relación con Roma.'],
        ['Escrituras de Israel', 'Génesis, Salmos, Isaías, Oseas', 'Base argumentativa de Pablo para leer promesa, pecado, justicia e Israel.']
      ]
    }
  };

  if (specific[bookContext.book]) return specific[bookContext.book];

  const byGroup = {
    evangelio: {
      worldview: `Para ${bookContext.book}, el marco principal es el judaísmo del siglo I: Torá, sinagoga, templo, pureza, reino, autoridad, expectativas mesiánicas y ocupación romana. Las palabras y acciones de Jesús deben leerse dentro de ese mundo social.`,
      literature: 'Importan parábolas, controversias, ecos proféticos, sabiduría judía, imágenes de viña, bodas, banquete, pastor, siervo, juez, camino, luz y tinieblas. Estas metáforas ya tenían historia en la Escritura y en tradiciones judías.',
      historians: 'Josefo ayuda a ubicar Judea, Galilea, sectas judías, Herodes, templo y Roma. Filón permite comparar judaísmo de diáspora. Tácito y Suetonio aportan mirada romana externa.',
      evidence: [
        [bookContext.book, 'Narración evangélica, dichos, señales o parábolas', 'Muestra a Jesús dentro de debates judíos y presión romana.'],
        ['Josefo', 'Antigüedades; Guerra', 'Contextualiza grupos judíos, autoridades y tensiones políticas.'],
        ['Qumrán', 'Textos sectarios y apocalípticos', 'Permite comparar pureza, escatología y lectura profética.'],
        ['Literatura apócrifa/pseudoepigráfica', '1 Enoc; Salmos de Salomón', 'Ilumina expectativas de juicio, Mesías y restauración.']
      ]
    },
    paulina: {
      worldview: `Para ${bookContext.book}, el marco es una comunidad cristiana temprana dentro del imperio romano, con preguntas sobre identidad, judíos y gentiles, lealtad, vida comunitaria, familia, honor y Escritura de Israel.`,
      literature: 'La literatura relevante incluye cartas, exhortaciones, catálogos éticos, oraciones, bendiciones, citas bíblicas y metáforas corporativas. El lenguaje de gracia, fe, ley, cuerpo, herencia y santidad debe leerse históricamente.',
      historians: 'Josefo y Filón ayudan a entender judaísmo de diáspora y relación con gentiles. Fuentes romanas ayudan a ubicar ciudadanía, casa, honor, culto imperial y vida urbana.',
      evidence: [
        [bookContext.book, 'Carta cristiana temprana', 'Permite leer una situación comunitaria concreta, no doctrina abstracta aislada.'],
        ['Hechos', 'Viajes, ciudades, conflictos públicos', 'Aporta marco narrativo para algunas comunidades paulinas.'],
        ['Josefo y Filón', 'Judaísmo del siglo I y diáspora', 'Ayudan a entender Torá, identidad judía y mundo helenístico.'],
        ['Fuentes romanas e inscripciones', 'Ciudad, honor, familia, culto imperial', 'Iluminan la vida social de comunidades urbanas.']
      ]
    },
    profetas: {
      worldview: `Para ${bookContext.book}, aunque el libro es anterior al siglo I, su recepción en el Judaísmo del Segundo Templo lo conectaba con juicio, restauración, templo, exilio, Mesías, naciones y esperanza final.`,
      literature: 'Los profetas alimentaron imágenes como viña, siervo, pastor, nuevo pacto, día del Señor, Sion, desierto, templo y restauración. Qumrán muestra cómo estos textos se releían para interpretar el presente.',
      historians: 'Josefo ayuda a ver cómo la memoria profética seguía viva en crisis nacionales. Qumrán es especialmente relevante como evidencia interpretativa.',
      evidence: [
        [bookContext.book, 'Oráculos proféticos', 'Base para esperanza, juicio y restauración en lecturas judías posteriores.'],
        ['Qumrán', 'Pesharim', 'Muestra interpretación profética aplicada al presente de una comunidad.'],
        ['Literatura apocalíptica', 'Daniel; 1 Enoc', 'Conecta profecía con escatología y juicio.'],
        ['Nuevo Testamento', 'Citas y ecos proféticos', 'Muestra recepción cristiana temprana de esos textos.']
      ]
    }
  };

  return byGroup[bookContext.group] ?? {
    worldview: bookContext.setting,
    literature: bookContext.culture,
    historians: 'Josefo, Filón, Qumrán y autores romanos ofrecen el marco comparativo más útil para ubicar el período, siempre con cautela crítica.',
    evidence: [
      [bookContext.book, 'Texto bíblico consultado', 'Punto de partida para el análisis del libro o pasaje.'],
      ['Josefo', 'Antigüedades; Guerra', 'Marco histórico judío-romano.'],
      ['Filón', 'Tratados judíos helenísticos', 'Comparación con judaísmo de diáspora.'],
      ['Qumrán', 'Manuscritos del Mar Muerto', 'Comparación con sectarismo, escatología y lectura bíblica judía.']
    ]
  };
}

function theologicalThemeForQuery(value, bookContext) {
  const normalized = normalizeText(value);
  if (
    normalized.includes('predestin') ||
    normalized.includes('gracia') ||
    normalized.includes('eleccion') ||
    normalized.includes('presciencia') ||
    normalized.includes('romanos 8') ||
    normalized.includes('efesios 1')
  ) {
    return 'soteriologia';
  }
  if (
    normalized.includes('juan') ||
    normalized.includes('logos') ||
    normalized.includes('verbo') ||
    normalized.includes('hijo') ||
    normalized.includes('cristo') ||
    bookContext.book === 'Juan'
  ) {
    return 'cristologia';
  }
  if (
    normalized.includes('iglesia') ||
    normalized.includes('autoridad') ||
    normalized.includes('llaves') ||
    normalized.includes('mateo 16') ||
    bookContext.book === 'Mateo'
  ) {
    return 'autoridad';
  }
  return bookContext.group === 'paulina' ? 'soteriologia' : 'general';
}

function patristicContextForTheme(theme, bookContext) {
  const emphasis = {
    soteriologia: 'En esta búsqueda conviene observar cómo la Iglesia antigua fue pasando de exhortaciones pastorales sobre obediencia y gracia a debates técnicos sobre pecado, voluntad, gracia y predestinación. El texto no debe leerse como si Agustín, Lutero o Dort ya estuvieran dentro del siglo I, pero sí puede estudiarse cómo esos debates usaron pasajes como Romanos o Efesios.',
    cristologia: 'En esta búsqueda conviene seguir cómo la Iglesia antigua desarrolló lenguaje técnico para hablar de Cristo: Logos, encarnación, naturaleza, persona y relación con el Padre. El punto crítico es distinguir el sentido original del texto y la recepción dogmática posterior.',
    autoridad: 'En esta búsqueda conviene observar cómo los Padres leyeron textos sobre enseñanza, obispos, unidad, tradición, disciplina y autoridad eclesial. La recepción patrística no reemplaza el contexto original, pero muestra cómo la Iglesia antigua organizó su vida comunitaria.',
    general: 'En esta búsqueda conviene usar la patrística como historia de recepción: los Padres no son el contexto original del texto bíblico, sino lectores antiguos que muestran cómo ciertas preguntas se volvieron centrales en la Iglesia.'
  };

  return {
    emphasis: emphasis[theme],
    stages: [
      {
        period: 'Padres Apostólicos',
        figures: 'Clemente de Roma, Ignacio de Antioquía, Policarpo',
        focus: theme === 'autoridad'
          ? 'Orden eclesiástico, obediencia comunitaria, obispos, presbíteros y unidad visible.'
          : 'Continuidad apostólica, vida comunitaria, martirio, obediencia y defensa de la realidad humana de Cristo contra tendencias docetas.',
        relevance: `Sirven para ver cómo comunidades cercanas al período apostólico leyeron textos como ${bookContext.book} desde preocupaciones pastorales concretas.`
      },
      {
        period: 'Padres Apologistas',
        figures: 'Justino Mártir',
        focus: theme === 'cristologia'
          ? 'Uso del Logos para dialogar con filosofía griega y explicar a Cristo como revelación divina.'
          : 'Defensa pública del cristianismo ante el mundo grecorromano y puente conceptual con filosofía, moral y razón.',
        relevance: 'Ayudan a observar cómo el mensaje bíblico empezó a explicarse en categorías comprensibles para el ambiente helenístico.'
      },
      {
        period: 'Desarrolladores del dogma',
        figures: 'Ireneo, Tertuliano, Orígenes',
        focus: theme === 'cristologia'
          ? 'Regla de fe, lucha contra gnosticismo, lenguaje técnico sobre Dios, Cristo, sustancia y persona.'
          : 'Combate contra gnosticismo, defensa de creación, encarnación, Escritura, tradición y primeras formulaciones técnicas.',
        relevance: 'Muestran cómo la lectura bíblica pasó a enfrentar sistemas rivales de interpretación.'
      },
      {
        period: 'Padres de los grandes concilios',
        figures: 'Atanasio, Basilio, Gregorio de Nisa, Gregorio Nacianceno',
        focus: theme === 'cristologia'
          ? 'Disputas contra el arrianismo, definición de lenguaje trinitario y cristológico, homoousios, naturaleza y persona.'
          : 'Defensa de la plena divinidad del Hijo y del Espíritu, y consolidación del vocabulario doctrinal cristiano.',
        relevance: 'Sirven para estudiar recepción dogmática posterior sin confundirla con el primer horizonte histórico del pasaje.'
      }
    ]
  };
}

function theologicalDisputesForTheme(theme) {
  const highlight = {
    soteriologia: 'Esta búsqueda toca directamente debates sobre gracia, voluntad, pecado, elección, predestinación o justificación.',
    cristologia: 'Esta búsqueda toca especialmente debates sobre identidad de Cristo, Logos, encarnación, divinidad y relación con el Padre.',
    autoridad: 'Esta búsqueda toca especialmente debates sobre autoridad, tradición, Escritura, Iglesia y magisterio.',
    general: 'Estas disputas muestran cómo la historia cristiana transformó preguntas bíblicas en controversias doctrinales, políticas e institucionales.'
  };

  return {
    highlight: highlight[theme],
    disputes: [
      {
        title: 'Agustín de Hipona vs. Pelagio',
        period: 'Siglos IV-V',
        context: 'Antigüedad tardía, crisis imperial, disciplina moral cristiana y debate sobre pecado original.',
        sideA: 'Agustín afirmó que la humanidad está radicalmente dañada por el pecado, que la gracia divina inicia y sostiene la salvación, y que la voluntad necesita ser liberada.',
        sideB: 'Pelagio defendió una mayor capacidad moral humana: Dios manda obedecer porque el ser humano puede obedecer; la gracia ayuda, pero no determina interiormente la voluntad.',
        relevance: theme === 'soteriologia' ? 'Muy relevante para textos sobre gracia, elección, pecado, voluntad y predestinación.' : 'Relevante como historia posterior de recepción soteriológica.'
      },
      {
        title: 'Lutero vs. Magisterio Romano; Lutero vs. Erasmo',
        period: 'Siglo XVI',
        context: 'Reforma temprana, indulgencias, autoridad papal, economía eclesiástica, imprenta y crisis de legitimidad religiosa.',
        sideA: 'Lutero atacó las indulgencias y defendió la justificación forense por la fe; contra Erasmo sostuvo la esclavitud de la voluntad en asuntos de salvación.',
        sideB: 'El magisterio romano defendió la autoridad eclesial y el sistema penitencial; Erasmo sostuvo una libertad humana cooperante y rechazó el determinismo teológico fuerte.',
        relevance: theme === 'autoridad' ? 'Muy relevante para textos sobre autoridad, tradición, Escritura y reforma.' : 'Relevante para gracia, justificación, fe y voluntad.'
      },
      {
        title: 'Calvino y Dort vs. Arminio y la Remonstrancia',
        period: 'Siglos XVI-XVII',
        context: 'Post-Reforma, consolidación confesional, universidades reformadas, política neerlandesa y disputa sobre predestinación.',
        sideA: 'La ortodoxia reformada resumida en Dort defendió depravación humana, elección incondicional, expiación definida, gracia eficaz y perseverancia de los santos.',
        sideB: 'La Remonstrancia arminiana defendió elección condicionada por presciencia, gracia resistible, expiación universal y posibilidad debatida de apostasía.',
        relevance: theme === 'soteriologia' ? 'Muy relevante para búsquedas sobre predestinación, presciencia, elección, gracia y perseverancia.' : 'Relevante como desarrollo confesional posterior.'
      }
    ]
  };
}

function chronologyRowsForTheme(theme, bookContext) {
  const rows = [
    ['Siglos I-II', 'Padres Apostólicos vs. docetismo y desorden comunitario', 'Cristología / Autoridad', '1 Clemente; cartas de Ignacio; Martirio de Policarpo', 'Consolidación de autoridad comunitaria, martirio y defensa de la realidad de Cristo.'],
    ['Siglo II', 'Apologistas cristianos frente a crítica pagana', 'Cristología / Razón pública', 'Justino, Apologías; Diálogo con Trifón', 'Uso del Logos como puente con filosofía griega y defensa del cristianismo.'],
    ['Siglos II-III', 'Ireneo, Tertuliano y Orígenes vs. gnosticismos', 'Cristología / Escritura / Regla de fe', 'Contra las herejías; Contra Praxeas; De principiis', 'Desarrollo de vocabulario técnico y defensa de creación, encarnación y unidad bíblica.'],
    ['Siglos IV-V', 'Atanasio y Capadocios vs. arrianismo', 'Cristología / Trinidad', 'Nicea; Constantinopla; escritos antiarrianos', 'Definición conciliar de la plena divinidad del Hijo y del Espíritu.'],
    ['Siglos IV-V', 'Agustín vs. Pelagio', 'Soteriología', 'De natura et gratia; escritos pelagianos; concilios africanos', 'Victoria histórica de la prioridad de la gracia en Occidente.'],
    ['Siglo XVI', 'Lutero vs. Roma; Lutero vs. Erasmo', 'Autoridad / Justificación / Antropología', '95 tesis; De servo arbitrio; De libero arbitrio', 'Ruptura reformadora y debate sobre justificación y voluntad.'],
    ['Siglos XVI-XVII', 'Dort vs. Remonstrancia arminiana', 'Soteriología', 'Cinco artículos remonstrantes; Cánones de Dort', 'Formulación confesional reformada de los cinco puntos contra la Remonstrancia.']
  ];

  if (theme === 'cristologia') return rows.filter((row) => row[2].includes('Cristología') || row[0].includes('IV'));
  if (theme === 'autoridad') return rows.filter((row) => row[2].includes('Autoridad') || row[1].includes('Lutero') || row[0] === 'Siglos I-II');
  if (theme === 'soteriologia') return rows.filter((row) => row[2].includes('Soteriología') || row[1].includes('Lutero'));
  return rows.map((row) => row[0] === 'Siglos I-II' ? [row[0], `${row[1]} en recepción de ${bookContext.book}`, ...row.slice(2)] : row);
}

const simpleTermDefinitions = {
  soteriologia: 'Estudio de cómo se entiende la salvación.',
  escatologia: 'Estudio de la esperanza final: juicio, resurrección, reino y consumación.',
  cristologia: 'Estudio de quién es Cristo y cómo se habla de su identidad.',
  hermeneutica: 'Forma responsable de interpretar un texto.',
  exegesis: 'Lectura cuidadosa que intenta sacar el sentido del texto, no meterle una idea externa.',
  docetismo: 'Idea antigua de que Cristo solo parecía humano, pero no habría tenido humanidad real.',
  gnosticismo: 'Conjunto de movimientos que mezclaban salvación con conocimiento secreto y desprecio de lo material.',
  justificacion: 'Declaración o acto por el cual Dios considera justo al ser humano, según el marco teológico discutido.',
  predestinacion: 'Idea de un propósito determinado de antemano por Dios; su alcance se debatió mucho en la historia.',
  logos: 'Palabra griega que puede significar palabra, razón o principio expresivo; en Juan se usa para hablar del Verbo.',
  tora: 'Instrucción o Ley de Israel; no solo normas, sino identidad, pacto y vida comunitaria.'
};

function studyGuideSteps(result, bookContext) {
  return [
    ['Texto', 'Leé primero el pasaje completo antes de sacar conclusiones.'],
    ['Contexto del libro', `Ubicá el texto dentro de ${bookContext.book}: audiencia, género, cultura y problema tratado.`],
    ['Palabras clave', 'Observá términos repetidos o cargados de sentido, sin definirlos solo por etimología.'],
    ['Estructura', 'Mirar cómo avanza el argumento: causa, contraste, promesa, mandato, ejemplo o conclusión.'],
    ['Historia de recepción', 'Después del sentido original, compará cómo fue leído por Padres, Reformadores y debates posteriores.'],
    ['Síntesis responsable', `Resumí qué afirma ${result.title} y qué preguntas deja abiertas sin forzarlas.`]
  ];
}

function termsForResult(result) {
  const text = normalizeText([
    result.title,
    result.explanation,
    ...(result.sections ?? []).map((section) => `${section.title} ${section.body}`),
    ...(result.lexicalRows ?? []).map((row) => `${row.lemma} ${row.semantics}`)
  ].join(' '));

  return Object.entries(simpleTermDefinitions)
    .filter(([term]) => text.includes(term))
    .slice(0, 8)
    .map(([term, definition]) => ({ term, definition }));
}

function interpretationViews(result, bookContext) {
  const theme = theologicalThemeForQuery(result.title, bookContext);
  const base = [
    {
      title: 'Sentido histórico original',
      body: `Primero se pregunta qué comunicaba el texto dentro de ${bookContext.book}, su género, audiencia y mundo social.`
    },
    {
      title: 'Lectura del Segundo Templo',
      body: 'Observa ecos judíos previos o contemporáneos: Torá, templo, reino, juicio, pureza, sabiduría, apocalíptica o identidad de Israel.'
    },
    {
      title: 'Recepción patrística',
      body: 'Muestra cómo los primeros cristianos usaron el texto en debates sobre Cristo, Iglesia, Escritura, herejías y vida comunitaria.'
    }
  ];

  if (theme === 'soteriologia') {
    base.push(
      { title: 'Lectura agustiniana/reformada', body: 'Tiende a resaltar prioridad de la gracia, pecado, elección, voluntad humana limitada y seguridad de la obra divina.' },
      { title: 'Lectura arminiana/remonstrante', body: 'Tiende a resaltar gracia preveniente, respuesta humana real, presciencia y advertencias bíblicas como significativas.' }
    );
  } else if (theme === 'cristologia') {
    base.push(
      { title: 'Lectura nicena', body: 'Lee el texto dentro de la defensa de la plena divinidad del Hijo y el lenguaje de naturaleza/persona.' },
      { title: 'Cautela crítica', body: 'Distingue entre lo que el texto dice en su marco original y el vocabulario técnico posterior de los concilios.' }
    );
  } else {
    base.push(
      { title: 'Lectura católica histórica', body: 'Suele prestar atención a tradición, Iglesia visible, sacramentos, autoridad y continuidad institucional.' },
      { title: 'Lectura reformada histórica', body: 'Suele priorizar Escritura, predicación, gracia, fe y revisión crítica de tradiciones posteriores.' }
    );
  }

  return base;
}

function classMode(result, bookContext) {
  return {
    objective: `Entender ${result.title} dentro de ${bookContext.book}, evitando sacar el texto de su contexto.`,
    questions: [
      `Qué problema o tema está tratando ${bookContext.book} cerca de este pasaje?`,
      'Qué palabras se repiten o cargan el peso del argumento?',
      'Qué parte pertenece al sentido original y qué parte pertenece a recepción histórica posterior?',
      'Qué aplicación sería responsable sin forzar el texto?'
    ],
    outline: [
      'Leer el texto completo.',
      'Explicar contexto histórico y literario.',
      'Definir palabras clave en lenguaje sencillo.',
      'Comparar interpretaciones históricas sin caricaturizar.',
      'Cerrar con una síntesis breve y honesta.'
    ]
  };
}

function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-moss-50 text-moss-800 ring-moss-100',
    gold: 'bg-[#f4e7d0] text-[#7a4d16] ring-[#ead7b8]'
  };

  return (
    <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-normal ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function App() {
  const [input, setInput] = useState('Romanos 8:29');
  const [depth, setDepth] = useState('estudiante');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [simpleMode, setSimpleMode] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [studyView, setStudyView] = useState('completo');
  const [favoriteStatus, setFavoriteStatus] = useState('');
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bec_history') ?? '[]');
    } catch {
      return [];
    }
  });
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bec_favorites') ?? '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('bec_history', JSON.stringify(history.slice(0, 8)));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('bec_favorites', JSON.stringify(favorites.slice(0, 20)));
  }, [favorites]);

  const inputKind = detectInputKind(input);
  const detectedBook = detectBook(input);
  const bookHistory = getBookHistory(detectedBook);
  const canShowHistoricalContext = Boolean(bookHistory);
  const showFullStudy = studyView === 'completo';

  async function handleAnalyze(event) {
    event.preventDefault();
    const value = input.trim();
    if (!value) {
      setStatus('Escribí un versículo, texto o palabra para analizar.');
      return;
    }

    setLoading(true);
    setSimpleMode(false);
    setReadingMode(false);
    setStudyView('completo');
    setStatus('Analizando con método histórico-gramatical...');
    setResult(null);

    try {
      const data = await analyzeInput({ input: value, depth });
      setResult(data);
      setStatus(data.found ? 'Análisis listo' : 'No encontré una coincidencia exacta');
      setHistory((current) => {
        const nextItem = {
          query: value,
          type: modeLabel(data.mode),
          date: new Date().toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })
        };
        return [nextItem, ...current.filter((item) => (typeof item === 'string' ? item : item.query) !== value)].slice(0, 8);
      });
    } catch (error) {
      setStatus(error.response?.data?.mensaje ?? 'No se pudo analizar. Revisá que el backend esté encendido.');
    } finally {
      setLoading(false);
    }
  }

  function useExample(example) {
    setInput(example);
    setResult(null);
    setSimpleMode(false);
    setReadingMode(false);
    setStatus('');
  }

  async function copyStudy() {
    if (!result) return;
    const text = formatStudyForCopy(result);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopyStatus('Estudio copiado');
    } catch {
      setCopyStatus('No pude copiar automáticamente');
    }
    window.setTimeout(() => setCopyStatus(''), 2200);
  }

  function saveFavorite() {
    if (!result) return;
    const item = {
      query: result.title,
      type: modeLabel(result.mode),
      date: new Date().toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' }),
      summary: result.explanation
    };
    setFavorites((current) => [item, ...current.filter((favorite) => favorite.query !== item.query)].slice(0, 20));
    setFavoriteStatus('Guardado');
    window.setTimeout(() => setFavoriteStatus(''), 2200);
  }

  return (
    <main className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-6 py-8 md:py-12">
      <section className="grid gap-4">
        <div className="inline-flex items-center gap-2 font-extrabold text-moss-800">
          <BookOpen size={22} />
          <span>Biblia en Contexto</span>
        </div>
        <div className="grid gap-3">
          <h1 className="max-w-5xl text-4xl font-black leading-[1.05] tracking-normal text-ink md:text-6xl">
            Exégesis bíblica clara, seria y fácil de entender
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-muted">
            Escribí un versículo, pasaje, palabra bíblica o texto. La app responde con método histórico-gramatical:
            contexto, género, estructura, léxico, crítica textual y síntesis sin forzar dogmas.
          </p>
        </div>
      </section>

      <form
        className={`rounded-lg border border-[#dbe3d8] bg-white shadow-soft transition-all ${readingMode ? 'p-4' : 'p-5 md:p-6'}`}
        onSubmit={handleAnalyze}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm font-extrabold text-ink" htmlFor="analysis-input">
            Buscar o analizar
          </label>
          <div className="rounded-lg border border-moss-100 bg-moss-50 px-3 py-2 text-sm text-moss-800">
            <strong>{inputKind.label}</strong>
            <span className="ml-2 text-muted">{inputKind.helper}</span>
          </div>
          <div className="grid overflow-hidden rounded-lg border border-[#dbe3d8] bg-white sm:inline-flex">
            {depthOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`min-h-9 px-3 text-sm font-bold transition ${depth === option.id ? 'bg-moss-600 text-white' : 'text-muted hover:bg-moss-50 hover:text-moss-800'}`}
                onClick={() => setDepth(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {!readingMode && (
          <textarea
            id="analysis-input"
            className="mt-4 min-h-40 w-full resize-y rounded-lg border border-[#dbe3d8] bg-white p-4 leading-7 text-ink outline-none transition focus:border-moss-600 focus:ring-4 focus:ring-moss-100"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ej. Romanos 8:29, Juan 3:16, presciencia, gracia, o pegá un texto bíblico..."
          />
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-moss-600 px-5 font-extrabold text-white transition hover:bg-moss-800 disabled:opacity-70"
            type="submit"
            disabled={loading}
          >
            {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            Analizar
          </button>
          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                className="min-h-9 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] px-3 font-bold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
                onClick={() => useExample(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {!readingMode && favorites.length > 0 && (
          <div className="mt-4 grid gap-2 border-t border-[#dbe3d8] pt-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-moss-800">
              <Star size={16} />
              Estudios guardados
            </div>
            <div className="flex flex-wrap gap-2">
              {favorites.slice(0, 6).map((favorite) => (
                <button
                  key={`${favorite.query}-${favorite.date}`}
                  type="button"
                  className="min-h-8 rounded-full border border-[#dbe3d8] bg-white px-3 text-sm text-muted transition hover:border-moss-600 hover:text-moss-800"
                  onClick={() => useExample(favorite.query)}
                >
                  {favorite.query} · {favorite.type} · {favorite.date}
                </button>
              ))}
            </div>
          </div>
        )}

        {!readingMode && history.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#dbe3d8] pt-4 text-muted">
            <History size={16} />
            {history.map((item) => (
              <button
                key={typeof item === 'string' ? item : `${item.query}-${item.date}`}
                type="button"
                className="min-h-8 rounded-full border border-[#dbe3d8] bg-white px-3 text-sm text-muted transition hover:border-moss-600 hover:text-moss-800"
                onClick={() => useExample(typeof item === 'string' ? item : item.query)}
              >
                {typeof item === 'string' ? item : `${item.query} · ${item.type} · ${item.date}`}
              </button>
            ))}
          </div>
        )}

        {status && <p className="mt-3 text-sm text-muted">{status}</p>}
      </form>

      {loading && (
        <section className="grid gap-3 rounded-lg border border-[#dbe3d8] bg-white p-4 shadow-soft md:grid-cols-4" aria-label="Progreso del análisis">
          {loadingSteps.map((step, index) => (
            <div key={step} className="min-h-20 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-3">
              <span className="grid size-7 place-items-center rounded-full bg-moss-600 text-xs font-extrabold text-white">
                {index + 1}
              </span>
              <p className="mt-2 font-bold text-muted">{step}</p>
            </div>
          ))}
        </section>
      )}

      {result && (
        <section className={`overflow-hidden rounded-lg border border-[#dbe3d8] bg-parchment shadow-soft ${readingMode ? 'grid-cols-[190px_minmax(0,860px)] justify-center' : 'lg:grid lg:grid-cols-[230px_minmax(0,1fr)]'}`}>
          <aside className="border-b border-[#dbe3d8] bg-[#f7f7ef] p-5 lg:sticky lg:top-0 lg:min-h-screen lg:border-b-0 lg:border-r">
            <strong className="mb-3 block text-moss-800">Índice</strong>
            <nav className="grid gap-1">
              <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" href="#resumen">Resumen</a>
              {result.verses?.length > 0 && <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" href="#texto">Texto b&iacute;blico</a>}
              {!simpleMode && canShowHistoricalContext && result.mode !== 'word' && (
                <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" href="#marco-historico">Marco histórico</a>
              )}
              {!simpleMode && result.sections?.map((section) => (
                <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" key={section.title} href={`#${sectionId(section.title)}`}>
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="grid gap-6 p-5 md:p-8">
            <div id="resumen">
              <Pill tone="gold">{result.mode === 'passage' ? 'Pasaje' : result.mode === 'word' ? 'Palabra' : 'Texto'}</Pill>
              <h2 className="mt-3 text-3xl font-black leading-tight text-ink md:text-5xl">{result.title}</h2>
              <p className="mt-3 max-w-4xl text-lg leading-8 text-muted">{simpleMode ? result.simpleSummary : result.explanation}</p>
              <div className="mt-4 grid overflow-hidden rounded-lg border border-[#dbe3d8] bg-white sm:inline-flex">
                {[
                  ['resumen', 'Resumen'],
                  ['completo', 'Estudio completo']
                ].map(([view, label]) => (
                  <button
                    key={view}
                    type="button"
                    className={`min-h-10 px-3 text-sm font-bold transition ${studyView === view ? 'bg-moss-600 text-white' : 'text-muted hover:bg-moss-50 hover:text-moss-800'}`}
                    onClick={() => setStudyView(view)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] px-3 font-extrabold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
                  type="button"
                  onClick={copyStudy}
                >
                  {copyStatus ? <Check size={16} /> : <Clipboard size={16} />}
                  {copyStatus || 'Copiar estudio'}
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] px-3 font-extrabold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
                  type="button"
                  onClick={saveFavorite}
                >
                  {favoriteStatus ? <Check size={16} /> : <Star size={16} />}
                  {favoriteStatus || 'Guardar estudio'}
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] px-3 font-extrabold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
                  type="button"
                  onClick={() => setSimpleMode((value) => !value)}
                >
                  <Wand2 size={16} />
                  {simpleMode ? 'Ver análisis completo' : 'Hacerlo más fácil'}
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] px-3 font-extrabold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
                  type="button"
                  onClick={() => setReadingMode((value) => !value)}
                >
                  <Eye size={16} />
                  {readingMode ? 'Mostrar buscador' : 'Modo lectura'}
                </button>
                <small className="max-w-2xl leading-6 text-muted">{result.methodNote}</small>
              </div>
            </div>

            {result.verses?.length > 0 && (
              <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5" id="texto">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Pill tone="gold">Primero el texto</Pill>
                    <h3 className="mt-3 text-2xl font-black leading-tight text-ink">Texto b&iacute;blico completo</h3>
                  </div>
                  <span className="rounded-full border border-[#dbe3d8] bg-white px-3 py-2 text-sm font-extrabold text-moss-800">
                    {result.verses.length} vers&iacute;culo{result.verses.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="grid gap-3">
                  {result.verses.map((verse) => (
                    <div className="rounded-lg border border-[#dbe3d8] bg-white p-4" key={`${verse.reference}-${verse.text}`}>
                      <strong className="mb-2 block text-ink">{verse.reference}</strong>
                      <div className="rounded-lg border border-moss-100 bg-moss-50 p-3">
                        <small className="mb-1 block font-extrabold uppercase text-moss-800">Lectura clara</small>
                        <p className="leading-8 text-ink">{verse.clearText || verse.text}</p>
                      </div>
                      <small className="mt-2 block text-xs font-bold uppercase text-muted">Base local: {verse.version}</small>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {!simpleMode && showFullStudy && canShowHistoricalContext && result.mode !== 'word' && (
              <article className="rounded-lg border border-[#dbe3d8] bg-white p-5" id="marco-historico">
                <Pill tone="gold">Marco histórico</Pill>
                <h3 className="mt-3 text-2xl font-black text-ink">Historia de {bookHistory.book}</h3>
                <BookHistoryContext history={bookHistory} />
              </article>
            )}

            {result.sections?.length > 0 && !simpleMode && showFullStudy && (
              <div className="grid gap-3">
                {result.sections.map((section) => (
                  <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5" key={section.title} id={sectionId(section.title)}>
                    <h3 className="mb-2 text-lg font-black text-ink">{section.title}</h3>
                    <p className="leading-8 text-muted">{section.body}</p>
                  </article>
                ))}
              </div>
            )}

          </div>
        </section>
      )}

      {!result && !loading && (
        <section className="grid min-h-60 justify-items-center rounded-lg border border-[#dbe3d8] bg-white p-6 text-center text-muted shadow-soft">
          <Search size={22} />
          <h2 className="mt-3 text-2xl font-black text-ink">Vista previa del estudio</h2>
          <p className="mt-3 max-w-2xl">Escribí un libro, pasaje, palabra o texto. La respuesta aparecerá acá solamente con secciones que respondan a esa búsqueda.</p>
        </section>
      )}
    </main>
  );
}

function BookHistoryContext({ history }) {
  return (
    <div className="mt-6 grid gap-4 border-t border-[#dbe3d8] pt-5">
      <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5">
        <h3 className="mb-3 text-xl font-black text-ink">Historia de composición</h3>
        <p className="leading-8 text-muted">{history.history}</p>
      </article>

      <div className="grid gap-3 lg:grid-cols-2">
        {history.era && (
          <article className="rounded-lg border border-[#dbe3d8] bg-white p-4">
            <strong className="block text-moss-800">Época aproximada</strong>
            <p className="mt-2 leading-7 text-muted">{history.era}</p>
          </article>
        )}

        <article className="rounded-lg border border-[#dbe3d8] bg-white p-4">
          <strong className="block text-moss-800">Dónde se escribió</strong>
          <p className="mt-2 leading-7 text-muted">{history.place}</p>
        </article>

        <article className="rounded-lg border border-[#dbe3d8] bg-white p-4">
          <strong className="block text-moss-800">Para quién</strong>
          <p className="mt-2 leading-7 text-muted">{history.audience}</p>
        </article>

        <article className="rounded-lg border border-[#dbe3d8] bg-white p-4">
          <strong className="block text-moss-800">Para qué público y propósito</strong>
          <p className="mt-2 leading-7 text-muted">{history.purpose}</p>
        </article>

        {history.social && (
          <article className="rounded-lg border border-[#dbe3d8] bg-white p-4">
            <strong className="block text-moss-800">Contexto social</strong>
            <p className="mt-2 leading-7 text-muted">{history.social}</p>
          </article>
        )}

        {history.cultural && (
          <article className="rounded-lg border border-[#dbe3d8] bg-white p-4">
            <strong className="block text-moss-800">Contexto cultural</strong>
            <p className="mt-2 leading-7 text-muted">{history.cultural}</p>
          </article>
        )}

        {history.political && (
          <article className="rounded-lg border border-[#dbe3d8] bg-white p-4">
            <strong className="block text-moss-800">Contexto político</strong>
            <p className="mt-2 leading-7 text-muted">{history.political}</p>
          </article>
        )}
      </div>

      {history.generalReading && (
        <article className="rounded-lg border border-moss-100 bg-moss-50 p-5">
          <strong className="block text-moss-800">Lectura dentro del argumento del libro</strong>
          <p className="mt-2 leading-8 text-muted">{history.generalReading}</p>
        </article>
      )}
    </div>
  );
}
