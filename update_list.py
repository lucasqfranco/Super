import requests
import re
from concurrent.futures import ThreadPoolExecutor

SOURCES = [
    "https://iptv-org.github.io/iptv/index.m3u",
    "http://tv.m3uts.xyz/get.php?username=m&password=m&type=m3u_plus&output=ts",
    "https://raw.githubusercontent.com/Lsy829/IPTV/main/AR.m3u",
    "https://raw.githubusercontent.com/carlosep94/IPTV_M3U/main/Latino_HD.m3u",
    "https://raw.githubusercontent.com/Sion88/tv-latina/main/latino.m3u",
    "https://raw.githubusercontent.com/Lane-S-C/IPTV-Latino/master/Lista-Iptv.m3u"
]

CATEGORIES = {
    'DEPORTES': ['espn', 'fox sports', 'tyc', 'directv', 'tnt sports', 'win sports', 'dazn', 'bein', 'vix', 'f1', 'deporte', 'dsports', 'nba', 'ufc'],
    'CINE': ['hbo', 'starx', 'cinecanal', 'cine', 'movie', 'cinema', 'max', 'warner', 'universal', 'tnt series', 'paramount', 'axn', 'fx', 'amc'],
    'DOCS': ['discovery', 'history', 'natgeo', 'animal', 'wild', 'world', 'science', 'investigation', 'h&h'],
    'NIÑOS': ['disney', 'nick', 'cartoon', 'nene', 'kids', 'discovery kids', 'boing', 'baby', 'junior']
}

def check_link(channel):
    """Verifica si el link está activo (HEAD request)"""
    try:
        url = channel['url']
        # Intentamos una petición rápida de 3 segundos
        response = requests.head(url, timeout=3, allow_redirects=True)
        if response.status_code == 200:
            return channel
    except:
        return None
    return None

def main():
    raw_channels = []
    seen_urls = set()
    print("Fase 1: Recolectando y filtrando canales...")

    for source in SOURCES:
        try:
            r = requests.get(source, timeout=30)
            lines = r.text.splitlines()
            current_inf = ""
            for line in lines:
                if line.startswith("#EXTINF"):
                    current_inf = line
                elif line.startswith("http") and line not in seen_urls:
                    name_low = current_inf.lower()
                    is_arg = any(x in name_low for x in ["ar:", "ar |", "[ar]", "argentina", "🇦🇷"]) or 'tvg-country="AR"' in current_inf
                    
                    matched_cat = None
                    for cat, keywords in CATEGORIES.items():
                        if any(word in name_low for word in keywords):
                            matched_cat = cat
                            break

                    if is_arg or matched_cat:
                        # Limpieza de nombre
                        clean_name = re.sub(r'#EXTINF:-1.*?,', '', current_inf)
                        clean_name = re.sub(r'\[.*?\]|\(.*?\)|(AR|LAT|ES|MX|HD|SD|FHD|VIP|PREMIUM)\s?[:|]?\s?', '', clean_name, flags=re.IGNORECASE).strip()
                        
                        raw_channels.append({
                            'inf': f'#EXTINF:-1 group-title="{matched_cat if matched_cat else "VARIEDADES"}" { "tvg-country=\\"AR\\"" if is_arg else "" }',
                            'name': clean_name,
                            'url': line
                        })
                        seen_urls.add(line)
        except: continue

    print(f"Fase 2: Validando {len(raw_channels)} links en paralelo (esto puede tardar)...")
    valid_channels = []
    # Usamos hilos para validar muchos links al mismo tiempo rápidamente
    with ThreadPoolExecutor(max_workers=20) as executor:
        results = list(executor.map(check_link, raw_channels))
        valid_channels = [c for c in results if c is not None]

    print(f"Fase 3: Guardando {len(valid_channels)} canales verificados.")
    with open("mi_lista_privada.m3u", "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        for c in valid_channels:
            f.write(f"{c['inf']},{c['name']}\n{c['url']}\n")

if __name__ == "__main__":
    main()
