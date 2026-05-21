import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Clipboard, ExternalLink, Eye, History, Loader2, Search, Sparkles, Star, Wand2 } from 'lucide-react';
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
    era: 'Probablemente entre los años 56-58 d.C., durante el tercer viaje misionero de Pablo, antes de su visita a Jerusalén con la colecta para los santos.',
    place: 'Probablemente escrita desde Corinto o Cencreas durante el tercer viaje misionero de Pablo.',
    audience: 'Cristianos en Roma, judíos y gentiles, con tensiones de identidad después de conflictos y expulsiones de judíos bajo Claudio.',
    purpose: 'Exponer el evangelio de la justicia de Dios, unir a judíos y gentiles en una misma comunidad y preparar apoyo para la misión hacia España.',
    literary: 'Romanos es una carta argumentativa. Pablo usa saludo epistolar, exposición doctrinal, preguntas retóricas, diatriba, citas del Antiguo Testamento, ejemplos de Abraham y Adán, exhortación ética y saludos personales. No debe leerse como un manual sistemático moderno, sino como un argumento pastoral y misionero dirigido a una comunidad real.',
    social: 'Roma reunía élites, trabajadores, esclavos, libertos, migrantes, comerciantes y comunidades judías antiguas. Las iglesias probablemente se reunían en casas. La tensión judío-gentil es clave: después de la expulsión de judíos bajo Claudio y su retorno posterior, la comunidad tuvo que negociar identidad, liderazgo, prácticas de la Ley, comidas, días y pertenencia.',
    cultural: 'La carta dialoga con el mundo judío de la diáspora y con una ciudad saturada de honor, patronazgo, poder imperial y pluralidad religiosa. Palabras como ley, carne, espíritu, gracia, fe, justicia, elección e Israel no son conceptos sueltos: funcionan dentro de Escritura judía, vida comunitaria y realidad romana.',
    political: 'Roma era el centro del imperio. Confesar a Cristo como Señor y formar una comunidad donde judíos y gentiles comen, se reciben y se sirven mutuamente tenía implicaciones sociales y políticas. Pablo no escribe propaganda antiimperial directa, pero su evangelio reordena lealtades, identidad y poder bajo el señorío de Cristo.',
    generalReading: 'Romanos 1-4 presenta la justicia de Dios frente al pecado de judíos y gentiles, y usa a Abraham como clave de la promesa. Romanos 5-8 desarrolla vida en Cristo, Espíritu, sufrimiento y esperanza. Romanos 9-11 responde la gran pregunta: si el evangelio incorpora gentiles, ¿qué pasa con Israel y las promesas? Romanos 12-16 aplica todo a la vida comunitaria. Por eso Romanos 9 debe leerse dentro de 9-11, no aislado como debate abstracto sobre predestinación.',
    history: 'Romanos nace en una iglesia que Pablo no fundó, ubicada en la capital imperial. Su trasfondo es pastoral, misionero y comunitario: Pablo quiere presentar su evangelio, sanar tensiones entre judíos y gentiles, mostrar la fidelidad de Dios a sus promesas y preparar una misión hacia España. La carta trabaja pecado, justicia, Ley, gracia, Abraham, Adán, Israel, gentiles, Espíritu, vida comunitaria y autoridad civil. Romanos 9-11 es central para entender cómo Pablo defiende que Dios no ha fallado a Israel aunque el evangelio esté alcanzando a los gentiles.'
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

