const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');
const NodeCache = require('node-cache');

const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const cache = new NodeCache({ stdTTL: 7200 }); // 2h de caché

let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super.pro",
    version: "2.0.0",
    name: "Super IPTV Pro",
    description: "TV Premium, Deportes y Cine (TMDB)",
    resources: ["catalog", "stream", "meta"],
    types: ["tv", "movie"],
    idPrefixes: ["sup_"],
    catalogs: [
        { type: "tv", id: "cat_sports", name: "⚽ Deportes HD" },
        { type: "tv", id: "cat_arg", name: "🇦🇷 Argentina Directo" },
        { type: "movie", id: "cat_movies", name: "🍿 Cine & Estrenos" }
    ]
};

const builder = new addonBuilder(manifest);

async function refreshData() {
    try {
        const res = await axios.get(M3U_URL);
        const parsed = parser.parse(res.data);
        playlistItems = parsed.items.map((item, i) => ({ ...item, internalId: `sup_${i}` }));
        console.log("Base de datos IPTV actualizada.");
    } catch (e) { console.error("Error actualizando M3U"); }
}

async function getPoster(name) {
    if (!TMDB_API_KEY) return null;
    const cKey = `img_${name}`;
    if (cache.has(cKey)) return cache.get(cKey);
    try {
        const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&language=es-ES`;
        const { data } = await axios.get(url);
        if (data.results && data.results[0]) {
            const img = `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`;
            cache.set(cKey, img);
            return img;
        }
    } catch (e) { return null; }
}

builder.defineCatalogHandler(async ({ type, id }) => {
    let list = [];
    if (id === "cat_sports") list = playlistItems.filter(i => i.group.title === "DEPORTES");
    else if (id === "cat_arg") list = playlistItems.filter(i => i.name.toLowerCase().includes("ar |") || i.tvg.country === "AR");
    else if (id === "cat_movies") list = playlistItems.filter(i => i.group.title === "CINE");

    const metas = await Promise.all(list.slice(0, 200).map(async (item) => ({
        id: item.internalId,
        type: type,
        name: item.name,
        poster: type === "movie" ? await getPoster(item.name) : item.tvg.logo,
        description: `Fuente: Privada | Grupo: ${item.group.title}`
    })));

    return { metas };
});

builder.defineStreamHandler(({ id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    return item ? { streams: [{ title: "🔥 Reproducción Ultra Rápida", url: item.url }] } : { streams: [] };
});

refreshData();
setInterval(refreshData, 3600000);
serveHTTP(builder.getInterface(), { port: process.env.PORT || 10000 });
