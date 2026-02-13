const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');

const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super.elite.universal",
    version: "12.0.0", // Subimos versión para forzar refresco
    name: "Super TV Elite Pro",
    description: "IPTV con Triple Columna Universal",
    resources: ["catalog", "stream", "meta"],
    types: ["tv", "movie"],
    idPrefixes: ["sup_"], 
    catalogs: [
        { 
            type: "tv", id: "cat_arg", name: "🇦🇷 ARGENTINA",
            extra: [{ name: "genre", options: ["Aire", "Noticias", "Deportes", "General"], isRequired: false }] 
        },
        { 
            type: "tv", id: "cat_sports", name: "⚽ DEPORTES",
            extra: [{ name: "genre", options: ["Futbol", "F1", "General"], isRequired: false }] 
        },
        { 
            type: "movie", id: "cat_cinema", name: "🍿 CINE & SERIES",
            extra: [{ name: "genre", options: ["Accion", "Terror", "General"], isRequired: false }] 
        },
        { type: "tv", id: "super_search", name: "🔍 BUSCADOR", extra: [{ name: "search" }] }
    ]
};

const builder = new addonBuilder(manifest);

async function refreshData() {
    try {
        const res = await axios.get(M3U_URL);
        const parsed = parser.parse(res.data);
        playlistItems = parsed.items.map((item, i) => {
            const genreMatch = item.raw.match(/x-genre="([^"]+)"/);
            return { 
                ...item, 
                internalId: `sup_${i}`,
                genre: genreMatch ? genreMatch[1] : "General"
            };
        });
        console.log("Sistema v12 Universal cargado.");
    } catch (e) { console.error("Error M3U"); }
}

builder.defineCatalogHandler(async ({ id, extra }) => {
    let list = [];
    
    // 1. Filtro primario (2da Columna)
    if (id === "cat_arg") list = playlistItems.filter(i => i.group.title === "ARGENTINA");
    else if (id === "cat_sports") list = playlistItems.filter(i => i.group.title === "DEPORTES");
    else if (id === "cat_cinema") list = playlistItems.filter(i => i.group.title === "CINE" || i.group.title === "SERIES");
    else if (extra && extra.search) {
        list = playlistItems.filter(i => i.name.toLowerCase().includes(extra.search.toLowerCase()));
    }

    // 2. Filtro secundario (3ra Columna)
    if (extra && extra.genre && extra.genre !== "General") {
        list = list.filter(i => i.genre === extra.genre);
    }

    return {
        metas: list.slice(0, 100).map(i => ({
            id: i.internalId,
            type: "tv",
            name: i.name,
            poster: i.tvg.logo || "https://via.placeholder.com/300x450?text=Super"
        }))
    };
});

// Los demás handlers no cambian
builder.defineMetaHandler(async ({ id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    return { meta: { id, type: "tv", name: item?.name, poster: item?.tvg.logo } };
});

builder.defineStreamHandler(async ({ id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    return item ? { streams: [{ title: "🔥 Stream Directo", url: item.url }] } : { streams: [] };
});

refreshData();
setInterval(refreshData, 3600000);
serveHTTP(builder.getInterface(), { port: process.env.PORT || 10000 });