const oldTestamentBookHistoryDetails = {
  Génesis: {
    era: 'Relatos patriarcales ubicados en el antiguo Cercano Oriente; forma final vinculada a la tradición de Israel y la Torá.',
    place: 'La forma final se entiende dentro de Israel, probablemente preservada y transmitida en contextos de memoria nacional, culto y enseñanza.',
    audience: 'Israel como pueblo del pacto, especialmente comunidades que necesitaban entender origen, creación, pecado, promesa, familia patriarcal y elección.',
    purpose: 'Explicar el origen del mundo, la humanidad, el pecado, las naciones y la promesa dada a Abraham, Isaac y Jacob.',
    literary: 'Narrativa teológica fundacional con genealogías, ciclos patriarcales, promesas, conflictos familiares y relatos de origen.',
    social: 'Mundo de clanes, herencia, tierra, esterilidad, primogenitura, migración, honor familiar y supervivencia en medio de imperios y hambrunas.',
    cultural: 'Comparte ambiente con tradiciones del antiguo Cercano Oriente, pero presenta una visión distintiva de Dios, creación, pacto y bendición.',
    political: 'Antes de la monarquía israelita; muestra familias vulnerables frente a ciudades, reinos, Egipto y poderes regionales.',
    generalReading: 'Todo pasaje de Génesis debe leerse dentro del movimiento creación-caída-promesa. Los capítulos patriarcales preparan la historia de Israel y la promesa de bendición para las naciones.',
    history: 'Génesis funciona como prólogo de la historia bíblica. Presenta a Dios como creador, al ser humano como responsable ante Dios, el pecado como ruptura, y la elección de Abraham como respuesta divina orientada a bendecir a todas las familias de la tierra.'
  },
  Éxodo: {
    era: 'Relatos ubicados en la esclavitud y salida de Egipto; forma final vinculada a la memoria fundacional de Israel.',
    place: 'Egipto, desierto, Sinaí y memoria litúrgica de Israel.',
    audience: 'Israel como comunidad liberada que necesitaba entender identidad, pacto, Ley, presencia de Dios y culto.',
    purpose: 'Mostrar cómo Dios libera a Israel, derrota el poder opresor, establece pacto y habita en medio de su pueblo.',
    literary: 'Narrativa de liberación, plagas, pascua, cruce del mar, pacto legal y construcción del tabernáculo.',
    social: 'Pueblo esclavizado que pasa a ser comunidad pactal; se forman leyes para justicia, culto, identidad y convivencia.',
    cultural: 'Contrasta el poder religioso-político egipcio con el Dios de Israel. Pascua, sangre, pan sin levadura y tabernáculo forman memoria comunitaria.',
    political: 'Conflicto entre el faraón como poder imperial y YHWH como liberador soberano.',
    generalReading: 'Cada pasaje debe leerse dentro del arco esclavitud-liberación-pacto-presencia. La salida de Egipto se vuelve patrón bíblico de redención.',
    history: 'Éxodo narra la formación de Israel como pueblo liberado. Su centro no es solo salir de Egipto, sino pasar de servidumbre a adoración, de opresión a pacto, y de ausencia aparente a presencia divina en el tabernáculo.'
  },
  Levítico: {
    era: 'Contexto literario del Sinaí, dentro de la formación cultual de Israel.',
    place: 'Sinaí y el sistema sacerdotal asociado al tabernáculo.',
    audience: 'Sacerdotes, levitas e Israel como pueblo llamado a vivir en santidad delante de Dios.',
    purpose: 'Regular culto, sacrificios, pureza, expiación, santidad y vida comunitaria ante la presencia divina.',
    literary: 'Instrucción legal y sacerdotal con secciones rituales, morales y calendáricas.',
    social: 'Organiza la vida de una comunidad donde culto, cuerpo, alimentos, enfermedad, justicia y relaciones están conectados.',
    cultural: 'Distingue a Israel de prácticas de pueblos vecinos y enseña santidad como vida ordenada ante Dios.',
    political: 'No se centra en monarquía, sino en el gobierno cultual de una comunidad pactal.',
    generalReading: 'Levítico debe leerse desde la pregunta: ¿cómo puede vivir un pueblo impuro cerca de un Dios santo?',
    history: 'Levítico enseña que la presencia de Dios exige mediación, pureza, expiación y justicia. Su lógica no es ritualismo vacío, sino santidad integral.'
  },
  Números: {
    era: 'Período del desierto entre Sinaí y la entrada a Canaán.',
    place: 'Desierto, campamentos de Israel y frontera de la tierra prometida.',
    audience: 'Israel como pueblo peregrino que debe aprender confianza, obediencia y orden comunitario.',
    purpose: 'Mostrar la fidelidad de Dios y la infidelidad de una generación que camina entre promesa y cumplimiento.',
    literary: 'Narrativa del desierto mezclada con censos, leyes, rebeliones, itinerarios y oráculos.',
    social: 'Tribus organizadas, liderazgo de Moisés y Aarón, conflictos internos, quejas, miedo y disciplina comunitaria.',
    cultural: 'La vida del campamento enseña pureza, orden, memoria y dependencia de Dios.',
    political: 'Israel aprende a vivir como pueblo antes de tener tierra, rodeado por naciones y amenazas.',
    generalReading: 'Cada pasaje se entiende dentro de la tensión entre promesa, incredulidad, juicio y preservación.',
    history: 'Números cuenta el costo de la incredulidad en camino a la promesa. El desierto revela qué hay en el pueblo y confirma que Dios sostiene su propósito aun con una generación rebelde.'
  },
  Deuteronomio: {
    era: 'Últimos discursos de Moisés antes de la entrada a la tierra.',
    place: 'Llanuras de Moab, frente a Canaán.',
    audience: 'La nueva generación de Israel preparada para entrar en la tierra.',
    purpose: 'Renovar el pacto y llamar a Israel a amar y obedecer a YHWH en la tierra.',
    literary: 'Discursos de pacto con memoria histórica, exhortación, ley, bendiciones, maldiciones y llamado a elegir vida.',
    social: 'Forma una sociedad que debe practicar justicia, cuidado del vulnerable, fidelidad exclusiva y memoria comunitaria.',
    cultural: 'Contrasta la adoración de YHWH con prácticas cananeas y advierte contra olvido, idolatría y autosuficiencia.',
    political: 'Da forma teológica a la vida nacional antes de la posesión de la tierra.',
    generalReading: 'Leer Deuteronomio desde memoria, pacto, amor, obediencia y vida en la tierra.',
    history: 'Deuteronomio es una predicación de renovación. Moisés prepara a Israel para vivir como pueblo del pacto, recordando que la tierra es don y responsabilidad.'
  },
  Josué: {
    era: 'Entrada y asentamiento inicial en Canaán.',
    place: 'Canaán, desde el Jordán hasta las tribus asentadas.',
    audience: 'Israel en memoria de conquista, tierra y fidelidad de Dios.',
    purpose: 'Mostrar que Dios cumple su promesa de dar la tierra y llamar al pueblo a fidelidad exclusiva.',
    literary: 'Narrativa histórica-teológica de conquista, distribución tribal y renovación del pacto.',
    social: 'Tribus coordinadas bajo liderazgo de Josué, con énfasis en obediencia, memoria y herencia.',
    cultural: 'Tensión con cultos cananeos y prácticas religiosas de la tierra.',
    political: 'Transición de pueblo peregrino a pueblo asentado entre ciudades-estado cananeas.',
    generalReading: 'Cada pasaje debe leerse desde promesa cumplida, tierra recibida y fidelidad exigida.',
    history: 'Josué presenta la entrada a la tierra como acto de fidelidad divina y prueba de lealtad para Israel.'
  },
  Jueces: {
    era: 'Período tribal antes de la monarquía.',
    place: 'Diversas regiones de Canaán.',
    audience: 'Israel mirando críticamente su pasado premonárquico.',
    purpose: 'Mostrar el deterioro espiritual y social cuando Israel abandona a YHWH.',
    literary: 'Ciclos narrativos de pecado, opresión, clamor, liberación y recaída.',
    social: 'Fragmentación tribal, violencia, crisis de liderazgo y deterioro moral.',
    cultural: 'Sincretismo con Baal, Asera y prácticas cananeas.',
    political: 'Ausencia de rey y liderazgo estable; amenazas de pueblos vecinos.',
    generalReading: 'Leer cada historia como parte de una espiral descendente, no como héroes morales simples.',
    history: 'Jueces muestra una sociedad que pierde identidad pactal. La frase “cada uno hacía lo que bien le parecía” resume la crisis.'
  },
  Rut: {
    era: 'Ubicada en días de los jueces; narración preservada para memoria posterior.',
    place: 'Moab y Belén.',
    audience: 'Israel reflexionando sobre providencia, lealtad, redención familiar y linaje davídico.',
    purpose: 'Mostrar fidelidad de Dios mediante decisiones ordinarias, lealtad familiar e incorporación de una moabita al linaje de David.',
    literary: 'Narrativa breve con estructura de pérdida, lealtad, provisión, redención y genealogía.',
    social: 'Viudez, migración, pobreza, espigueo, parentesco redentor y honor familiar.',
    cultural: 'Tensión entre identidad israelita y extranjera moabita; Rut encarna hesed, lealtad pactal.',
    political: 'Prepara el linaje de David en una época de inestabilidad tribal.',
    generalReading: 'Leer Rut como historia de providencia discreta y redención familiar dentro de la gran historia davídica.',
    history: 'Rut muestra que la fidelidad de Dios opera en vidas vulnerables y abre espacio para extranjeros dentro del propósito de Israel.'
  },
  '1 Samuel': {
    era: 'Transición de jueces a monarquía.',
    place: 'Israel, Silo, Ramá, Gabaa y regiones filisteas.',
    audience: 'Israel interpretando el surgimiento de la monarquía.',
    purpose: 'Explicar el paso de Samuel a Saúl y luego a David, mostrando qué tipo de rey rechaza o aprueba Dios.',
    literary: 'Narrativa histórica con ciclos de nacimiento, llamado profético, arca, reinado, rechazo y ascenso de David.',
    social: 'Crisis de liderazgo, amenaza filistea, demanda popular de rey y tensión entre apariencia y obediencia.',
    cultural: 'Arca, sacrificios, profecía, honor guerrero y vida tribal.',
    political: 'Nacimiento de la monarquía israelita bajo presión militar filistea.',
    generalReading: 'Leer cada episodio como discernimiento sobre liderazgo, obediencia y reinado bajo Dios.',
    history: '1 Samuel explica por qué Saúl fracasa y David emerge: no por poder externo, sino por la evaluación divina del corazón y la obediencia.'
  },
  '2 Samuel': {
    era: 'Reinado de David.',
    place: 'Judá, Jerusalén e Israel unido.',
    audience: 'Israel interpretando la dinastía davídica.',
    purpose: 'Mostrar el establecimiento del pacto davídico y también las consecuencias del pecado dentro de la casa real.',
    literary: 'Narrativa real con ascenso, pacto, pecado, juicio familiar y crisis política.',
    social: 'Corte real, ejército, familia, honor, abuso de poder y conflicto sucesorio.',
    cultural: 'Jerusalén, arca, templo futuro y teología de realeza.',
    political: 'Consolidación de Jerusalén y del reino unido, seguida por rebeliones internas.',
    generalReading: 'Leer desde el pacto davídico y la tensión entre promesa divina y pecado humano.',
    history: '2 Samuel no idealiza a David. Presenta a un rey elegido por Dios, pero responsable de abusos que fracturan su familia y reino.'
  },
  '1 Reyes': {
    era: 'Desde Salomón hasta el reino dividido.',
    place: 'Jerusalén, Israel del norte y Judá.',
    audience: 'Israel/Judá interpretando monarquía, templo e idolatría.',
    purpose: 'Evaluar reyes según fidelidad a YHWH y explicar el deterioro que lleva al juicio.',
    literary: 'Historia profética de reyes, templo, división del reino y ministerios proféticos.',
    social: 'Tributación, trabajo forzado, corte, culto y desigualdad.',
    cultural: 'Templo de Jerusalén frente a altares rivales e idolatría de Baal.',
    political: 'División norte-sur, alianzas internacionales y conflictos regionales.',
    generalReading: 'Cada rey se evalúa teológicamente por fidelidad, idolatría y justicia.',
    history: '1 Reyes muestra que sabiduría, templo y poder no garantizan fidelidad. La división del reino revela grietas espirituales y políticas.'
  },
  '2 Reyes': {
    era: 'Desde reinos divididos hasta exilio de Israel y Judá.',
    place: 'Israel, Judá, Asiria y Babilonia.',
    audience: 'Comunidad que busca entender por qué llegó el exilio.',
    purpose: 'Mostrar que el exilio fue consecuencia de infidelidad persistente, aunque Dios preserva esperanza.',
    literary: 'Historia profética con reyes, profetas, caída de Samaria y caída de Jerusalén.',
    social: 'Crisis nacional, injusticia, idolatría, reforma parcial y colapso.',
    cultural: 'Cultos rivales, sincretismo, templo profanado y reformas de Ezequías/Josías.',
    political: 'Presión de Asiria, Egipto y Babilonia sobre reinos pequeños.',
    generalReading: 'Leer como explicación teológica del exilio y llamado a recordar la palabra profética.',
    history: '2 Reyes cuenta el derrumbe de Israel y Judá como tragedia pactal. La política importa, pero el narrador subraya infidelidad religiosa y moral.'
  },
  '1 Crónicas': {
    era: 'Forma final postexílica.',
    place: 'Comunidad judía restaurada en Judá/Jerusalén.',
    audience: 'Judíos postexílicos que necesitaban recuperar identidad, genealogía, templo y esperanza davídica.',
    purpose: 'Releer la historia desde Adán hasta David para afirmar continuidad del pueblo y centralidad del culto.',
    literary: 'Genealogías e historia davídica con énfasis litúrgico.',
    social: 'Comunidad pequeña reconstruyendo identidad después del exilio.',
    cultural: 'Templo, levitas, músicos, sacerdotes y memoria de David.',
    political: 'Judá sin monarquía davídica activa bajo imperios persas/postexílicos.',
    generalReading: 'Leer como recuperación de identidad y culto para una comunidad restaurada.',
    history: '1 Crónicas no repite Samuel-Reyes sin más; selecciona la historia para fortalecer esperanza, genealogía y adoración.'
  },
  '2 Crónicas': {
    era: 'Forma final postexílica.',
    place: 'Judá/Jerusalén después del exilio.',
    audience: 'Comunidad postexílica centrada en templo y fidelidad.',
    purpose: 'Releer la monarquía de Judá, el templo y las reformas para llamar a fidelidad renovada.',
    literary: 'Historia teológica de Salomón, templo y reyes de Judá.',
    social: 'Comunidad restaurada buscando continuidad con el pasado.',
    cultural: 'Culto del templo, sacerdocio, levitas, oración y reforma.',
    political: 'Memoria de monarquía en una época sin independencia plena.',
    generalReading: 'Leer desde templo, arrepentimiento, búsqueda de Dios y consecuencias de infidelidad.',
    history: '2 Crónicas explica el pasado para formar al pueblo después del exilio. Destaca que buscar a Dios trae vida, y abandonarlo trae ruina.'
  },
  Esdras: {
    era: 'Período persa postexílico.',
    place: 'Babilonia/Persia y Jerusalén.',
    audience: 'Judíos retornados que reconstruían templo e identidad.',
    purpose: 'Narrar el retorno, reconstrucción del templo y reforma de la comunidad bajo la Torá.',
    literary: 'Narrativa histórica con documentos oficiales, listas y reformas.',
    social: 'Retornados, tensiones con pueblos vecinos y problemas de identidad comunitaria.',
    cultural: 'Templo, Torá, separación religiosa y restauración del culto.',
    political: 'Bajo autorización y límites del imperio persa.',
    generalReading: 'Leer como restauración incompleta: vuelve el templo, pero la comunidad necesita reforma.',
    history: 'Esdras muestra que el retorno físico no basta. La restauración exige culto renovado y obediencia a la Torá.'
  },
  Nehemías: {
    era: 'Período persa postexílico.',
    place: 'Susa y Jerusalén.',
    audience: 'Judíos restaurados en Jerusalén.',
    purpose: 'Narrar reconstrucción de murallas, renovación social y compromiso con la Torá.',
    literary: 'Memoria autobiográfica, narrativa histórica, listas y pacto comunitario.',
    social: 'Pobreza, deuda, oposición externa, liderazgo y reorganización urbana.',
    cultural: 'Lectura pública de la Torá, confesión, fiesta y reforma comunitaria.',
    political: 'Judá como provincia bajo Persia, con tensiones locales.',
    generalReading: 'Leer como reconstrucción física y espiritual de una comunidad vulnerable.',
    history: 'Nehemías une oración, liderazgo práctico y reforma social. La muralla protege, pero la Torá redefine al pueblo.'
  },
  Ester: {
    era: 'Período persa.',
    place: 'Susa, corte persa.',
    audience: 'Judíos de la diáspora explicando preservación y origen de Purim.',
    purpose: 'Mostrar la preservación providencial del pueblo judío en el exilio.',
    literary: 'Narrativa cortesana con ironía, reversión, peligro étnico y memoria festiva.',
    social: 'Minoría judía vulnerable en diáspora imperial.',
    cultural: 'Banquetes, corte persa, honor, edictos, identidad judía y fiesta de Purim.',
    political: 'Poder imperial persa y amenaza legal contra un pueblo minoritario.',
    generalReading: 'Leer desde reversión providencial, identidad en diáspora y supervivencia del pueblo.',
    history: 'Ester muestra a judíos viviendo lejos de la tierra, bajo poder extranjero, preservados mediante decisiones humanas y providencia implícita.'
  },
  Job: {
    era: 'Ambientación patriarcal/sapiencial; fecha de composición debatida.',
    place: 'Uz, fuera del marco institucional de Israel.',
    audience: 'Comunidad de sabiduría que reflexiona sobre sufrimiento justo y justicia divina.',
    purpose: 'Cuestionar explicaciones simplistas del sufrimiento y conducir a humildad ante Dios.',
    literary: 'Prólogo y epílogo narrativo con diálogos poéticos sapienciales.',
    social: 'Honor, riqueza, pérdida, consejo de amigos, duelo y reputación.',
    cultural: 'Sabiduría del antiguo Cercano Oriente dialogando con fe israelita.',
    political: 'No se centra en política nacional, sino en gobierno moral del mundo.',
    generalReading: 'Leer cada discurso dentro del debate completo, no como doctrina aislada de cada amigo.',
    history: 'Job confronta la idea de que todo sufrimiento prueba culpa personal. El libro exige reverencia, honestidad y límites al explicar el dolor.'
  },
  Salmos: {
    era: 'Colección formada a lo largo de siglos, desde tradiciones davídicas hasta uso postexílico.',
    place: 'Israel/Judá, templo, corte, comunidad y vida devocional.',
    audience: 'Israel en adoración, lamento, acción de gracias, instrucción y esperanza.',
    purpose: 'Dar lenguaje inspirado para oración, culto, sufrimiento, alabanza, memoria y esperanza real/mesiánica.',
    literary: 'Poesía hebrea con paralelismo, lamento, himno, acción de gracias, salmo real, sapiencial e imprecatorio.',
    social: 'Vida comunitaria y personal: enfermedad, enemigos, injusticia, templo, rey y peregrinación.',
    cultural: 'Culto del templo, música, memoria del éxodo, Sion y realeza davídica.',
    political: 'Incluye monarquía, crisis nacional, exilio y esperanza de gobierno justo.',
    generalReading: 'Leer cada salmo según su género; no todos funcionan igual.',
    history: 'Salmos es el libro de oración de Israel. Expresa fe realista: alabanza, angustia, protesta, pecado, justicia y esperanza ante Dios.'
  },
  Proverbios: {
    era: 'Tradición sapiencial asociada a Salomón y sabios de Israel; compilación posterior.',
    place: 'Israel/Judá, ambientes familiares, cortesanos y educativos.',
    audience: 'Jóvenes, hijos, discípulos y comunidad que aprende sabiduría práctica.',
    purpose: 'Formar carácter, prudencia, justicia, temor de YHWH y vida ordenada.',
    literary: 'Sabiduría proverbial, discursos paternos, dichos breves y poemas sobre sabiduría.',
    social: 'Familia, trabajo, dinero, lengua, sexualidad, justicia, amistad y poder.',
    cultural: 'Sabiduría israelita en diálogo con tradición sapiencial del antiguo Cercano Oriente.',
    political: 'Incluye consejos sobre reyes, justicia y administración.',
    generalReading: 'Leer proverbios como sabiduría general, no como promesas mecánicas absolutas.',
    history: 'Proverbios enseña que la vida ante Dios tiene orden moral. Forma personas prudentes, justas y humildes.'
  },
  Eclesiastés: {
    era: 'Sabiduría tardía; fecha debatida.',
    place: 'Ambiente sapiencial de Israel/Judá.',
    audience: 'Lectores que enfrentan límites, muerte, injusticia y frustración de la vida.',
    purpose: 'Exponer la vanidad de controlar la vida y llamar a temer a Dios en medio de lo incomprensible.',
    literary: 'Reflexión sapiencial con observación, paradoja, crítica y conclusión teológica.',
    social: 'Trabajo, riqueza, placer, sabiduría, poder, muerte e injusticia.',
    cultural: 'Sabiduría que cuestiona respuestas fáciles y triunfalistas.',
    political: 'Observa opresión, burocracia y límites del poder.',
    generalReading: 'Leer desde la tensión “debajo del sol” y la conclusión de temer a Dios.',
    history: 'Eclesiastés confronta la ilusión de dominio humano. No destruye la fe; purifica expectativas falsas.'
  },
  Cantares: {
    era: 'Poesía amorosa asociada a tradición salomónica; fecha debatida.',
    place: 'Israel/Judá, mundo poético de jardines, ciudad y campo.',
    audience: 'Comunidad que celebra amor, deseo y fidelidad.',
    purpose: 'Celebrar el amor humano con intensidad poética dentro de la creación de Dios.',
    literary: 'Poesía lírica amorosa con voces alternadas, imágenes sensoriales y deseo.',
    social: 'Amor, búsqueda, espera, deseo, familia y comunidad.',
    cultural: 'Imágenes de naturaleza, perfumes, viñas, jardines y belleza oriental antigua.',
    political: 'No es texto político; usa imágenes reales/cortesanas como lenguaje poético.',
    generalReading: 'Leer primero como poesía amorosa, evitando alegorizar cada detalle de forma forzada.',
    history: 'Cantares afirma la belleza del amor y el deseo en lenguaje poético, no técnico.'
  },
  Isaías: {
    era: 'Siglos VIII-VI a.C., con material vinculado a crisis asiria, exilio y esperanza de restauración.',
    place: 'Judá/Jerusalén, con horizonte hacia Asiria, Babilonia y naciones.',
    audience: 'Judá, Jerusalén, líderes, pueblo y generaciones exílicas/postexílicas.',
    purpose: 'Denunciar pecado, anunciar juicio y consolar con esperanza de restauración, siervo y nueva creación.',
    literary: 'Profecía poética con oráculos, visiones, juicios contra naciones, consuelo y cánticos del siervo.',
    social: 'Injusticia, corrupción, culto vacío, opresión y esperanza para pobres.',
    cultural: 'Sion, templo, santidad, remanente, siervo, luz a las naciones.',
    political: 'Crisis asiria, alianzas fallidas, Babilonia y esperanza más allá del imperio.',
    generalReading: 'Leer cada sección según su horizonte: juicio a Judá, naciones, exilio, consuelo o restauración.',
    history: 'Isaías interpreta la historia de Judá ante imperios. El Santo de Israel juzga la soberbia y promete restauración que alcanza a las naciones.'
  },
  Jeremías: {
    era: 'Finales del siglo VII e inicios del VI a.C., caída de Jerusalén.',
    place: 'Judá/Jerusalén y luego contexto de crisis con Babilonia.',
    audience: 'Judá antes y durante el exilio babilónico.',
    purpose: 'Anunciar juicio inevitable por infidelidad y prometer nuevo pacto y restauración futura.',
    literary: 'Profecía con oráculos, narrativas biográficas, lamentos y señales simbólicas.',
    social: 'Falsa seguridad, injusticia, idolatría, persecución profética y trauma nacional.',
    cultural: 'Templo, pacto, circuncisión del corazón y crítica al culto vacío.',
    political: 'Entre Egipto y Babilonia; colapso de la monarquía davídica.',
    generalReading: 'Leer desde la tensión entre juicio histórico y esperanza de nuevo pacto.',
    history: 'Jeremías habla a un pueblo que no quiere aceptar la verdad del juicio. Su mensaje atraviesa rechazo, llanto y esperanza.'
  },
  Lamentaciones: {
    era: 'Después de la caída de Jerusalén en 586 a.C.',
    place: 'Jerusalén destruida.',
    audience: 'Comunidad sobreviviente del desastre babilónico.',
    purpose: 'Dar lenguaje de duelo, confesión y esperanza mínima ante la devastación.',
    literary: 'Poemas acrósticos de lamento funerario y comunitario.',
    social: 'Hambre, pérdida, vergüenza, violencia, duelo y trauma colectivo.',
    cultural: 'Ciudad personificada, templo destruido y memoria de pacto.',
    political: 'Consecuencia de la conquista babilónica.',
    generalReading: 'Leer como lamento, no como explicación fría del sufrimiento.',
    history: 'Lamentaciones enseña a llorar delante de Dios. No niega culpa ni dolor; los lleva a oración.'
  },
  Ezequiel: {
    era: 'Exilio babilónico, siglo VI a.C.',
    place: 'Babilonia, entre exiliados junto al río Quebar.',
    audience: 'Exiliados de Judá que necesitaban entender juicio, presencia de Dios y esperanza.',
    purpose: 'Explicar la gloria de Dios, el juicio sobre Jerusalén y la futura restauración del pueblo.',
    literary: 'Visiones, acciones simbólicas, oráculos de juicio, restauración y templo futuro.',
    social: 'Comunidad deportada, pérdida de tierra, templo e identidad.',
    cultural: 'Pureza, gloria, idolatría, corazón nuevo, pastor y templo.',
    political: 'Babilonia domina; Jerusalén cae mientras los exiliados esperan.',
    generalReading: 'Leer desde gloria que abandona y vuelve, juicio y restauración.',
    history: 'Ezequiel muestra que Dios no quedó preso del templo destruido. Su presencia juzga y también promete vida nueva.'
  },
  Daniel: {
    era: 'Relatos ambientados en exilio babilónico/persa; secciones apocalípticas con horizonte de imperios.',
    place: 'Babilonia y cortes imperiales.',
    audience: 'Judíos bajo dominio extranjero que necesitaban fidelidad y esperanza.',
    purpose: 'Mostrar que Dios gobierna sobre imperios y sostiene a los fieles.',
    literary: 'Narrativa cortesana y visiones apocalípticas.',
    social: 'Minoría judía en corte extranjera, presión de asimilación y fidelidad alimentaria/cultual.',
    cultural: 'Sueños, sabiduría cortesana, estatuas, bestias y lenguaje simbólico.',
    political: 'Imperios babilónico, medo-persa, griego y horizonte opresivo.',
    generalReading: 'Leer narrativas como fidelidad en exilio y visiones como esperanza simbólica ante imperios.',
    history: 'Daniel enseña resistencia fiel: los imperios parecen absolutos, pero Dios juzga y establece su reino.'
  },
  Oseas: {
    era: 'Siglo VIII a.C., reino del norte antes de la caída de Samaria.',
    place: 'Israel del norte.',
    audience: 'Israel infiel bajo prosperidad y crisis política.',
    purpose: 'Denunciar idolatría como adulterio pactal y anunciar juicio con esperanza de restauración.',
    literary: 'Profecía poética con matrimonio simbólico, acusación y promesa.',
    social: 'Inestabilidad, injusticia, culto sin fidelidad y alianzas políticas.',
    cultural: 'Baalismo, fertilidad, pacto, hesed y conocimiento de Dios.',
    political: 'Presión asiria y alianzas inestables.',
    generalReading: 'Leer desde la metáfora matrimonial y la tensión juicio-amor fiel.',
    history: 'Oseas presenta el dolor de Dios ante la infidelidad de Israel y su amor persistente.'
  },
  Joel: {
    era: 'Fecha debatida; contexto de plaga, crisis cultual y día de YHWH.',
    place: 'Judá/Jerusalén.',
    audience: 'Comunidad llamada al arrepentimiento ante desastre.',
    purpose: 'Interpretar crisis como llamado al arrepentimiento y anunciar restauración y derramamiento del Espíritu.',
    literary: 'Profecía litúrgica con lamento, llamado, promesa y día de YHWH.',
    social: 'Crisis agrícola, ayuno, sacerdotes, comunidad reunida.',
    cultural: 'Templo, sacrificios interrumpidos, lamento comunitario.',
    political: 'Naciones aparecen como amenaza y objeto de juicio.',
    generalReading: 'Leer desde desastre presente, arrepentimiento y esperanza futura.',
    history: 'Joel transforma una crisis nacional en llamado a buscar a Dios y esperar su restauración.'
  },
  Amós: {
    era: 'Siglo VIII a.C., prosperidad del reino del norte.',
    place: 'Israel del norte, desde un profeta de Judá/Tecoa.',
    audience: 'Israel próspero pero injusto.',
    purpose: 'Denunciar injusticia social, culto hipócrita y seguridad falsa.',
    literary: 'Oráculos de juicio, visiones y denuncia profética.',
    social: 'Riqueza de élites, opresión de pobres, corrupción judicial.',
    cultural: 'Culto en Betel y Gilgal sin justicia.',
    political: 'Prosperidad bajo Jeroboam II antes del juicio asirio.',
    generalReading: 'Leer desde justicia social como exigencia pactal, no tema secundario.',
    history: 'Amós declara que culto sin justicia es abominación. La elección de Israel aumenta responsabilidad.'
  },
  Abdías: {
    era: 'Relacionado con la caída de Jerusalén y juicio contra Edom.',
    place: 'Judá/Edom.',
    audience: 'Judá herida por traición de Edom.',
    purpose: 'Anunciar juicio contra Edom por violencia contra su hermano Jacob.',
    literary: 'Oráculo breve de juicio y reversión.',
    social: 'Traición familiar-nacional, violencia y aprovechamiento del desastre.',
    cultural: 'Memoria de Jacob y Esaú aplicada a pueblos vecinos.',
    political: 'Edom se beneficia de la caída de Jerusalén.',
    generalReading: 'Leer desde justicia contra violencia oportunista.',
    history: 'Abdías afirma que Dios ve la traición de las naciones y vindica a Sion.'
  },
  Jonás: {
    era: 'Narrativa profética con Nínive asiria como escenario.',
    place: 'Israel, mar y Nínive.',
    audience: 'Israel confrontado con la misericordia de Dios hacia enemigos.',
    purpose: 'Cuestionar nacionalismo religioso y mostrar compasión divina por naciones.',
    literary: 'Narrativa profética satírica con ironía y reversión.',
    social: 'Profeta resistente, paganos que responden mejor que él.',
    cultural: 'Nínive representa enemigo poderoso y cruel.',
    political: 'Asiria como amenaza imperial.',
    generalReading: 'Leer como confrontación del corazón del profeta y del lector.',
    history: 'Jonás no se centra en técnica profética, sino en la pregunta: ¿aceptará Israel que Dios tenga misericordia de sus enemigos?'
  },
  Miqueas: {
    era: 'Siglo VIII a.C., contemporáneo de Isaías.',
    place: 'Judá, especialmente zonas rurales afectadas por élites.',
    audience: 'Judá e Israel bajo injusticia y amenaza asiria.',
    purpose: 'Denunciar opresión, anunciar juicio y prometer restauración desde Belén.',
    literary: 'Oráculos de juicio, lamento, pleito pactal y esperanza.',
    social: 'Despojo de tierras, corrupción de líderes y falso profetismo.',
    cultural: 'Sion, justicia, humildad y esperanza davídica.',
    political: 'Amenaza asiria y crisis de liderazgo.',
    generalReading: 'Leer desde justicia, juicio y esperanza mesiánica humilde.',
    history: 'Miqueas defiende a los vulnerables y resume fidelidad como hacer justicia, amar misericordia y caminar humildemente con Dios.'
  },
  Nahúm: {
    era: 'Antes/después cercano a la caída de Nínive en 612 a.C.',
    place: 'Judá mirando el juicio de Asiria.',
    audience: 'Judá oprimida por poder asirio.',
    purpose: 'Anunciar juicio contra Nínive y consolar a Judá.',
    literary: 'Poema profético de juicio contra imperio violento.',
    social: 'Memoria de violencia imperial, terror y opresión.',
    cultural: 'Lenguaje guerrero y teofánico.',
    political: 'Caída del imperio asirio.',
    generalReading: 'Leer como justicia contra opresión imperial, no como venganza personal.',
    history: 'Nahúm declara que el poder brutal de Nínive no es eterno. Dios juzga imperios violentos.'
  },
  Habacuc: {
    era: 'Final del siglo VII a.C., ascenso babilónico.',
    place: 'Judá.',
    audience: 'Judá perpleja ante injusticia y amenaza extranjera.',
    purpose: 'Dialogar con Dios sobre injusticia y enseñar fidelidad en espera.',
    literary: 'Diálogo profético, oráculos y salmo final.',
    social: 'Violencia interna, injusticia y angustia ante juicio.',
    cultural: 'El justo vivirá por su fidelidad/fe.',
    political: 'Babilonia como instrumento de juicio y problema moral.',
    generalReading: 'Leer desde preguntas honestas y confianza final.',
    history: 'Habacuc muestra que la fe bíblica puede preguntar con dolor y aun así esperar en Dios.'
  },
  Sofonías: {
    era: 'Reinado de Josías, siglo VII a.C.',
    place: 'Judá/Jerusalén.',
    audience: 'Judá antes de reformas y juicio.',
    purpose: 'Anunciar día de YHWH, juicio contra idolatría y esperanza para un remanente humilde.',
    literary: 'Oráculos de juicio y restauración.',
    social: 'Élites, comerciantes, líderes corruptos y remanente pobre.',
    cultural: 'Idolatría, sincretismo y purificación.',
    political: 'Judá antes del colapso babilónico.',
    generalReading: 'Leer desde día de YHWH como juicio y purificación.',
    history: 'Sofonías advierte que la cercanía religiosa no evita juicio si hay idolatría e injusticia.'
  },
  Hageo: {
    era: '520 a.C., período persa postexílico.',
    place: 'Jerusalén.',
    audience: 'Retornados que habían descuidado la reconstrucción del templo.',
    purpose: 'Llamar a reconstruir el templo y priorizar la presencia de Dios.',
    literary: 'Oráculos fechados y exhortaciones breves.',
    social: 'Comunidad pobre, desanimada y enfocada en supervivencia.',
    cultural: 'Templo como centro de identidad y adoración.',
    political: 'Bajo dominio persa con liderazgo de Zorobabel y Josué.',
    generalReading: 'Leer desde prioridades espirituales en la restauración postexílica.',
    history: 'Hageo llama a una comunidad cansada a reconstruir el símbolo central de la presencia de Dios.'
  },
  Zacarías: {
    era: '520 a.C. y contexto postexílico posterior.',
    place: 'Jerusalén postexílica.',
    audience: 'Retornados que necesitaban esperanza y purificación.',
    purpose: 'Animar reconstrucción, llamar al arrepentimiento y anunciar esperanza mesiánica y escatológica.',
    literary: 'Visiones nocturnas, oráculos simbólicos y esperanza futura.',
    social: 'Comunidad restaurada, vulnerable y desalentada.',
    cultural: 'Templo, sacerdocio, rey, purificación y Sion.',
    political: 'Judá bajo Persia, sin independencia davídica plena.',
    generalReading: 'Leer símbolos con cuidado, dentro de restauración y esperanza futura.',
    history: 'Zacarías levanta la mirada de una comunidad pequeña hacia el propósito grande de Dios para Sion y las naciones.'
  },
  Malaquías: {
    era: 'Postexilio, probablemente siglo V a.C.',
    place: 'Judá/Jerusalén.',
    audience: 'Comunidad postexílica con culto descuidado y apatía espiritual.',
    purpose: 'Confrontar sacerdotes y pueblo por infidelidad, injusticia y culto defectuoso.',
    literary: 'Disputas proféticas con preguntas y respuestas.',
    social: 'Divorcio, injusticia, cansancio religioso y corrupción sacerdotal.',
    cultural: 'Templo restaurado pero culto debilitado.',
    political: 'Judá bajo administración persa.',
    generalReading: 'Leer como llamado final a fidelidad antes de la espera profética.',
    history: 'Malaquías muestra que volver del exilio no garantiza renovación del corazón. El libro cierra con expectativa de intervención futura de Dios.'
  }
};

