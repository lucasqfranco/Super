const express = require('express');
const axios = require('axios');
const parser = require('iptv-playlist-parser');
const cors = require('cors');

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// FUENTES DE CONTENIDO PREMIUM
// ============================================

// 🔥 FUENTE PRINCIPAL: TU LISTA PRIVADA
const PRIVATE_LIST_URL = 'https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u';

// Fuentes de respaldo y expansión
const LIVE_SOURCES = {
    // Tu lista privada (principal - siempre primero)
    privada: PRIVATE_LIST_URL,
    
    // Canales argentinos por categoría (respaldos)
    argentina_noticias: 'https://iptv-org.github.io/iptv/countries/ar/categories/news.m3u',
    argentina_deportes: 'https://iptv-org.github.io/iptv/countries/ar/categories/sports.m3u',
    
    // Deportes internacionales
    f1_live: 'https://raw.githubusercontent.com/bu1766/f1tv/main/f1_live_channels_updated.m3u',
    deportes_global: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    
    // Canales globales por género
    peliculas_global: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
    noticias_global: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    musica_global: 'https://iptv-org.github.io/iptv/categories/music.m3u'
};

// Películas y series (TMDB - fuente confiable)
const MOVIE_SOURCES = {
    trending_series: 'https://aymrgknetzpucldhpkwm.supabase.co/storage/v1/object/public/tmdb/trending-series.m3u',
    top_movies: 'https://aymrgknetzpucldhpkwm.supabase.co/storage/v1/object/public/tmdb/top-movies.m3u',
    accion: 'https://aymrgknetzpucldhpkwm.supabase.co/storage/v1/object/public/tmdb/action-movies.m3u',
    comedia: 'https://aymrgknetzpucldhpkwm.supabase.co/storage/v1/object/public/tmdb/comedy-movies.m3u',
    terror: 'https://aymrgknetzpucldhpkwm.supabase.co/storage/v1/object/public/tmdb/horror-movies.m3u',
    ciencia_ficcion: 'https://aymrgknetzpucldhpkwm.supabase.co/storage/v1/object/public/tmdb/science-fiction-movies.m3u',
    drama: 'https://aymrgknetzpucldhpkwm.supabase.co/storage/v1/object/public/tmdb/drama-movies.m3u',
    animacion: 'https://aymrgknetzpucldhpkwm.supabase.co/storage/v1/object/public/tmdb/animation-movies.m3u',
    romance: 'https://aymrgknetzpucldhpkwm.supabase.co/storage/v1/object/public/tmdb/romance-movies.m3u',
    documental: 'https://aymrgknetzpucldhpkwm.supabase.co/storage/v1/object/public/tmdb/documentary-movies.m3u'
};

let allChannels = [];
let allMovies = [];

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function extractAttributes(raw) {
    const countryMatch = raw.match(/x-country="([^"]+)"/);
    const genreMatch = raw.match(/x-genre="([^"]+)"/);
    const groupMatch = raw.match(/group-title="([^"]+)"/);
    const logoMatch = raw.match(/tvg-logo="([^"]+)"/);
    
    return {
        country: countryMatch ? countryMatch[1] : null,
        genre: genreMatch ? genreMatch[1] : null,
        group: groupMatch ? groupMatch[1] : null,
        logo: logoMatch ? logoMatch[1] : null
    };
}

