const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');

const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super.elite.v19",
    version: "19.0.0",
    name: "Super TV Elite Pro",
    description: "TV & Cine (Solo Español/Inglés) - Filtros Pro",
    resources: ["catalog", "stream", "meta"],
    types: ["tv", "movie"],
    idPrefixes: ["sup_"], 
    catalogs: [
        { 
            type: "tv", id: "cat_all", name: "🌎 TODO EL CONTENIDO",
            extra: [{ name: "genre", options: ["Deportes", "Cine", "Noticias", "Infantil"], isRequired: false }] 
        },
        { 
            type: "tv", id: "cat_arg", name: "🇦🇷 ARGENTINA",
            extra: [{ name: "genre", options: ["Aire", "Noticias", "Deportes", "General"], isRequired: false }] 
        },
        { type: "tv", id: "cat_sports", name: "⚽ DEPORTES" },
        { type: "movie", id: "cat_cinema", name: "🍿 CINE & SERIES" },
        { type: "tv", id: "super_search", name: "🔍 BUSCADOR INTERNO", extra: [{ name: "search" }] }
    ]
};

const builder = new addonBuilder(manifest);
const sportsRescue = ['espn', 'fox sports', 'tyc', 'tnt sports', 'dazn', 'dsports', 'vix', 'f1'];

async function refreshData() {
    try {
        const res = await axios.get(M3U_URL);
        const parsed = parser.parse(res.data);
        playlistItems = parsed.items.map((item, i) => {
            const countryMatch = item.raw.match(/x-country="([^"]+)"/);
            const genreMatch = item.raw.match(/x-genre="([^"]+)"/);
            return { 
                ...item, 
                internalId: `sup_${i}`,
                country: countryMatch ? countryMatch[1] : "OTRO",
                manualGenre: genreMatch ? genreMatch[1] : "General"
            };
        });
        console.log("Sistema v19 Online.");
    } catch (e) { console.error("Error M3U"); }
}

builder.defineCatalogHandler(async ({ id, extra }) => {
    let list = [];
    
    if (id === "cat_all") list = playlistItems;
    else if (id === "cat_arg") list = playlistItems.filter(i => i.country === "AR");
    else if (id === "cat_sports") list = playlistItems.filter(i => i.manualGenre === "Deportes" || sportsRescue.some(k => i.name.toLowerCase().includes(k)));
    else if (id === "cat_cinema") list = playlistItems.filter(i => i.manualGenre === "Cine" || i.group.title === "SERIES");
    else if (extra && extra.search) list = playlistItems.filter(i => i.name.toLowerCase().includes(extra.search.toLowerCase()));

    // Filtrado por la 3ra columna (Género) para cualquier catálogo
    if (extra && extra.genre && extra.genre !== "General") {
        const g = extra.genre.toLowerCase();
        list = list.filter(i => {
            const n = i.name.toLowerCase();
            if (g === "noticias") return i.manualGenre === "Noticias" || n.includes("news");
            if (g === "deportes") return i.manualGenre === "Deportes" || sportsRescue.some(k => n.includes(k));
            if (g === "cine") return i.manualGenre === "Cine";
            if (g === "infantil") return i.manualGenre === "Infantil";
            return i.manualGenre === extra.genre;
        });
    }

    return {
        metas: list.slice(0, 200).map(i => ({
            id: i.internalId,
            type: "tv",
            name: i.name,
            poster: i.tvg.logo || "https://via.placeholder.com/300x450?text=" + i.name
        }))
    };
});

builder.defineMetaHandler(async ({ id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    return { meta: { id, type: "tv", name: item?.name, poster: item?.tvg.logo } };
});

builder.defineStreamHandler(async ({ id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    // Optimizamos la respuesta para carga rápida
    return item ? { streams: [{ title: "🔥 Stream Directo HD", url: item.url }] } : { streams: [] };
});

refreshData();
setInterval(refreshData, 3600000);
serveHTTP(builder.getInterface(), { port: process.env.PORT || 10000 });
