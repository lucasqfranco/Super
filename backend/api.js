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
// FUENTES DE CANALES POR PAÍS
// ============================================
const SOURCES = {
    argentina: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ar.m3u',
    mexico: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/mx.m3u',
    espana: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/es.m3u',
    usa: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u',
    global: 'https://iptv-org.github.io/iptv/index.m3u'
};

// Fuente de películas
const MOVIES_URL = 'http://tv.m3uts.xyz/get.php?username=m&password=m&type=m3u_plus&output=ts';

let allChannels = [];
let allMovies = [];

const countryNames = {
    argentina: '🇦🇷 Argentina',
    mexico: '🇲🇽 México',
    espana: '🇪🇸 España',
    usa: '🇺🇸 Estados Unidos',
    global: '🌍 Global'
};

async function loadAllChannels() {
    const channels = [];
    
    for (const [countryCode, url] of Object.entries(SOURCES)) {
        try {
            console.log(`Cargando ${countryCode}...`);
            const response = await axios.get(url, { timeout: 10000 });
            const parsed = parser.parse(response.data);
            
            const countryChannels = parsed.items.map((item, idx) => ({
                id: `${countryCode}_${idx}`,
                name: item.name,
                url: item.url,
                country: countryCode,
                countryName: countryNames[countryCode],
                category: detectCategory(item.name),
                logo: item.tvg?.logo || null,
                quality: extractQuality(item.name)
            }));
            
            channels.push(...countryChannels);
            console.log(`   ✅ ${countryChannels.length} canales`);
        } catch (error) {
            console.log(`   ❌ Error cargando ${countryCode}: ${error.message}`);
        }
    }
    
    allChannels = channels;
    console.log(`\n📺 TOTAL: ${allChannels.length} canales cargados`);
}

async function loadMovies() {
    try {
        console.log(`\n🎬 Cargando películas...`);
        const response = await axios.get(MOVIES_URL, { timeout: 15000 });
        const parsed = parser.parse(response.data);
        
        allMovies = parsed.items
            .filter(item => 
                item.group?.title?.toLowerCase().includes('pelicula') ||
                item.group?.title?.toLowerCase().includes('movie')
            )
            .map((item, idx) => ({
                id: `movie_${idx}`,
                name: item.name,
                url: item.url,
                poster: item.tvg?.logo || null,
                year: extractYear(item.name)
            }));
        
        console.log(`   ✅ ${allMovies.length} películas cargadas`);
    } catch (error) {
        console.log(`   ❌ Error cargando películas: ${error.message}`);
        allMovies = [];
    }
}

function detectCategory(name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('deporte') || lowerName.includes('sports') || lowerName.includes('tyc')) return '⚽ Deportes';
    if (lowerName.includes('noticia') || lowerName.includes('news') || lowerName.includes('a24')) return '📰 Noticias';
    if (lowerName.includes('music') || lowerName.includes('pop') || lowerName.includes('radio')) return '🎵 Música';
    if (lowerName.includes('infantil') || lowerName.includes('kids') || lowerName.includes('disney')) return '🧸 Infantil';
    return '📺 General';
}

function extractQuality(name) {
    const match = name.match(/(\d{3,4}p)/i);
    return match ? match[1] : 'SD';
}

function extractYear(name) {
    const match = name.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
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
    if (req.query.search) {
        const search = req.query.search.toLowerCase();
        result = result.filter(m => m.name.toLowerCase().includes(search));
    }
    res.json(result);
});

app.get('/api/countries', (req, res) => {
    const countries = [
        { code: 'todos', name: '🌎 Todos los países' },
        ...Object.entries(countryNames).map(([code, name]) => ({ code, name }))
    ];
    res.json(countries);
});

app.get('/api/categories', (req, res) => {
    res.json(['Todos', '⚽ Deportes', '📰 Noticias', '🎵 Música', '🧸 Infantil', '📺 General']);
});

app.get('/api/status', (req, res) => {
    res.json({
        channels: allChannels.length,
        movies: allMovies.length,
        lastUpdate: new Date().toISOString()
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;

async function start() {
    await loadAllChannels();
    await loadMovies();
    setInterval(loadAllChannels, 6 * 3600000);
    setInterval(loadMovies, 12 * 3600000);
    
    app.listen(PORT, () => {
        console.log(`\n🚀 API corriendo en http://localhost:${PORT}`);
        console.log(`📺 Endpoints disponibles:`);
        console.log(`   GET /api/channels?country=&category=&search=`);
        console.log(`   GET /api/movies?search=`);
        console.log(`   GET /api/countries`);
        console.log(`   GET /api/categories`);
        console.log(`   GET /api/status`);
    });
}

start();