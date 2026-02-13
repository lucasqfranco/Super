const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const parser = require('iptv-playlist-parser');
const axios = require('axios');

const M3U_URL = "https://raw.githubusercontent.com/lucasqfranco/Super/main/mi_lista_privada.m3u";
let playlistItems = [];

const manifest = {
    id: "org.lucasqfranco.super.elite.final.fix",
    version: "14.0.0", // Subimos versión para forzar un refresco total
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
        playlistItems = parsed.items.map((item, i) => ({ 
            ...item, 
            internalId: `sup_${i}`
        }));
        console.log("Sistema v14 Final cargado. Canales: " + playlistItems.length);
    } catch (e) { console.error("Error M3U"); }
}

builder.defineCatalogHandler(async ({ id, extra }) => {
    let list = [];
    
    // --- LÓGICA DE FILTRADO CORREGIDA Y A PRUEBA DE BALAS ---

    // 1. Buscador
    if (extra && extra.search) {
        list = playlistItems.filter(i => i.name.toLowerCase().includes(extra.search.toLowerCase()));
    } else {
        // 2. Filtro de Categoría Principal (2da Columna)
        let primaryGroup = "";
        if (id === "cat_arg") primaryGroup = "ARGENTINA";
        else if (id === "cat_sports") primaryGroup = "DEPORTES";
        else if (id === "cat_cinema") primaryGroup = "CINE";

        list = playlistItems.filter(i => {
            // El group-title viene como "GRUPO;GENERO", buscamos la primera parte.
            const group = i.group.title.split(';')[0];
            return group === primaryGroup || (primaryGroup === 'CINE' && group === 'SERIES');
        });

        // 3. Filtro de Género (3ra Columna)
        if (extra && extra.genre && extra.genre !== "General") {
            // Buscamos el género en la segunda parte del group-title
            list = list.filter(i => {
                const parts = i.group.title.split(';');
                return parts.length > 1 && parts[1] === extra.genre;
            });
        }
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

// Los demás handlers no necesitan cambios
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
