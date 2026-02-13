const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');

const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super.elite.v17", // Nueva versión para forzar refresco
    version: "17.0.0",
    name: "Super TV Elite Pro",
    description: "IPTV Pro: Argentina y Deportes (Filtrado Inteligente)",
    resources: ["catalog", "stream", "meta"],
    types: ["tv", "movie"],
    idPrefixes: ["sup_"], 
    catalogs: [
        { type: "tv", id: "cat_arg", name: "🇦🇷 ARGENTINA", extra: [{ name: "genre", options: ["Aire", "Noticias", "Deportes", "General"], isRequired: false }] },
        { type: "tv", id: "cat_sports", name: "⚽ DEPORTES", extra: [{ name: "genre", options: ["Futbol", "F1", "Tenis", "General"], isRequired: false }] },
        { type: "movie", id: "cat_cinema", name: "🍿 CINE & SERIES" },
        { type: "tv", id: "super_search", name: "🔍 BUSCADOR", extra: [{ name: "search" }] }
    ]
};

const builder = new addonBuilder(manifest);

// Palabras clave para rescate de deportes (Cross-filtering)
const sportsRescue = ['espn', 'fox sports', 'tyc', 'tnt sports', 'dazn', 'dsports', 'vix', 'f1', 'nba'];

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
        console.log("Sistema v17 Online. Sincronización completa.");
    } catch (e) { console.error("Error M3U"); }
}

builder.defineCatalogHandler(async ({ id, extra }) => {
    let list = [];
    
    if (id === "cat_arg") {
        // Mostramos todo lo que sea de Argentina, sin importar el género
        list = playlistItems.filter(i => i.country === "AR");
    } 
    else if (id === "cat_sports") {
        // LÓGICA DE RESCATE: Mostramos lo marcado como Deportes O lo que tenga keywords de deportes en el nombre
        list = playlistItems.filter(i => 
            i.manualGenre === "Deportes" || 
            sportsRescue.some(keyword => i.name.toLowerCase().includes(keyword))
        );
    }
    else if (id === "cat_cinema") {
        list = playlistItems.filter(i => i.manualGenre === "Cine" || i.group.title === "SERIES");
    }
    else if (extra && extra.search) {
        list = playlistItems.filter(i => i.name.toLowerCase().includes(extra.search.toLowerCase()));
    }

    // Aplicar sub-filtro de la 3ra columna (genre)
    if (extra && extra.genre && extra.genre !== "General") {
        const g = extra.genre.toLowerCase();
        list = list.filter(i => {
            const n = i.name.toLowerCase();
            if (g === "noticias") return i.manualGenre === "Noticias";
            if (g === "aire") return i.manualGenre === "Aire";
            if (g === "futbol") return n.includes("tnt sports") || n.includes("espn") || n.includes("futbol") || n.includes("tyc");
            if (g === "f1") return n.includes("f1") || n.includes("dazn f1") || n.includes("formula 1");
            return i.manualGenre === extra.genre;
        });
    }

    return {
        metas: list.slice(0, 150).map(i => ({
            id: i.internalId,
            type: "tv",
            name: i.name,
            poster: i.tvg.logo || "https://via.placeholder.com/300x450?text=" + i.name
        }))
    };
});

// Meta y Stream permanecen iguales
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
