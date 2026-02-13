const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');
const NodeCache = require('node-cache');

// --- CONFIGURACIÓN ---
// URL de tu lista generada por el script de Python
const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
// Lee la API KEY desde las variables de entorno que configuramos en Render
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // Refrescar cada 6 horas

// Cachés para no saturar memoria ni APIs
const playlistCache = new NodeCache({ stdTTL: 21600 }); // 6h
const metaCache = new NodeCache({ stdTTL: 86400 });     // 24h

let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super",
    version: "1.0.0",
    name: "Super IPTV Privado",
    description: "TV en Vivo y Películas de mi lista personal",
    resources: ["catalog", "stream", "meta"],
    types: ["movie", "tv"],
    idPrefixes: ["super_"],
    catalogs: [
        { type: "tv", id: "super_live", name: "📺 TV en Vivo" },
        { type: "movie", id: "super_movies", name: "🍿 Cine Privado" }
    ]
};

const builder = new addonBuilder(manifest);

// --- LÓGICA DE DATOS ---

async function refreshPlaylist() {
    try {
        console.log("Actualizando lista M3U...");
        const response = await axios.get(M3U_URL, { timeout: 10000 });
        const result = parser.parse(response.data);
        
        playlistItems = result.items.map((item, index) => ({
            ...item,
            internalId: `super_${index}`
        }));
        
        console.log(`Lista cargada: ${playlistItems.length} canales.`);
    } catch (err) {
        console.error("Error cargando M3U:", err.message);
    }
}

async function getTMDBData(name) {
    if (!TMDB_API_KEY || TMDB_API_KEY === "") return null;
    
    const cacheKey = `tmdb_${name.toLowerCase()}`;
    if (metaCache.has(cacheKey)) return metaCache.get(cacheKey);

    try {
        const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&language=es-ES`;
        const { data } = await axios.get(url);
        
        if (data.results && data.results.length > 0) {
            const top = data.results[0];
            const meta = {
                poster: top.poster_path ? `https://image.tmdb.org/t/p/w500${top.poster_path}` : null,
                background: top.backdrop_path ? `https://image.tmdb.org/t/p/original${top.backdrop_path}` : null,
                description: top.overview || "Sin descripción disponible."
            };
            metaCache.set(cacheKey, meta);
            return meta;
        }
    } catch (e) {
        return null;
    }
    return null;
}

// --- HANDLERS ---

builder.defineCatalogHandler(async ({ type, id }) => {
    let filtered = [];
    
    // Clasificación basada en el group-title que pusimos en el Python
    if (id === "super_live") {
        filtered = playlistItems.filter(i => !i.group.title.toLowerCase().includes('vod'));
    } else if (id === "super_movies") {
        filtered = playlistItems.filter(i => i.group.title.toLowerCase().includes('vod'));
    }

    const metas = await Promise.all(filtered.map(async (item) => {
        const tmdb = type === 'movie' ? await getTMDBData(item.name) : null;
        return {
            id: item.internalId,
            type: type,
            name: item.name,
            poster: tmdb?.poster || item.tvg.logo || "",
            description: tmdb?.description || `Grupo: ${item.group.title}`,
            background: tmdb?.background || ""
        };
    }));

    return { metas };
});

builder.defineMetaHandler(async ({ type, id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    if (!item) return { meta: {} };

    const tmdb = type === 'movie' ? await getTMDBData(item.name) : null;

    return {
        meta: {
            id: item.internalId,
            type: type,
            name: item.name,
            poster: tmdb?.poster || item.tvg.logo,
            background: tmdb?.background,
            description: tmdb?.description || `Transmitiendo desde: ${item.url}`,
        }
    };
});

builder.defineStreamHandler(({ id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    if (item) {
        return { streams: [{ title: "Reproducir en HD", url: item.url }] };
    }
    return { streams: [] };
});

// Inicialización
refreshPlaylist();
setInterval(refreshPlaylist, REFRESH_INTERVAL);

// Configuración del servidor para Render
serveHTTP(builder.getInterface(), { port: process.env.PORT || 10000 });
