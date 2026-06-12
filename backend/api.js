const express = require('express');
const axios = require('axios');
const parser = require('iptv-playlist-parser');
const cors = require('cors');

const app = express();
app.use(cors());

// ============================================
// ÚNICA FUENTE CONFIRMADA QUE FUNCIONA
// ============================================
const CHANNELS_URL = 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ar.m3u';

let allChannels = [];

// ============================================
// DETECTAR CATEGORÍA
// ============================================
function getCategory(name) {
    const n = name.toLowerCase();
    if (n.includes('f1') || n.includes('formula')) return '🏎️ Fórmula 1';
    if (n.includes('deporte') || n.includes('sports') || n.includes('futbol') || n.includes('tyc')) return '⚽ Deportes';
    if (n.includes('noticia') || n.includes('news') || n.includes('a24') || n.includes('tn')) return '📰 Noticias';
    if (n.includes('musica') || n.includes('music')) return '🎵 Música';
    if (n.includes('infantil') || n.includes('kids')) return '🧸 Infantil';
    if (n.includes('pelicula') || n.includes('movie')) return '🎬 Cine';
    return '📺 General';
}

// ============================================
// CARGAR CANALES
// ============================================
async function loadChannels() {
    try {
        console.log('📡 Cargando canales argentinos...');
        const response = await axios.get(CHANNELS_URL, { timeout: 20000 });
        const parsed = parser.parse(response.data);
        
        const channels = parsed.items.map((item, idx) => ({
            id: idx,
            name: item.name,
            url: item.url,
            category: getCategory(item.name),
            quality: item.name.match(/(\d{3,4}p)/i)?.[1] || 'HD'
        })).filter(ch => ch.url && ch.url.startsWith('http'));
        
        allChannels = channels;
        console.log(`✅ Cargados ${allChannels.length} canales argentinos`);
        console.log(`📺 Ejemplo: ${allChannels.slice(0, 3).map(c => c.name).join(', ')}`);
    } catch (error) {
        console.error('❌ Error:', error.message);
        allChannels = [];
    }
}

// ============================================
// ENDPOINTS
// ============================================
app.get('/api/channels', (req, res) => {
    let result = [...allChannels];
    const { category, search } = req.query;
    
    if (category && category !== 'Todos') {
        result = result.filter(ch => ch.category === category);
    }
    if (search) {
        const term = search.toLowerCase();
        result = result.filter(ch => ch.name.toLowerCase().includes(term));
    }
    
    res.json(result);
});

app.get('/api/categories', (req, res) => {
    const cats = ['Todos', ...new Set(allChannels.map(ch => ch.category))];
    res.json(cats);
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        channels: allChannels.length,
        lastUpdate: new Date().toISOString()
    });
});

// ============================================
// INICIAR
// ============================================
const PORT = process.env.PORT || 3000;

async function start() {
    await loadChannels();
    setInterval(loadChannels, 6 * 3600000); // Cada 6 horas
    
    app.listen(PORT, () => {
        console.log(`\n🚀 API corriendo en http://localhost:${PORT}`);
        console.log(`📺 Endpoint: /api/channels`);
    });
}

start();
