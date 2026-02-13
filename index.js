const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');
const NodeCache = require('node-cache');

const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const cache = new NodeCache({ stdTTL: 7200 });

let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super.ultimate",
    version: "6.0.0",
    name: "Super TV & Cinema",
    description: "TV en Vivo, Películas Latino y Series Verificadas",
    resources: ["catalog", "stream", "meta", "search"],
    types: ["movie", "series", "tv"],
    idPrefixes: ["sup_", "tt"], 
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
        console.log("Sincronización completa.");
    } catch (e) { console.error("Error M3U"); }
}

// 1. Manejador de Catálogos
builder.defineCatalogHandler(async ({ type, id }) => {
    let list = [];
    if (id === "cat_sports") list = playlistItems.filter(i => i.group.title === "DEPORTES");
    else if (id === "cat_movies") list = playlistItems.filter(i => i.group.title === "CINE");
    else if (id === "cat_series") list = playlistItems.filter(i => i.group.title === "SERIES");
    else if (id === "cat_arg") list = playlistItems.filter(i => i.tvg.country === "AR");

    return {
        metas: list.slice(0, 100).map(i => ({
            id: i.internalId,
            type: type,
            name: i.name,
            poster: i.tvg.logo || "https://via.placeholder.com/300x450?text=Cinema"
        }))
    };
});

// 2. Manejador de Metadatos (Carátulas y sinopsis)
builder.defineMetaHandler(async ({ type, id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    if (!item) return { meta: {} };

    try {
        const tmdb = await axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.name)}&language=es-ES`);
        const res = tmdb.data.results[0];
        return {
            meta: {
                id: id,
                type: type,
                name: res ? (res.title || res.name) : item.name,
                poster: res ? `https://image.tmdb.org/t/p/w500${res.poster_path}` : item.tvg.logo,
                background: res ? `https://image.tmdb.org/t/p/original${res.backdrop_path}` : null,
                description: res ? res.overview : "Contenido verificado de tu lista privada."
            }
        };
    } catch (e) { return { meta: { id, type, name: item.name } }; }
});

// 3. Manejador de Búsqueda
builder.defineSearchHandler(async ({ query }) => {
    const searchResults = playlistItems.filter(i => i.name.toLowerCase().includes(query.toLowerCase()));
    return {
        metas: searchResults.slice(0, 20).map(i => ({
            id: i.internalId,
            type: "movie",
            name: i.name,
            poster: i.tvg.logo
        }))
    };
});

// 4. Manejador de Streams (Lo que hace que la peli se vea)
builder.defineStreamHandler(async ({ id }) => {
    let item = playlistItems.find(i => i.internalId === id);
    
    // Si el ID es tt... (de IMDb), buscamos por nombre en nuestra lista
    if (!item && id.startsWith("tt")) {
        try {
            const tmdb = await axios.get(`https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=es-ES`);
            const name = tmdb.data.movie_results[0]?.title || tmdb.data.tv_results[0]?.name;
            if (name) item = playlistItems.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
        } catch (e) { console.log("IMDb link not found"); }
    }

    return item ? { streams: [{ title: "🚀 Reproducir en Super Cinema (HD)", url: item.url }] } : { streams: [] };
});

refreshData();
setInterval(refreshData, 3600000);
serveHTTP(builder.getInterface(), { port: process.env.PORT || 10000 });