function getBookHistory(book) {
  if (!book) return null;
  const history = bookHistoryDetails[book] ?? oldTestamentBookHistoryDetails[book];
  return history ? { book, ...history } : null;
}

const geoProfiles = {
  antiguoOriente: {
    region: 'Antiguo Cercano Oriente: Mesopotamia, Canaán y Egipto',
    ancientFrame: 'Patriarcas, clanes, ciudades-estado, Egipto y tradiciones tempranas de Israel.',
    currentCountries: 'Irak, Siria/Turquía, Israel, territorios palestinos y Egipto, según la escena del libro.',
    mapLabel: 'Mesopotamia - Canaán - Egipto',
    pin: { x: 47, y: 54 }
  },
  egiptoSinai: {
    region: 'Egipto, Sinaí, desierto y frontera de Canaán',
    ancientFrame: 'Egipto faraónico, campamentos de Israel, Sinaí y llanuras de Moab.',
    currentCountries: 'Egipto, Israel, territorios palestinos, Jordania y zonas desérticas cercanas.',
    mapLabel: 'Egipto - Sinaí - Moab',
    pin: { x: 43, y: 65 }
  },
  israelJuda: {
    region: 'Canaán, Israel, Judá y Jerusalén',
    ancientFrame: 'Tribus de Israel, monarquía unida, reino del norte, Judá y dominio de imperios vecinos.',
    currentCountries: 'Israel, territorios palestinos y Jordania, según el episodio.',
    mapLabel: 'Israel / Judá',
    pin: { x: 54, y: 55 }
  },
  moabBelen: {
    region: 'Moab y Belén',
    ancientFrame: 'Moab al este del Jordán y Judá alrededor de Belén.',
    currentCountries: 'Jordania, Israel y territorios palestinos.',
    mapLabel: 'Moab - Belén',
    pin: { x: 56, y: 58 }
  },
  exilioPersia: {
    region: 'Babilonia, Persia, Susa y Jerusalén',
    ancientFrame: 'Imperios babilónico y persa, diáspora judía y retorno postexílico.',
    currentCountries: 'Irak, Irán, Israel y territorios palestinos.',
    mapLabel: 'Babilonia / Persia',
    pin: { x: 70, y: 50 }
  },
  sabiduriaIsrael: {
    region: 'Israel y Judá como mundo sapiencial, poético y cultual',
    ancientFrame: 'Templo, corte, familia, sabios, culto y memoria nacional de Israel.',
    currentCountries: 'Principalmente Israel y territorios palestinos.',
    mapLabel: 'Israel / Judá',
    pin: { x: 54, y: 55 }
  },
  profetasIsraelJuda: {
    region: 'Israel, Judá, Jerusalén y naciones vecinas',
    ancientFrame: 'Reinos de Israel y Judá bajo presión de Asiria, Babilonia y Persia.',
    currentCountries: 'Israel, territorios palestinos, Jordania, Siria, Irak e Irán, según el profeta.',
    mapLabel: 'Israel / Judá y grandes imperios',
    pin: { x: 55, y: 54 }
  },
  asiaMenor: {
    region: 'Asia Menor occidental y mundo del Egeo',
    ancientFrame: 'Provincia romana de Asia, ciudades grecorromanas, culto imperial y vida urbana.',
    currentCountries: 'Principalmente Turquía occidental; Patmos pertenece hoy a Grecia.',
    mapLabel: 'Asia Menor',
    pin: { x: 45, y: 38 }
  },
  romaItalia: {
    region: 'Roma y la península itálica',
    ancientFrame: 'Capital del Imperio romano, comunidades judías de la diáspora e iglesias domésticas.',
    currentCountries: 'Italia.',
    mapLabel: 'Roma',
    pin: { x: 28, y: 36 }
  },
  greciaMacedonia: {
    region: 'Grecia, Macedonia y Acaya',
    ancientFrame: 'Colonias y ciudades grecorromanas bajo Roma, comercio, patronazgo y honor público.',
    currentCountries: 'Grecia y Macedonia del Norte, según el libro.',
    mapLabel: 'Grecia / Macedonia',
    pin: { x: 38, y: 43 }
  },
  siriaPalestina: {
    region: 'Judea, Galilea, Siria y Antioquía',
    ancientFrame: 'Judaísmo del Segundo Templo bajo Roma, sinagogas, Templo, Herodes y prefectos romanos.',
    currentCountries: 'Israel, territorios palestinos, Siria, Líbano y Turquía meridional, según la hipótesis.',
    mapLabel: 'Judea / Siria',
    pin: { x: 55, y: 50 }
  },
  creta: {
    region: 'Creta',
    ancientFrame: 'Isla mediterránea bajo dominio romano, con comunidades urbanas y rurales.',
    currentCountries: 'Grecia.',
    mapLabel: 'Creta',
    pin: { x: 42, y: 50 }
  },
  desconocidoMediterraneo: {
    region: 'Mediterráneo oriental o diáspora cristiana temprana',
    ancientFrame: 'Ubicación debatida; mundo judío-cristiano y grecorromano del siglo I.',
    currentCountries: 'No se puede fijar un país actual único con seguridad.',
    mapLabel: 'Ubicación debatida',
    pin: { x: 48, y: 45 }
  }
};

