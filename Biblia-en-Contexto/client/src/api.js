import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4000'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bec_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function registerUser(payload) {
  const { data } = await api.post('/api/auth/register', payload);
  return data;
}

export async function loginUser(payload) {
  const { data } = await api.post('/api/auth/login', payload);
  return data;
}

export async function saveNote(payload) {
  const { data } = await api.post('/api/notas', payload);
  return data;
}

export async function getHealth() {
  const { data } = await api.get('/api/salud');
  return data;
}

export async function getEvents() {
  const { data } = await api.get('/api/eventos');
  return data;
}

export async function getGlossary(query = '') {
  const { data } = await api.get('/api/glosario', {
    params: query ? { q: query } : undefined
  });
  return data;
}

export async function getTextSources() {
  const { data } = await api.get('/api/fuentes/textos');
  return data;
}

export async function getLexicons() {
  const { data } = await api.get('/api/fuentes/diccionarios');
  return data;
}

export async function getNotes() {
  const { data } = await api.get('/api/notas');
  return data;
}

export async function searchAll(query) {
  const { data } = await api.get('/api/buscar', {
    params: { q: query }
  });
  return data;
}

export async function consultAuthorizedVersions(payload) {
  const { data } = await api.post('/api/consulta-versiones', payload);
  return data;
}

export async function consultLexiconWord(payload) {
  const { data } = await api.post('/api/lexico-palabra', payload);
  return data;
}

export async function explainPassage(payload) {
  const { data } = await api.post('/api/explicar-pasaje', payload);
  return data;
}

export async function analyzeInput(payload) {
  const { data } = await api.post('/api/analizar', payload);
  return data;
}
