const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');
const NodeCache = require('node-cache');

const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const cache = new NodeCache({ stdTTL: 7200 });

let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super.elite",
    version: "8.0.0",
    name: "Super TV & Cinema Elite",
    description: "Todo en uno: Argentina, Deportes, Cine, Kids y Docs",
    resources: ["catalog", "stream", "meta"],
    types: ["tv", "movie", "series"],
    idPrefixes: ["sup_", "tt"], 
    catalogs: [
        { type: "tv", id: "cat_arg", name: "🇦🇷 ARGENTINA" },
        { type: "tv", id: "cat_sports", name: "⚽ DEPORTES" },
        { type: "tv", id: "cat_cinema", name: "🍿 CINE & SERIES" },
        { type: "tv", id: "cat_kids", name: "👶 NIÑOS" },
        { type: "tv", id: "cat_docs", name: "🧠 DOCUMENTALES" },
        // Buscador especial (Tipo movie para que aparezca en la lupa general)
        { type: "movie", id: "super_search", name: "🔍 BUSCADOR SUPER", extra: [{ name: "search" }] }
    ]
};

const builder = new addonBuilder(manifest);

async function refreshData() {
    try {
        const res = await axios.get(M3U_URL);
        const parsed = parser.parse(res.data);
        playlistItems = parsed.items.map((item, i) => ({ ...item, internalId: `sup_${i}` }));
        console.log("Sincronización exitosa: " + playlistItems.length);
    } catch (e) { console.error("Error M3U"); }
}

builder.defineCatalogHandler(async ({ id, extra }) => {
    let list = [];

    if (extra && extra.search) {
        const query = extra.search.toLowerCase();
        list = playlistItems.filter(i => i.name.toLowerCase().includes(query));
    } 
    else if (id === "cat_arg") list = playlistItems.filter(i => i.group.title === "ARGENTINA" || i.tvg.country === "AR");
    else if (id === "cat_sports") list = playlistItems.filter(i => i.group.title === "DEPORTES");
    else if (id === "cat_cinema") list = playlistItems.filter(i => i.group.title === "CINE" || i.group.title === "SERIES");
    else if (id === "cat_kids") list = playlistItems.filter(i => i.group.title === "NIÑOS");
    else if (id === "cat_docs") list = playlistItems.filter(i => i.group.title === "DOCS");

    return {
        metas: list.slice(0, 100).map(i => ({
            id: i.internalId,
            type: "tv",
            name: i.name,
            poster: i.tvg.logo || "https://via.placeholder.com/300x450?text=Super"
        }))
    };
});

builder.defineMetaHandler(async ({ type, id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    if (!item) return { meta: {} };
    return {
        meta: {
            id: id,
            type: type,
            name: item.name,
            poster: item.tvg.logo,
            description: "Canal verificado de tu lista privada."
        }
    };
});

builder.defineStreamHandler(async ({ id }) => {
    let item = playlistItems.find(i => i.internalId === id);
    if (!item && id.startsWith("tt")) {
        try {
            const tmdb = await axios.get(`https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=es-ES`);
            const name = tmdb.data.movie_results[0]?.title || tmdb.data.tv_results[0]?.name;
            if (name) item = playlistItems.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
        } catch (e) { }
    }
    return item ? { streams: [{ title: "🚀 Reproducir en Super Elite", url: item.url }] } : { streams: [] };
});

refreshData();
setInterval(refreshData, 3600000);
serveHTTP(builder.getInterface(), { port: process.env.PORT || 10000 });