function detectCategory(name, genreAttr = null, sourceName = '') {
    const lowerName = name.toLowerCase();
    
    // Si viene con género desde la M3U, usarlo primero
    if (genreAttr) {
        if (genreAttr.toLowerCase().includes('deporte')) return '⚽ Deportes';
        if (genreAttr.toLowerCase().includes('f1')) return '🏎️ Fórmula 1';
        if (genreAttr.toLowerCase().includes('noticia')) return '📰 Noticias';
        if (genreAttr.toLowerCase().includes('musica')) return '🎵 Música';
        if (genreAttr.toLowerCase().includes('infantil')) return '🧸 Infantil';
        if (genreAttr.toLowerCase().includes('cine')) return '🎬 Cine/Series';
    }
    
    // Detección automática
    if (lowerName.includes('f1') || lowerName.includes('formula 1')) return '🏎️ Fórmula 1';
    if (lowerName.includes('deporte') || lowerName.includes('sports') || lowerName.includes('espn')) return '⚽ Deportes';
    if (lowerName.includes('noticia') || lowerName.includes('news')) return '📰 Noticias';
    if (lowerName.includes('music') || lowerName.includes('radio')) return '🎵 Música';
    if (lowerName.includes('infantil') || lowerName.includes('kids')) return '🧸 Infantil';
    if (lowerName.includes('pelicula') || lowerName.includes('movie')) return '🎬 Cine/Series';
    
    return '📺 General';
}

function extractQuality(name) {
    const match = name.match(/(\d{3,4}p)/i);
    return match ? match[1] : 'HD';
}

// ============================================
// CARGA DE CANALES EN VIVO
// ============================================
async function loadAllChannels() {
    const channels = [];
    
    // 🔥 PRIMERO: Cargar tu lista privada (prioridad máxima)
    try {
        console.log('📡 Cargando tu lista privada (mi_lista_privada.m3u)...');
        const response = await axios.get(PRIVATE_LIST_URL, { timeout: 15000 });
        const parsed = parser.parse(response.data);
        
        const privateChannels = parsed.items.map((item, idx) => {
            const attrs = extractAttributes(item.raw);
            return {
                id: `privada_${idx}`,
                name: item.name,
                url: item.url,
                country: attrs.country === 'AR' ? 'AR' : 'global',
                countryName: attrs.country === 'AR' ? '🇦🇷 Argentina' : '🌍 Global',
                category: detectCategory(item.name, attrs.genre, 'privada'),
                logo: attrs.logo || item.tvg?.logo || null,
                quality: extractQuality(item.name),
                source: '📡 Tu Lista'
            };
        });
        
        channels.push(...privateChannels);
        console.log(`   ✅ ${privateChannels.length} canales desde tu lista privada`);
    } catch (error) {
        console.log(`   ❌ Error cargando tu lista privada: ${error.message}`);
    }
    
    // LUEGO: Fuentes de respaldo (para más contenido)
    for (const [sourceName, url] of Object.entries(LIVE_SOURCES)) {
        try {
            console.log(`📡 Cargando ${sourceName}...`);
            const response = await axios.get(url, { timeout: 15000 });
            const parsed = parser.parse(response.data);
            
            const sourceChannels = parsed.items.map((item, idx) => {
                const attrs = extractAttributes(item.raw);
                return {
                    id: `${sourceName}_${idx}`,
                    name: item.name,
                    url: item.url,
                    country: attrs.country === 'AR' ? 'AR' : 'global',
                    countryName: attrs.country === 'AR' ? '🇦🇷 Argentina' : '🌍 Global',
                    category: detectCategory(item.name, attrs.genre, sourceName),
                    logo: attrs.logo || item.tvg?.logo || null,
                    quality: extractQuality(item.name),
                    source: sourceName
                };
            });
            
            channels.push(...sourceChannels);
            console.log(`   ✅ ${sourceChannels.length} canales`);
        } catch (error) {
            console.log(`   ❌ Error cargando ${sourceName}: ${error.message}`);
        }
    }
    
    allChannels = channels;
    console.log(`\n📺 TOTAL CANALES: ${allChannels.length}`);
}

