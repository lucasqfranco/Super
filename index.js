const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');
const NodeCache = require('node-cache');

// --- CONFIGURACIÓN ---
const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const cache = new NodeCache({ stdTTL: 7200 }); 

let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super.v3",
    version: "3.1.0",
    name: "Super IPTV Ultimate",
    description: "Premium: Deportes, Cine, Docs y Kids (Argentina Focus)",
    resources: ["catalog", "stream", "meta"],
    types: ["tv", "movie"],
    idPrefixes: ["sup_"],
    catalogs: [
        { type: "tv", id: "cat_sports", name: "⚽ DEPORTES" },
        { type: "tv", id: "cat_arg", name: "🇦🇷 ARGENTINA VIVO" },
        { type: "movie", id: "cat_movies", name: "🍿 CINE PREMIUM" },
        { type: "tv", id: "cat_docs", name: "🧠 DOCUMENTALES" },
        { type: "tv", id: "cat_kids", name: "👶 NIÑOS" }
    ]
};

const builder = new addonBuilder(manifest);

// --- LÓGICA DE DATOS ---

async function refreshData() {
    try {
        const res = await axios.get(M3U_URL, { timeout: 15000 });
        const parsed = parser.parse(res.data);
        playlistItems = parsed.items.map((item, i) => ({ 
            ...item, 
            internalId: `sup_${i}` 
        }));
        console.log("Sincronización exitosa: " + playlistItems.length + " canales.");
    } catch (e) { 
        console.error("Error al refrescar M3U"); 
    }
}

async function getTMDBMeta(name) {
    if (!TMDB_API_KEY) return null;
    const cKey = `meta_${name}`;
    if (cache.has(cKey)) return cache.get(cKey);
    try {
        const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&language=es-ES`;
        const { data } = await axios.get(url);
        if (data.results && data.results[0]) {
            const result = data.results[0];
            const meta = {
                poster: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
                background: result.backdrop_path ? `https://image.tmdb.org/t/p/original${result.backdrop_path}` : null,
                description: result.overview
            };
            cache.set(cKey, meta);
            return meta;
        }
    } catch (e) { return null; }
    return null;
}

// --- HANDLERS ---

builder.defineCatalogHandler(async ({ type, id }) => {
    let list = [];
    if (id === "cat_sports") list = playlistItems.filter(i => i.group.title === "DEPORTES");
    else if (id === "cat_arg") list = playlistItems.filter(i => i.tvg.country === "AR" || i.name.toLowerCase().includes("argentina"));
    else if (id === "cat_movies") list = playlistItems.filter(i => i.group.title === "CINE");
    else if (id === "cat_docs") list = playlistItems.filter(i => i.group.title === "DOCS");
    else if (id === "cat_kids") list = playlistItems.filter(i => i.group.title === "NIÑOS");

    const metas = await Promise.all(list.slice(0, 150).map(async (item) => {
        // Enriquecemos con TMDB solo la sección de Cine para ahorrar recursos
        const tmdb = (id === "cat_movies") ? await getTMDBMeta(item.name) : null;
        return {
            id: item.internalId,
            type: "tv", // Stremio maneja mejor canales IPTV como tipo 'tv'
            name: item.name,
            poster: tmdb?.poster || item.tvg.logo || "https://via.placeholder.com/300x450?text=IPTV",
            description: tmdb?.description || `Grupo: ${item.group.title} | Link Directo`
        };
    }));
    return { metas };
});

builder.defineMetaHandler(async ({ type, id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    if (!item) return { meta: {} };

    const tmdb = await getTMDBMeta(item.name);
    return {
        meta: {
            id: item.internalId,
            type: type,
            name: item.name,
            poster: tmdb?.poster || item.tvg.logo,
            background: tmdb?.background,
            description: tmdb?.description || `Reproduciendo canal de TV en vivo.`
        }
    };
});

builder.defineStreamHandler(({ id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    return item ? { streams: [{ title: "🔥 Stream HD", url: item.url }] } : { streams: [] };
});

// Inicialización
refreshData();
setInterval(refreshData, 3600000); 

serveHTTP(builder.getInterface(), { port: process.env.PORT || 10000 });
