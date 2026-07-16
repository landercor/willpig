import { supabaseAdmin as db } from '../config/db.js';

const storySelect = '*, cuenta_usuario(id_cuenta_usuario, username, avatar_url), categorias(nombre)';
function publicQuery() { return db.from('cuentos').select(storySelect).is('deleted_at', null).eq('estado', 'publicado').eq('visibilidad', 'publica'); }

export async function verBiblioteca(req, res) {
  const { data, error } = await publicQuery().order('created_at', { ascending: false });
  res.render('biblioteca',
    {
      tituloPagina: 'Biblioteca | Willpig Studio',
      historias: error ? [] : data || [],
      loggerUser: req.session?.user || null
    });
}
export async function verPrincipal(req, res) {
  const { data: historias } = await publicQuery().order('created_at', { ascending: false }).limit(40);
  const { data: tendencias } = await publicQuery().order('vistas', { ascending: false }).limit(10);
  const historiasPorCategoria = {};

  for (const h of historias || []) {
    const name = h.categorias?.nombre || 'General';

    if (!historiasPorCategoria[name]) historiasPorCategoria[name] = [];
    historiasPorCategoria[name].push(h);
  }
  const carrusel = (historias || []).filter(h => h.portada_url).slice(0, 5).map(h => ({ titulo: h.titulo, imagen: h.portada_url, link: '/historias/' + h.id_cuento }));
  res.render('principal', { tituloPagina: 'Inicio | Willpig Studio', historias: (historias || []).slice(0, 10), tendencias: tendencias || [], historiasPorCategoria, carrusel, historiaDestacada: (tendencias || [])[0] || null, loggerUser: req.session?.user || null });
}
export async function verBusqueda(req, res) {
  const q = (req.query.q || '').trim();
  const [{ data: resultados }, { data: usuarios }] = await Promise.all([
    q ? publicQuery().ilike('titulo', '%' + q + '%').order('created_at',
      { ascending: false }) : Promise.resolve({ data: [] }),
    q ? db.from('cuenta_usuario').select('id_cuenta_usuario, username, avatar_url, biografia').ilike('username',
      '%' + q + '%').limit(12) : Promise.resolve({ data: [] }),
  ]);
  res.render('busqueda', { tituloPagina: 'Busqueda | Willpig Studio', resultados: resultados || [], usuarios: usuarios || [], query: q, loggerUser: req.session?.user || null });
}
export async function verSugerencias(req, res) {
  const q = String(req.query.q || '').trim();
  if (q.length < 2)
    return res.json({ sugerencias: [] });

  const [{ data: historias }, { data: usuarios }] = await Promise.all([
    publicQuery().select('id_cuento, titulo').ilike('titulo', `%${q}%`).order('created_at', { ascending: false }).limit(6),
    db.from('cuenta_usuario').select('id_cuenta_usuario, username').ilike('username',
      `%${q}%`).limit(4),
  ]);
  const sugerencias = [
    ...(historias || []).map(h => ({ tipo: 'historia', texto: h.titulo, url: `/historias/${h.id_cuento}` })),
    ...(usuarios || []).map(u => ({
      tipo: 'autor',
      texto: `@${u.username}`,
      url: `/usuario/profile/${u.id_cuenta_usuario}`
    })),
  ];
  res.json({ sugerencias });
}
export async function verCategoria(req, res) {
  const normalize = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const { data: cats } = await db.from('categorias').select('id_categoria, nombre');
  const matches = (cats || []).filter(c => normalize(c.nombre) === normalize(req.params.nombre));

  if (!matches.length) return res.status(404).render('404', { message: 'Categoria no encontrada.', loggerUser: req.session?.user || null });

  const { data: historias } = await publicQuery().in('categoria_id', matches.map(c => c.id_categoria)).order('created_at', { ascending: false });
  res.render('categoria', {
    tituloPagina: matches[0].nombre + ' | Willpig Studio',
    categoriaNombre: matches[0].nombre,
    historias: historias || [],
    loggerUser: req.session?.user || null
  });
}