const bookGeoProfileKeys = {
  Genesis: 'antiguoOriente',
  Éxodo: 'egiptoSinai',
  Levítico: 'egiptoSinai',
  Números: 'egiptoSinai',
  Deuteronomio: 'egiptoSinai',
  Josué: 'israelJuda',
  Jueces: 'israelJuda',
  Rut: 'moabBelen',
  '1 Samuel': 'israelJuda',
  '2 Samuel': 'israelJuda',
  '1 Reyes': 'israelJuda',
  '2 Reyes': 'israelJuda',
  '1 Crónicas': 'israelJuda',
  '2 Crónicas': 'israelJuda',
  Esdras: 'exilioPersia',
  Nehemías: 'exilioPersia',
  Ester: 'exilioPersia',
  Job: 'desconocidoMediterraneo',
  Salmos: 'sabiduriaIsrael',
  Proverbios: 'sabiduriaIsrael',
  Eclesiastés: 'sabiduriaIsrael',
  Cantares: 'sabiduriaIsrael',
  Isaías: 'profetasIsraelJuda',
  Jeremías: 'profetasIsraelJuda',
  Lamentaciones: 'israelJuda',
  Ezequiel: 'exilioPersia',
  Daniel: 'exilioPersia',
  Oseas: 'profetasIsraelJuda',
  Joel: 'profetasIsraelJuda',
  Amós: 'profetasIsraelJuda',
  Abdías: 'profetasIsraelJuda',
  Jonás: 'profetasIsraelJuda',
  Miqueas: 'profetasIsraelJuda',
  Nahúm: 'profetasIsraelJuda',
  Habacuc: 'profetasIsraelJuda',
  Sofonías: 'profetasIsraelJuda',
  Hageo: 'exilioPersia',
  Zacarías: 'exilioPersia',
  Malaquías: 'exilioPersia',
  Mateo: 'siriaPalestina',
  Marcos: 'romaItalia',
  Lucas: 'desconocidoMediterraneo',
  Juan: 'asiaMenor',
  Hechos: 'siriaPalestina',
  Romanos: 'romaItalia',
  '1 Corintios': 'greciaMacedonia',
  '2 Corintios': 'greciaMacedonia',
  Gálatas: 'asiaMenor',
  Efesios: 'asiaMenor',
  Filipenses: 'greciaMacedonia',
  Colosenses: 'asiaMenor',
  '1 Tesalonicenses': 'greciaMacedonia',
  '2 Tesalonicenses': 'greciaMacedonia',
  '1 Timoteo': 'asiaMenor',
  '2 Timoteo': 'romaItalia',
  Tito: 'creta',
  Filemón: 'asiaMenor',
  Hebreos: 'desconocidoMediterraneo',
  Santiago: 'siriaPalestina',
  '1 Pedro': 'romaItalia',
  '2 Pedro': 'desconocidoMediterraneo',
  '1 Juan': 'asiaMenor',
  '2 Juan': 'asiaMenor',
  '3 Juan': 'asiaMenor',
  Judas: 'desconocidoMediterraneo',
  Apocalipsis: 'asiaMenor'
};