// ============================================
// CARGA DE PELÍCULAS Y SERIES
// ============================================
async function loadMovies() {
    const movies = [];
    
    for (const [genre, url] of Object.entries(MOVIE_SOURCES)) {
        try {
            console.log(`🎬 Cargando ${genre}...`);
            const response = await axios.get(url, { timeout: 15000 });
            const parsed = parser.parse(response.data);
            
            const genreNames = {
                trending_series: '📺 Trending Series',
                top_movies: '⭐ Top Movies',
                accion: '💥 Acción',
                comedia: '😄 Comedia',
                terror: '👻 Terror',
                ciencia_ficcion: '🚀 Ciencia Ficción',
                drama: '🎭 Drama',
                animacion: '🎨 Animación',
                romance: '💕 Romance',
                documental: '📹 Documental'
            };
            
            const genreMovies = parsed.items.map((item, idx) => ({
                id: `${genre}_${idx}`,
                name: item.name,
                url: item.url,
                genre: genre,
                genreName: genreNames[genre] || genre,
                poster: item.tvg?.logo || null
            }));
            
            movies.push(...genreMovies);
            console.log(`   ✅ ${genreMovies.length} títulos`);
        } catch (error) {
            console.log(`   ❌ Error cargando ${genre}: ${error.message}`);
        }
    }
    
    allMovies = movies;
    console.log(`\n🎬 TOTAL PELÍCULAS/SERIES: ${allMovies.length}`);
}

// ============================================
// ENDPOINTS DE LA API
// ============================================

app.get('/api/channels', (req, res) => {
    let result = [...allChannels];
    
    if (req.query.country && req.query.country !== 'todos') {
        result = result.filter(c => c.country === req.query.country);
    }
    if (req.query.category && req.query.category !== 'Todos') {
        result = result.filter(c => c.category === req.query.category);
    }
    if (req.query.search) {
        const search = req.query.search.toLowerCase();
        result = result.filter(c => c.name.toLowerCase().includes(search));
    }
    
    res.json(result);
});

app.get('/api/movies', (req, res) => {
    let result = [...allMovies];
    
    if (req.query.genre && req.query.genre !== 'Todos') {
        result = result.filter(m => m.genre === req.query.genre);
    }
    if (req.query.search) {
        const search = req.query.search.toLowerCase();
        result = result.filter(m => m.name.toLowerCase().includes(search));
    }
    
    res.json(result);
});

app.get('/api/countries', (req, res) => {
    res.json([
        { code: 'todos', name: '🌎 Todos los países' },
        { code: 'AR', name: '🇦🇷 Argentina' },
        { code: 'global', name: '🌍 Global' }
    ]);
});

app.get('/api/categories', (req, res) => {
    res.json([
        'Todos', '🏎️ Fórmula 1', '⚽ Deportes', '📰 Noticias',
        '🎵 Música', '🧸 Infantil', '🎬 Cine/Series', '📺 General'
    ]);
});

app.get('/api/movie-genres', (req, res) => {
    res.json([
        { code: 'Todos', name: '🎬 Todos' },
        { code: 'trending_series', name: '📺 Trending Series' },
        { code: 'top_movies', name: '⭐ Top Movies' },
        { code: 'accion', name: '💥 Acción' },
        { code: 'comedia', name: '😄 Comedia' },
        { code: 'terror', name: '👻 Terror' },
        { code: 'ciencia_ficcion', name: '🚀 Ciencia Ficción' },
        { code: 'drama', name: '🎭 Drama' },
        { code: 'animacion', name: '🎨 Animación' },
        { code: 'romance', name: '💕 Romance' },
        { code: 'documental', name: '📹 Documental' }
    ]);
});

app.get('/api/status', (req, res) => {
    res.json({
        channels: allChannels.length,
        movies: allMovies.length,
        lastUpdate: new Date().toISOString(),
        status: 'online'
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;

async function start() {
    console.log('\n🚀 INICIANDO TV GLOBAL PREMIUM...\n');
    await loadAllChannels();
    await loadMovies();
    
    setInterval(loadAllChannels, 6 * 3600000);
    setInterval(loadMovies, 12 * 3600000);
    
    app.listen(PORT, () => {
        console.log(`\n✅ SERVIDOR LISTO en http://localhost:${PORT}`);
        console.log(`\n📺 ENDPOINTS:`);
        console.log(`   GET /api/channels?country=&category=&search=`);
        console.log(`   GET /api/movies?genre=&search=`);
        console.log(`   GET /api/status`);
    });
}

start();
