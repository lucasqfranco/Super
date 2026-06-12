const API_URL = 'https://super-tv-backend.onrender.com';
let currentTab = 'channels';

async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/api/status`);
        const data = await res.json();
        document.getElementById('stats').innerHTML = `
            <span class="stat-badge">📡 ${data.channels.toLocaleString()} canales</span>
            <span class="stat-badge">🎬 ${data.movies.toLocaleString()} películas</span>
        `;
    } catch(e) { console.error(e); }
}

async function loadChannelFilters() {
    try {
        const [countries, categories] = await Promise.all([
            fetch(`${API_URL}/api/countries`).then(r=>r.json()),
            fetch(`${API_URL}/api/categories`).then(r=>r.json())
        ]);
        
        document.getElementById('countryFilter').innerHTML = countries.map(c=>`<option value="${c.code}">${c.name}</option>`).join('');
        document.getElementById('categoryFilter').innerHTML = categories.map(c=>`<option value="${c}">${c}</option>`).join('');
        
        document.getElementById('countryFilter').addEventListener('change', loadChannels);
        document.getElementById('categoryFilter').addEventListener('change', loadChannels);
        document.getElementById('searchInput').addEventListener('input', loadChannels);
        
        await loadChannels();
    } catch(e) { console.error(e); }
}

async function loadMovieFilters() {
    try {
        const genres = await fetch(`${API_URL}/api/movie-genres`).then(r=>r.json());
        document.getElementById('genreFilter').innerHTML = genres.map(g=>`<option value="${g.code}">${g.name}</option>`).join('');
        document.getElementById('genreFilter').addEventListener('change', loadMovies);
        document.getElementById('movieSearchInput').addEventListener('input', loadMovies);
        await loadMovies();
    } catch(e) { console.error(e); }
}

async function loadChannels() {
    const search = document.getElementById('searchInput').value;
    const country = document.getElementById('countryFilter').value;
    const category = document.getElementById('categoryFilter').value;
    let url = `${API_URL}/api/channels?country=${country}&category=${encodeURIComponent(category)}`;
    if(search) url += `&search=${encodeURIComponent(search)}`;
    
    try {
        const res = await fetch(url);
        const channels = await res.json();
        renderChannels(channels);
    } catch(e) { document.getElementById('contentGrid').innerHTML = '<div class="loading">❌ Error</div>'; }
}

async function loadMovies() {
    const search = document.getElementById('movieSearchInput').value;
    const genre = document.getElementById('genreFilter').value;
    let url = `${API_URL}/api/movies?genre=${genre}`;
    if(search) url += `&search=${encodeURIComponent(search)}`;
    
    try {
        const res = await fetch(url);
        const movies = await res.json();
        renderMovies(movies);
    } catch(e) { document.getElementById('contentGrid').innerHTML = '<div class="loading">❌ Error</div>'; }
}

function renderChannels(channels) {
    const grid = document.getElementById('contentGrid');
    if(channels.length === 0) { grid.innerHTML = '<div class="loading">📡 No hay canales</div>'; return; }
    
    grid.innerHTML = channels.map(ch => `
        <div class="card" onclick="playVideo('${ch.url}', '${escapeHtml(ch.name)}')">
            <div class="card-poster">📺</div>
            <div class="card-info">
                <div class="card-title">${escapeHtml(ch.name)}</div>
                <div class="card-meta">
                    <span>${ch.countryName}</span>
                    <span>${ch.category}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function renderMovies(movies) {
    const grid = document.getElementById('contentGrid');
    if(movies.length === 0) { grid.innerHTML = '<div class="loading">🎬 No hay películas</div>'; return; }
    
    grid.innerHTML = movies.map(m => `
        <div class="card" onclick="playVideo('${m.url}', '🎬 ${escapeHtml(m.name)}')">
            <div class="card-poster">🎬</div>
            <div class="card-info">
                <div class="card-title">${escapeHtml(m.name)}</div>
                <div class="card-meta"><span>${m.genreName || m.genre}</span></div>
            </div>
        </div>
    `).join('');
}

function playVideo(url, title) {
    const modal = document.getElementById('playerModal');
    const video = document.getElementById('videoPlayer');
    document.getElementById('playerTitle').innerText = title;
    video.src = url;
    modal.style.display = 'flex';
    video.play().catch(e => console.log(e));
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if(m === '&') return '&amp;';
        if(m === '<') return '&lt;';
        if(m === '>') return '&gt;';
        return m;
    });
}

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        document.getElementById('channelsFilters').style.display = currentTab === 'movies' ? 'none' : 'flex';
        document.getElementById('moviesFilters').style.display = currentTab === 'movies' ? 'flex' : 'none';
        if(currentTab === 'channels') loadChannels();
        else loadMovies();
    });
});

// Modal
document.querySelector('.close-modal').addEventListener('click', () => {
    const modal = document.getElementById('playerModal');
    const video = document.getElementById('videoPlayer');
    video.pause();
    video.src = '';
    modal.style.display = 'none';
});

window.onclick = (e) => {
    const modal = document.getElementById('playerModal');
    if(e.target === modal) {
        const video = document.getElementById('videoPlayer');
        video.pause();
        video.src = '';
        modal.style.display = 'none';
    }
};

// Iniciar
loadStats();
loadChannelFilters();
loadMovieFilters();
