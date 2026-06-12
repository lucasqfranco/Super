const express = require('express');
const axios = require('axios');
const parser = require('iptv-playlist-parser');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));

// ============================================
// FUENTES DE CANALES ARGENTINOS (PRIORIDAD)
// ============================================

// 🔥 FUENTES ARGENTINAS CONFIRMADAS
const ARGENTINA_SOURCES = [
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ar.m3u',  // 110+ canales
    'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/ar.m3u',  // 70+ canales
    'https://m3u.cl/lista-iptv-argentina.php',  // 140+ canales
    'https://iptv-org.github.io/iptv/countries/ar.m3u'  // Respaldo
];

// Fuentes internacionales (respaldo)
const GLOBAL_SOURCES = {
    deportes: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    noticias: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    musica: 'https://iptv-org.github.io/iptv/categories/music.m3u',
    cine: 'https://iptv-org.github.io/iptv/categories/movies.m3u'
};

let allChannels = [];
let allMovies = [];

// ============================================
// DETECCIÓN DE CATEGORÍAS
// ============================================
function detectCategory(name) {
    const n = name.toLowerCase();
    if (n.includes('f1') || n.includes('formula 1')) return '🏎️ F1';
    if (n.includes('deporte') || n.includes('sports') || n.includes('futbol')) return '⚽ Deportes';
    if (n.includes('noticia') || n.includes('news')) return '📰 Noticias';
    if (n.includes('music')) return '🎵 Música';
    if (n.includes('infantil') || n.includes('kids')) return '🧸 Infantil';
    if (n.includes('pelicula') || n.includes('movie')) return '🎬 Cine';
    return '📺 General';
}

// ============================================
// CARGA DE CANALES ARGENTINOS
// ============================================
async function loadArgentinaChannels() {
    const channels = [];
    
    for (const url of ARGENTINA_SOURCES) {
        try {
            console.log(`📡 Cargando fuente argentina: ${url.substring(0, 60)}...`);
            const response = await axios.get(url, { timeout: 15000 });
            const parsed = parser.parse(response.data);
            
            const sourceChannels = parsed.items.map((item, idx) => {
                // Extraer país de los atributos
                const countryMatch = item.raw.match(/x-country="([^"]+)"/);
                const isArgentina = countryMatch ? countryMatch[1] === 'AR' : item.name.toLowerCase().includes('argentina');
                
                return {
                    id: `ar_${idx}_${Date.now()}`,
                    name: item.name,
                    url: item.url,
                    country: 'AR',
                    countryName: '🇦🇷 Argentina',
                    category: detectCategory(item.name),
                    logo: item.tvg?.logo || null,
                    quality: item.name.match(/(\d{3,4}p)/i)?.[1] || 'HD'
                };
            }).filter(ch => ch.url && ch.url.startsWith('http')); // Solo URLs válidas
            
            channels.push(...sourceChannels);
            console.log(`   ✅ ${sourceChannels.length} canales argentinos`);
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }
    
    // Eliminar duplicados por nombre
    const uniqueChannels = [];
    const names = new Set();
    for (const ch of channels) {
        if (!names.has(ch.name) && ch.url) {
            names.add(ch.name);
            uniqueChannels.push(ch);
        }
    }
    
    allChannels = uniqueChannels;
    console.log(`\n📺 TOTAL CANALES ARGENTINOS ÚNICOS: ${allChannels.length}`);
}

// ============================================
// CARGA DE PELÍCULAS (OPCIONAL)
// ============================================
async function loadMovies() {
    // Por ahora, películas desactivadas hasta encontrar fuente confiable
    allMovies = [];
    console.log(`🎬 Películas: Temporalmente desactivadas`);
}

// ============================================
// ENDPOINTS
// ============================================
app.get('/api/channels', (req, res) => {
    let result = [...allChannels];
    
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
    res.json([]);
});

app.get('/api/countries', (req, res) => {
    res.json([
        { code: 'AR', name: '🇦🇷 Argentina' }
    ]);
});

app.get('/api/categories', (req, res) => {
    res.json(['Todos', '🏎️ F1', '⚽ Deportes', '📰 Noticias', '🎵 Música', '🧸 Infantil', '🎬 Cine', '📺 General']);
});

app.get('/api/status', (req, res) => {
    res.json({
        channels: allChannels.length,
        movies: allMovies.length,
        lastUpdate: new Date().toISOString()
    });
});

// ============================================
// INICIAR
// ============================================
const PORT = process.env.PORT || 3000;

async function start() {
    console.log('\n🚀 INICIANDO TV ARGENTINA PREMIUM...\n');
    await loadArgentinaChannels();
    await loadMovies();
    
    setInterval(loadArgentinaChannels, 6 * 3600000);
    
    app.listen(PORT, () => {
        console.log(`\n✅ SERVIDOR LISTO en http://localhost:${PORT}`);
        console.log(`\n📺 ENDPOINTS:`);
        console.log(`   GET /api/channels?category=&search=`);
        console.log(`   GET /api/status`);
    });
}

start();
