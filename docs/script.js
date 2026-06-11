// ⚠️ IMPORTANTE: Cambiar esta URL después de desplegar en Render
const API_URL = 'https://super-tv-backend.onrender.com';

let currentTab = 'channels';

async function loadFilters() {
    try {
        const [countriesRes, categoriesRes] = await Promise.all([
            fetch(`${API_URL}/api/countries`),
            fetch(`${API_URL}/api/categories`)
        ]);
        
        const countries = await countriesRes.json();
        const categories = await categoriesRes.json();
        
        const countrySelect = document.getElementById('countryFilter');
        const categorySelect = document.getElementById('categoryFilter');
        
        countrySelect.innerHTML = countries.map(c => `<option value="${c.code}">${c.name}</option>`).join('');
        categorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
        
        countrySelect.addEventListener('change', loadContent);
        categorySelect.addEventListener('change', loadContent);
        document.getElementById('searchInput').addEventListener('input', loadContent);
        
        await loadContent();
    } catch (error) {
        console.error('Error cargando filtros:', error);
        document.getElementById('contentGrid').innerHTML = '<div class="loading">❌ Error conectando al backend. ¿Está ejecutándose?</div>';
    }
}

async function loadContent() {
    const search = document.getElementById('searchInput').value;
    
    if (currentTab === 'channels') {
        const country = document.getElementById('countryFilter').value;
        const category = document.getElementById('categoryFilter').value;
        let url = `${API_URL}/api/channels?country=${country}&category=${encodeURIComponent(category)}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        try {
            const res = await fetch(url);
            const channels = await res.json();
            renderChannels(channels);
        } catch (error) {
            document.getElementById('contentGrid').innerHTML = '<div class="loading">❌ Error cargando canales</div>';
        }
    } else {
        let url = `${API_URL}/api/movies`;
        if (search) url += `?search=${encodeURIComponent(search)}`;
        
        try {
            const res = await fetch(url);
            const movies = await res.json();
            renderMovies(movies);
        } catch (error) {
            document.getElementById('contentGrid').innerHTML = '<div class="loading">❌ Error cargando películas</div>';
        }
    }
}

function renderChannels(channels) {
    const grid = document.getElementById('contentGrid');
    if (channels.length === 0) {
        grid.innerHTML = '<div class="loading">📡 No se encontraron canales</div>';
        return;
    }
    
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
    if (movies.length === 0) {
        grid.innerHTML = '<div class="loading">🎬 No se encontraron películas</div>';
        return;
    }
    
    grid.innerHTML = movies.map(m => `
        <div class="card" onclick="playVideo('${m.url}', '🎬 ${escapeHtml(m.name)}')">
            <div class="card-poster">🎬</div>
            <div class="card-info">
                <div class="card-title">${escapeHtml(m.name)}</div>
                <div class="card-meta">
                    ${m.year ? `<span>${m.year}</span>` : ''}
                </div>
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
    video.play().catch(e => console.log('Error al reproducir:', e));
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        document.getElementById('filtersBar').style.display = currentTab === 'movies' ? 'none' : 'flex';
        loadContent();
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
    if (e.target === modal) {
        const video = document.getElementById('videoPlayer');
        video.pause();
        video.src = '';
        modal.style.display = 'none';
    }
};

// Iniciar
loadFilters();