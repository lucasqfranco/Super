const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');
const NodeCache = require('node-cache');

// --- CONFIGURACIÓN ---
const M3U_URL = "TU_URL_RAW_DE_GITHUB_AQUI";
const TMDB_API_KEY = "TU_API_KEY_DE_TMDB_AQUI";
const REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 horas

// Caché para metadatos (evita peticiones excesivas a TMDB)
const metaCache = new NodeCache({ stdTTL: 86400 }); // 24h
let playlistItems = [];

const manifest = {
    id: "org.private.m3uaddon",
    version: "1.0.0",
    name: "Mi Addon Privado",
    description: "TV en Vivo, Películas y Series Privadas",
    resources: ["catalog", "stream", "meta"],
    types: ["movie", "series", "tv"],
    idPrefixes: ["iptv_"],
    catalogs: [
        { type: "tv", id: "live_tv", name: "TV en Vivo" },
        { type: "movie", id: "private_movies", name: "Películas Privadas" },
        { type: "series", id: "private_series", name: "Series Privadas" }
    ]
};

const builder = new addonBuilder(manifest);

// --- LÓGICA DE DATOS ---

// Descarga y procesa la lista M3U
async function refreshPlaylist() {
    try {
        const response = await axios.get(M3U_URL);
        const result = parser.parse(response.data);
        playlistItems = result.items.map((item, index) => ({
            ...item,
            internalId: `iptv_${index}`
        }));
        console.log(`[Cache] Lista actualizada: ${playlistItems.length} items.`);
    } catch (err) {
        console.error("Error cargando M3U:", err.message);
    }
}

// Función para buscar en TMDB
async function getTMDBData(name, type) {
    const cacheKey = `${type}_${name}`;
    if (metaCache.has(cacheKey)) return metaCache.get(cacheKey);

    try {
        const searchType = type === 'series' ? 'tv' : 'movie';
        const url = `https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&language=es-ES`;
        const { data } = await axios.get(url);
        
        if (data.results && data.results.length > 0) {
            const top = data.results[0];
            const meta = {
                poster: `https://image.tmdb.org/t/p/w500${top.poster_path}`,
                background: `https://image.tmdb.org/t/p/original${top.backdrop_path}`,
                description: top.overview,
                name: top.title || top.name
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
    
    // Filtramos la lista según el catálogo
    if (id === "live_tv") filtered = playlistItems.filter(i => !i.group.title.toLowerCase().includes('pelicula') && !i.group.title.toLowerCase().includes('serie'));
    if (id === "private_movies") filtered = playlistItems.filter(i => i.group.title.toLowerCase().includes('pelicula'));
    if (id === "private_series") filtered = playlistItems.filter(i => i.group.title.toLowerCase().includes('serie'));

    const metas = await Promise.all(filtered.map(async (item) => {
        const tmdb = (type === 'movie' || type === 'series') ? await getTMDBData(item.name, type) : null;
        return {
            id: item.internalId,
            type: type,
            name: tmdb?.name || item.name,
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

    const tmdb = (type === 'movie' || type === 'series') ? await getTMDBData(item.name, type) : null;

    return {
        meta: {
            id: item.internalId,
            type: type,
            name: tmdb?.name || item.name,
            poster: tmdb?.poster || item.tvg.logo,
            background: tmdb?.background,
            description: tmdb?.description || `Streaming desde lista privada.`,
        }
    };
});

builder.defineStreamHandler(({ id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    if (item) {
        return { streams: [{ title: "Reproducir ahora", url: item.url }] };
    }
    return { streams: [] };
});

// Inicialización
refreshPlaylist();
setInterval(refreshPlaylist, REFRESH_INTERVAL);

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });