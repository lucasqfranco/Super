import requests
import re
from concurrent.futures import ThreadPoolExecutor

# FUENTES ELITE: Añadidas fuentes específicas de Argentina para máxima cobertura
SOURCES = [
    "https://iptv-org.github.io/iptv/index.m3u",
    "http://tv.m3uts.xyz/get.php?username=m&password=m&type=m3u_plus&output=ts",
    "https://raw.githubusercontent.com/Lsy829/IPTV/main/AR.m3u",
    "https://raw.githubusercontent.com/tomas969/iptv-ar/master/argentina.m3u8",
    "https://raw.githubusercontent.com/carlosep94/IPTV_M3U/main/Latino_HD.m3u",
    "https://raw.githubusercontent.com/Sion88/tv-latina/main/peliculas.m3u",
    "https://raw.githubusercontent.com/De-Todo-Un-Poco-Gratis/Lista-M3U/master/VOD.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ar.m3u"
]

CATEGORIES = {
    'DEPORTES': ['espn', 'fox sports', 'tyc', 'directv', 'tnt sports', 'win sports', 'dazn', 'vix', 'f1', 'dsports', 'nba'],
    'CINE': ['hbo', 'starx', 'cinecanal', 'pelicula', 'movie', 'cinema', 'max', 'universal', 'paramount', 'netflix'],
    'SERIES': ['serie', 'season', 'temporada', 'capitulo', 'episode'],
    'DOCS': ['discovery', 'history', 'natgeo', 'animal', 'wild', 'science'],
    'NIÑOS': ['disney', 'nick', 'cartoon', 'kids', 'nene', 'junior', 'baby']
}

def check_link(channel):
    """Verifica si el link responde. Para Argentina somos más flexibles (timeout más largo)"""
    try:
        # Aumentamos timeout a 4s para no perder canales argentinos lentos
        r = requests.head(channel['url'], timeout=4, allow_redirects=True)
        return channel if r.status_code == 200 else None
    except:
        return None

def main():
    raw_list = []
    seen_urls = set()
    print("Recolectando canales...")

    for source in SOURCES:
        try:
            r = requests.get(source, timeout=25)
            lines = r.text.splitlines()
            current_inf = ""
            for line in lines:
                if line.startswith("#EXTINF"):
                    current_inf = line
                elif line.startswith("http") and line not in seen_urls:
                    name_low = current_inf.lower()
                    
                    # DETECCIÓN AGRESIVA DE ARGENTINA
                    is_arg = any(x in name_low for x in ["ar:", "ar |", "[ar]", "argentina", "🇦🇷", "telefe", "eltrece", "tyc", "tnt sports"]) or 'country="AR"' in current_inf
                    
                    group = "VARIEDADES"
                    if is_arg: 
                        group = "ARGENTINA"
                    else:
                        for cat, keywords in CATEGORIES.items():
                            if any(word in name_low for word in keywords):
                                group = cat
                                break
                    
                    clean_name = re.sub(r'#EXTINF:-1.*?,', '', current_inf)
                    clean_name = re.sub(r'\[.*?\]|\(.*?\)|(AR|LAT|HD|SD|FHD|VIP)\s?[:|]?\s?', '', clean_name, flags=re.IGNORECASE).strip()
                    country_tag = 'tvg-country="AR"' if is_arg else ''
                    
                    raw_list.append({
                        'inf': f'#EXTINF:-1 group-title="{group}" {country_tag}',
                        'name': clean_name,
                        'url': line
                    })
                    seen_urls.add(line)
        except: continue

    print(f"Validando {len(raw_list)} enlaces...")
    with ThreadPoolExecutor(max_workers=50) as executor:
        valid_channels = [c for c in list(executor.map(check_link, raw_list)) if c]

    with open("mi_lista_privada.m3u", "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        for c in valid_channels:
            f.write(f"{c['inf']},{c['name']}\n{c['url']}\n")
    print(f"Lista final: {len(valid_channels)} canales online.")

if __name__ == "__main__":
    main()