function getBookGeo(history) {
  if (!history?.book) return null;
  const key = bookGeoProfileKeys[history.book];
  const profile = key ? geoProfiles[key] : null;
  return profile ? { book: history.book, ...profile } : null;
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
              {!simpleMode && showFullStudy && result.pastoralPerspectives && (
                <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" href="#perspectivas-pastorales">
                  Perspectivas pastorales
                </a>
              )}
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

            {result.pastoralPerspectives && !simpleMode && showFullStudy && (
              <article className="rounded-lg border border-[#dbe3d8] bg-white p-5" id="perspectivas-pastorales">
                <Pill tone="gold">Perspectivas pastorales</Pill>
                <h3 className="mt-3 text-2xl font-black text-ink">Sproul, MacArthur y Sugel como orientación responsable</h3>
                <p className="mt-3 leading-8 text-muted">{result.pastoralPerspectives.note}</p>

                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  {result.pastoralPerspectives.items.map((item) => (
                    <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-4" key={item.author}>
                      <strong className="block text-lg text-ink">{item.author}</strong>
                      <p className="mt-2 text-sm font-bold leading-6 text-moss-800">{item.emphasis}</p>
                      <p className="mt-3 leading-7 text-muted">{item.body}</p>
                      <a
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#dbe3d8] bg-white px-3 py-2 text-sm font-extrabold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
                        href={item.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Fuente oficial <ExternalLink size={14} />
                      </a>
                    </article>
                  ))}
                </div>

                <div className="mt-5 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-4">
                  <strong className="block text-ink">Criterios de uso</strong>
                  <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
                    {result.pastoralPerspectives.guardrails.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              </article>
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
  const geography = getBookGeo(history);

  return (
    <div className="mt-6 grid gap-4 border-t border-[#dbe3d8] pt-5">
      {geography && <BookGeoMap geography={geography} />}

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

        {history.literary && (
          <article className="rounded-lg border border-[#dbe3d8] bg-white p-4">
            <strong className="block text-moss-800">Contexto literario</strong>
            <p className="mt-2 leading-7 text-muted">{history.literary}</p>
          </article>
        )}

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

function BookGeoMap({ geography }) {
  const { pin } = geography;

  return (
    <article className="overflow-hidden rounded-lg border border-[#dbe3d8] bg-white">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-5">
          <Pill tone="gold">Mapa orientativo</Pill>
          <h3 className="mt-3 text-2xl font-black text-ink">Ubicación histórica de {geography.book}</h3>
          <p className="mt-3 leading-8 text-muted">
            Este mapa no marca fronteras modernas exactas; ubica la región aproximada para leer el libro en su mundo antiguo.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-4">
              <strong className="block text-moss-800">Región antigua</strong>
              <p className="mt-2 leading-7 text-muted">{geography.region}</p>
            </div>
            <div className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-4">
              <strong className="block text-moss-800">Marco político</strong>
              <p className="mt-2 leading-7 text-muted">{geography.ancientFrame}</p>
            </div>
            <div className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-4">
              <strong className="block text-moss-800">País actual aproximado</strong>
              <p className="mt-2 leading-7 text-muted">{geography.currentCountries}</p>
            </div>
          </div>
        </div>

        <div className="relative min-h-72 border-t border-[#dbe3d8] bg-[#eef3e9] lg:border-l lg:border-t-0">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 72" role="img" aria-label={`Mapa orientativo de ${geography.mapLabel}`}>
            <rect width="100" height="72" fill="#eef3e9" />
            <path d="M4 19 C14 14, 20 16, 28 21 C34 25, 40 25, 49 21 C59 16, 70 17, 79 22 C88 27, 92 35, 96 45 L96 72 L4 72 Z" fill="#d9e2d0" />
            <path d="M20 6 C28 3, 38 5, 45 10 C52 15, 62 14, 70 11 C76 8, 86 8, 97 14 L97 28 C85 25, 74 26, 63 30 C51 34, 39 34, 29 30 C20 26, 11 27, 3 32 L3 14 C8 11, 14 8, 20 6 Z" fill="#c7d5c0" />
            <path d="M16 42 C23 39, 31 40, 37 45 C43 50, 50 52, 59 49 C67 46, 77 47, 86 53 L86 72 L16 72 Z" fill="#b6c7ad" />
            <path d="M0 0 H100 V72 H0 Z" fill="none" stroke="#9fb096" strokeWidth="0.5" />
            <circle cx={pin.x} cy={pin.y} r="6.5" fill="#2f7d57" opacity="0.16" />
            <circle cx={pin.x} cy={pin.y} r="2.8" fill="#2f7d57" />
            <path d={`M${pin.x} ${pin.y - 9} C${pin.x - 4} ${pin.y - 9}, ${pin.x - 7} ${pin.y - 6}, ${pin.x - 7} ${pin.y - 2} C${pin.x - 7} ${pin.y + 4}, ${pin.x} ${pin.y + 10}, ${pin.x} ${pin.y + 10} C${pin.x} ${pin.y + 10}, ${pin.x + 7} ${pin.y + 4}, ${pin.x + 7} ${pin.y - 2} C${pin.x + 7} ${pin.y - 6}, ${pin.x + 4} ${pin.y - 9}, ${pin.x} ${pin.y - 9} Z`} fill="#f0c95a" stroke="#173527" strokeWidth="1" />
            <circle cx={pin.x} cy={pin.y - 2} r="2.3" fill="#173527" />
          </svg>
          <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/70 bg-white/90 p-3 shadow-soft">
            <strong className="block text-ink">{geography.mapLabel}</strong>
            <p className="mt-1 text-sm leading-6 text-muted">Referencia visual aproximada para acompañar el marco histórico.</p>
          </div>
        </div>
      </div>
    </article>
  );
}
