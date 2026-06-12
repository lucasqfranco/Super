const express = require('express');
const axios = require('axios');
const parser = require('iptv-playlist-parser');
const cors = require('cors');

const app = express();
app.use(cors());

// ==============================================
// 🔥 FUENTES DE CONTENIDO: ESTRATEGIA DEFINITIVA
// ==============================================

// Fuente 1: El gigante de canales argentinos (IPTV-org) - se actualiza solo
const MAIN_ARGENTINA_SOURCE = 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ar.m3u';

// Fuente 2: Tu lista privada (para canales específicos)
const PRIVATE_LIST_URL = 'https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u';

// Fuente 3: Películas/Series (las dejamos comentadas hasta que encuentres una estable)
// const MOVIES_SOURCE = '...';

let allChannels = [];

// ==============================================
// 🧠 FUNCIÓN INTELIGENTE PARA DETECTAR CATEGORÍAS
// ==============================================
function detectCategory(channelName) {
    const name = channelName.toLowerCase();
    if (name.includes('f1') || name.includes('formula 1')) return '🏎️ Fórmula 1';
    if (name.includes('futbol') || name.includes('soccer') || name.includes('deporte')) return '⚽ Fútbol/Deportes';
    if (name.includes('tyc sports')) return '⚽ Deportes (TyC)';
    if (name.includes('noticia') || name.includes('news') || name.includes('a24') || name.includes('tn')) return '📰 Noticias 24/7';
    if (name.includes('pelicula') || name.includes('movie')) return '🎬 Cine y Series';
    if (name.includes('infantil') || name.includes('kids')) return '🧸 Infantil';
    if (name.includes('music') || name.includes('radio')) return '🎵 Música y Radio';
    return '📺 General';
}

// ==============================================
// 📡 CARGA MAESTRA DE CANALES (Fusión)
// ==============================================
async function loadMasterChannels() {
    const allLoadedChannels = [];
    console.log('\n🔄 INICIANDO CARGA MAESTRA DE CANALES...\n');

    // --- 1. Cargar canales masivos de Argentina (IPTV-org) ---
    try {
        console.log(`📡 Cargando fuente PRINCIPAL (IPTV-org Argentina)...`);
        const response = await axios.get(MAIN_ARGENTINA_SOURCE, { timeout: 15000 });
        const parsed = parser.parse(response.data);
        
        const mainChannels = parsed.items.map((item, idx) => ({
            id: `main_ar_${idx}`,
            name: item.name,
            url: item.url,
            country: 'Argentina',
            countryCode: 'AR',
            category: detectCategory(item.name),
            logo: item.tvg?.logo || null,
            quality: item.name.match(/(\d{3,4}p)/i)?.[1] || 'HD',
            source: 'IPTV-org (Masa Crítica)'
        })).filter(ch => ch.url && ch.url.startsWith('http')); // Filtra enlaces inválidos
        
        allLoadedChannels.push(...mainChannels);
        console.log(`   ✅ Cargados ${mainChannels.length} canales desde la fuente principal.`);
    } catch (error) {
        console.log(`   ❌ Error crítico con la fuente principal: ${error.message}`);
    }

    // --- 2. Cargar canales extra desde TU LISTA PRIVADA ---
    try {
        console.log(`\n📡 Cargando fuente SECUNDARIA (Tu lista privada)...`);
        const privateResponse = await axios.get(PRIVATE_LIST_URL, { timeout: 10000 });
        const privateParsed = parser.parse(privateResponse.data);
        
        const privateChannels = privateParsed.items.map((item, idx) => ({
            id: `private_${idx}`,
            name: item.name,
            url: item.url,
            country: item.raw.includes('x-country="AR"') ? 'Argentina' : 'Internacional',
            countryCode: item.raw.includes('x-country="AR"') ? 'AR' : 'INT',
            category: detectCategory(item.name),
            logo: item.tvg?.logo || null,
            quality: 'HD',
            source: 'Tu Lista Privada (Especial)'
        })).filter(ch => ch.url && ch.url.startsWith('http'));
        
        allLoadedChannels.push(...privateChannels);
        console.log(`   ✅ Cargados ${privateChannels.length} canales desde tu lista privada.`);
    } catch (error) {
        console.log(`   ❌ Error al cargar tu lista privada: ${error.message}`);
    }

    // --- 3. Limpieza final: Eliminar duplicados por nombre de canal ---
    const uniqueChannels = [];
    const channelNames = new Set();
    for (const channel of allLoadedChannels) {
        if (!channelNames.has(channel.name)) {
            channelNames.add(channel.name);
            uniqueChannels.push(channel);
        }
    }

    allChannels = uniqueChannels;
    console.log(`\n🎉 CARGA COMPLETADA: ${allChannels.length} canales únicos disponibles.\n`);
}

// ==============================================
// 🌐 ENDPOINTS DE TU API
// ==============================================
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
    // Extrae categorías únicas de los canales cargados
    const cats = new Set(allChannels.map(ch => ch.category));
    res.json(['Todos', ...Array.from(cats).sort()]);
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        channels: allChannels.length,
        lastUpdate: new Date().toISOString(),
        message: '🇦🇷 Modo Argentina: Canales masivos + tu lista privada'
    });
});

// ==============================================
// 🚀 INICIO DEL SERVIDOR
// ==============================================
const PORT = process.env.PORT || 3000;

async function startServer() {
    await loadMasterChannels();
    // Recarga automática cada 4 horas para estar al día
    setInterval(loadMasterChannels, 4 * 60 * 60 * 1000);
    
    app.listen(PORT, () => {
        console.log(`\n✅ SERVIDOR CORRIENDO EN http://localhost:${PORT}`);
        console.log('========================================');
        console.log('🇦🇷 TV ARGENTINA PREMIUM - ESTRATEGIA HÍBRIDA');
        console.log('✅ Fuente principal: IPTV-org (Masa crítica, +150 canales)');
        console.log('✅ Fuente secundaria: Tu lista privada (Canales específicos)');
        console.log('========================================\n');
    });
}

startServer();
