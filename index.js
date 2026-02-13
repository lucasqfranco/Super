const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');
const NodeCache = require('node-cache');

const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const cache = new NodeCache({ stdTTL: 7200 });

let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super.hybrid",
    version: "6.0.0",
    name: "Super TV & Cinema",
    description: "TV en Vivo, Películas Latino y Series",
    resources: ["catalog", "stream", "meta", "search"],
    types: ["movie", "series", "tv"],
    idPrefixes: ["sup_", "tt"], // 'tt' permite interceptar películas oficiales
    catalogs: [
        { type: "tv", id: "cat_sports", name: "⚽ DEPORTES" },
        { type: "movie", id: "cat_movies", name: "🍿 PELÍCULAS" },
        { type: "series", id: "cat_series", name: "📺 SERIES" },
        { type: "tv", id: "cat_arg", name: "🇦🇷 ARGENTINA" }
    ]
};

const builder = new addonBuilder(manifest);

async function refreshData() {
    try {
        const res = await axios.get(M3U_URL);
        const parsed = parser.parse(res.data);
        playlistItems = parsed.items.map((item, i) => ({ ...item, internalId: `sup_${i}` }));
    } catch (e) { console.error("Error M3U"); }
}

// Handler de búsqueda y catálogo
builder.defineCatalogHandler(async ({ type, id }) => {
    let list = [];
    if (id === "cat_sports") list = playlistItems.filter(i => i.group.title === "DEPORTES");
    else if (id === "cat_movies") list = playlistItems.filter(i => i.group.title === "CINE");
    else if (id === "cat_series") list = playlistItems.filter(i => i.group.title === "SERIES");
    else list = playlistItems.filter(i => i.tvg.country === "AR");

    return {
        metas: list.slice(0, 100).map(i => ({
            id: i.internalId,
            type: type,
            name: i.name,
            poster: i.tvg.logo || "https://via.placeholder.com/300x450?text=Cine"
        }))
    };
});

// Handler para BUSCAR links dentro de las películas oficiales de Stremio
builder.defineStreamHandler(async ({ type, id }) => {
    let item;
    
    if (id.startsWith("sup_")) {
        item = playlistItems.find(i => i.internalId === id);
    } else if (id.startsWith("tt")) {
        // Si el usuario abrió una peli de Stremio (IMDb ID), intentamos matchear por nombre
        try {
            const tmdb = await axios.get(`https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=es-ES`);
            const name = tmdb.data.movie_results[0]?.title || tmdb.data.tv_results[0]?.name;
            if (name) {
                item = playlistItems.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
            }
        } catch (e) { console.log("IMDb match failed"); }
    }

    return item ? { streams: [{ title: "🚀 Ver en Super Cinema (Directo)", url: item.url }] } : { streams: [] };
});

refreshData();
setInterval(refreshData, 3600000);
serveHTTP(builder.getInterface(), { port: process.env.PORT || 10000 });
