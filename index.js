const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');
const NodeCache = require('node-cache');

const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const cache = new NodeCache({ stdTTL: 7200 });

let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super.final",
    version: "7.0.0",
    name: "Super TV & Cinema Pro",
    description: "TV en Vivo, Películas y Series Latino (Verificado)",
    resources: ["catalog", "stream", "meta"],
    types: ["movie", "series", "tv"],
    idPrefixes: ["sup_", "tt"], 
    catalogs: [
        { 
            type: "movie", 
            id: "super_search", 
            name: "🔍 BUSCAR EN SUPER",
            extra: [{ name: "search", isRequired: false }] 
        },
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
        console.log("Base de datos sincronizada: " + playlistItems.length);
    } catch (e) { console.error("Error cargando M3U"); }
}

// MANEJADOR DE CATÁLOGOS (Incluye la Búsqueda)
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    let list = [];

    // Lógica de Búsqueda
    if (extra && extra.search) {
        const query = extra.search.toLowerCase();
        list = playlistItems.filter(i => i.name.toLowerCase().includes(query));
    } 
    // Lógica de Categorías Normales
    else if (id === "cat_sports") list = playlistItems.filter(i => i.group.title === "DEPORTES");
    else if (id === "cat_movies") list = playlistItems.filter(i => i.group.title === "CINE");
    else if (id === "cat_series") list = playlistItems.filter(i => i.group.title === "SERIES");
    else if (id === "cat_arg") list = playlistItems.filter(i => i.tvg.country === "AR");

    const metas = list.slice(0, 100).map(i => ({
        id: i.internalId,
        type: type || "movie",
        name: i.name,
        poster: i.tvg.logo || "https://via.placeholder.com/300x450?text=Cinema"
    }));

    return { metas };
});

// MANEJADOR DE METADATOS
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
                description: res ? res.overview : "Contenido de tu lista privada."
            }
        };
    } catch (e) { return { meta: { id, type, name: item.name } }; }
});

// MANEJADOR DE STREAMS
builder.defineStreamHandler(async ({ type, id }) => {
    let item = playlistItems.find(i => i.internalId === id);
    
    if (!item && id.startsWith("tt")) {
        try {
            const tmdb = await axios.get(`https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=es-ES`);
            const name = tmdb.data.movie_results[0]?.title || tmdb.data.tv_results[0]?.name;
            if (name) item = playlistItems.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
        } catch (e) { console.log("Error en match IMDb"); }
    }

    return item ? { streams: [{ title: "🚀 Reproducir en Super Cinema (HD)", url: item.url }] } : { streams: [] };
});

refreshData();
setInterval(refreshData, 3600000);
serveHTTP(builder.getInterface(), { port: process.env.PORT || 10000 });
