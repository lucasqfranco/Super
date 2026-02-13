const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');
const NodeCache = require('node-cache');

const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const cache = new NodeCache({ stdTTL: 7200 }); 

let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super.v3",
    version: "3.0.0",
    name: "Super IPTV Ultimate",
    description: "Premium: Deportes, Cine, Kids y TV Argentina/España",
    resources: ["catalog", "stream", "meta"],
    types: ["tv", "movie"],
    idPrefixes: ["sup_"],
    catalogs: [
        { type: "tv", id: "cat_sports", name: "⚽ DEPORTES" },
        { type: "tv", id: "cat_arg", name: "🇦🇷 ARGENTINA" },
        { type: "movie", id: "cat_cinema", name: "🍿 CINE PREMIUM" },
        { type: "tv", id: "cat_kids", name: "👶 NIÑOS" },
        { type: "tv", id: "cat_esp", name: "🇪🇸 ESPAÑA" }
    ]
};

const builder = new addonBuilder(manifest);

async function refreshData() {
    try {
        const res = await axios.get(M3U_URL);
        const parsed = parser.parse(res.data);
        playlistItems = parsed.items.map((item, i) => ({ ...item, internalId: `sup_${i}` }));
        console.log("Sincronización exitosa: " + playlistItems.length + " canales.");
    } catch (e) { console.error("Error al refrescar M3U"); }
}

async function getMeta(name, type) {
    if (!TMDB_API_KEY) return null;
    const cKey = `meta_${name}`;
    if (cache.has(cKey)) return cache.get(cKey);
    try {
        const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&language=es-ES`;
        const { data } = await axios.get(url);
        if (data.results && data.results[0]) {
            const meta = {
                poster: `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`,
                description: data.results[0].overview
            };
            cache.set(cKey, meta);
            return meta;
        }
    } catch (e) { return null; }
}

builder.defineCatalogHandler(async ({ type, id }) => {
    let list = [];
    if (id === "cat_sports") list = playlistItems.filter(i => i.group.title === "DEPORTES");
    else if (id === "cat_arg") list = playlistItems.filter(i => i.tvg.country === "AR" || i.name.toLowerCase().includes("ar |"));
    else if (id === "cat_cinema") list = playlistItems.filter(i => i.group.title === "CINE");
    else if (id === "cat_kids") list = playlistItems.filter(i => i.group.title === "NIÑOS");
    else if (id === "cat_esp") list = playlistItems.filter(i => i.tvg.country === "ES" || i.name.toLowerCase().includes("es |"));

    const metas = await Promise.all(list.slice(0, 150).map(async (item) => {
        const meta = (id === "cat_cinema") ? await getMeta(item.name, type) : null;
        return {
            id: item.internalId,
            type: "tv",
            name: item.name,
            poster: meta?.poster || item.tvg.logo || "https://via.placeholder.com/300x450?text=TV",
            description: meta?.description || `Canal: ${item.name} | Fuente: Premium`
        };
    }));
    return { metas };
});

builder.defineStreamHandler(({ id }) => {
    const item = playlistItems.find(i => i.internalId === id);
    return item ? { streams: [{ title: "🔥 Link Directo HD", url: item.url }] } : { streams: [] };
});

refreshData();
setInterval(refreshData, 3600000);
serveHTTP(builder.getInterface(), { port: process.env.PORT || 10000 });
