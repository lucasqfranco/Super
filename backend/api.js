const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// Fuente de canales argentinos
const CHANNELS_URL = 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ar.m3u';

let channels = [];

async function loadChannels() {
    try {
        console.log('Cargando canales...');
        const response = await axios.get(CHANNELS_URL);
        const content = response.data;
        
        // Parsear manualmente el M3U
        const lines = content.split('\n');
        const newChannels = [];
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXTINF')) {
                const nameMatch = lines[i].match(/,(.+)$/);
                const name = nameMatch ? nameMatch[1] : 'Canal';
                const url = lines[i + 1];
                
                if (url && url.startsWith('http')) {
                    let category = 'General';
                    const lowerName = name.toLowerCase();
                    if (lowerName.includes('deporte') || lowerName.includes('sports')) category = '⚽ Deportes';
                    else if (lowerName.includes('noticia') || lowerName.includes('news')) category = '📰 Noticias';
                    else if (lowerName.includes('f1') || lowerName.includes('formula')) category = '🏎️ F1';
                    
                    newChannels.push({
                        id: i,
                        name: name,
                        url: url,
                        category: category,
                        quality: name.includes('720p') ? 'HD' : 'SD'
                    });
                }
            }
        }
        
        channels = newChannels;
        console.log(`✅ Cargados ${channels.length} canales`);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Endpoints
app.get('/api/channels', (req, res) => {
    let result = [...channels];
    
    if (req.query.category && req.query.category !== 'Todos') {
        result = result.filter(c => c.category === req.query.category);
    }
    if (req.query.search) {
        const term = req.query.search.toLowerCase();
        result = result.filter(c => c.name.toLowerCase().includes(term));
    }
    
    res.json(result);
});

app.get('/api/categories', (req, res) => {
    const cats = ['Todos', ...new Set(channels.map(c => c.category))];
    res.json(cats);
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', channels: channels.length });
});

const PORT = process.env.PORT || 3000;

loadChannels();
setInterval(loadChannels, 3600000);

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
