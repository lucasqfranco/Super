import requests
import re
from concurrent.futures import ThreadPoolExecutor

SOURCES = [
    "https://iptv-org.github.io/iptv/index.m3u",
    "http://tv.m3uts.xyz/get.php?username=m&password=m&type=m3u_plus&output=ts",
    "https://raw.githubusercontent.com/Lsy829/IPTV/main/AR.m3u",
    "https://raw.githubusercontent.com/tomas969/iptv-ar/master/argentina.m3u8",
    "https://raw.githubusercontent.com/carlosep94/IPTV_M3U/main/Latino_HD.m3u",
    "https://raw.githubusercontent.com/Sion88/tv-latina/main/peliculas.m3u",
    "https://raw.githubusercontent.com/De-Todo-Un-Poco-Gratis/Lista-M3U/master/VOD.m3u"
]

# FILTRO REGIONAL: Solo estos países se mantienen
ALLOWED_COUNTRIES = ['AR', 'MX', 'CL', 'CO', 'ES', 'US', 'UY', 'PY']

SUB_GENRES_MAP = {
    'Aire': ['telefe', 'eltrece', 'trece', 'america tv', 'canal 9 ar', 'tv publica', 'encuentro'],
    'Noticias': ['tn', 'c5n', 'a24', 'cronica', 'canal 26', 'ln+', 'noticias', 'news', 'cnn', 'bbc'],
    'Deportes': ['espn', 'fox sports', 'tyc', 'directv', 'tnt sports', 'dazn', 'vix', 'dsports', 'f1', 'nba'],
    'Cine': ['hbo', 'star', 'cine', 'movie', 'max', 'warner', 'universal', 'paramount', 'cinecanal'],
    'Infantil': ['disney', 'nick', 'cartoon', 'kids', 'nene', 'junior', 'baby']
}

def check_link(channel):
    try:
        r = requests.get(channel['url'], timeout=4, stream=True)
        r.close()
        return channel if r.status_code == 200 else None
    except: return None

def main():
    raw_list = []
    seen_urls = set()
    print("Filtrando contenido por idioma (Español/Inglés) y región...")
    
    for source in SOURCES:
        try:
            r = requests.get(source, timeout=20)
            lines = r.text.splitlines()
            current_inf = ""
            for line in lines:
                if line.startswith("#EXTINF"): current_inf = line
                elif line.startswith("http") and line not in seen_urls:
                    name_low = current_inf.lower()
                    
                    # 1. Extraer país del tag tvg-country="..."
                    ctry_match = re.search(r'tvg-country="([^"]+)"', current_inf)
                    ctry = ctry_match.group(1).upper() if ctry_match else ""
                    
                    # 2. Lógica de filtrado de idiomas/países
                    # Mantenemos si: Es de un país permitido O tiene palabras clave en español
                    is_allowed = ctry in ALLOWED_COUNTRIES or any(x in name_low for x in ["latino", "español", "castellano", "ar:", "mx:", "es:"])
                    
                    if is_allowed:
                        is_arg = ctry == "AR" or any(x in name_low for x in ["ar:", "ar |", "argentina"])
                        
                        matched_genre = "General"
                        for genre, keywords in SUB_GENRES_MAP.items():
                            if any(k in name_low for k in keywords):
                                matched_genre = genre
                                break
                        
                        clean_name = re.sub(r'#EXTINF:-1.*?,', '', current_inf)
                        clean_name = re.sub(r'\[.*?\]|\(.*?\)|(AR|LAT|HD|SD|FHD|VIP|PREMIUM)\s?[:|]?\s?', '', clean_name, flags=re.IGNORECASE).strip()
                        
                        # Guardamos el tag de país para el Addon
                        country_tag = 'AR' if is_arg else ctry
                        
                        raw_list.append({
                            'inf': f'#EXTINF:-1 group-title="{matched_genre}" x-country="{country_tag}" x-genre="{matched_genre}"',
                            'name': clean_name, 'url': line
                        })
                        seen_urls.add(line)
        except: continue

    print(f"Validando {len(raw_list)} canales filtrados...")
    with ThreadPoolExecutor(max_workers=50) as executor:
        valid_channels = [c for c in list(executor.map(check_link, raw_list)) if c]

    with open("mi_lista_privada.m3u", "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        for c in valid_channels: f.write(f"{c['inf']},{c['name']}\n{c['url']}\n")
    print(f"Lista finalizada con {len(valid_channels)} canales de interés.")

if __name__ == "__main__": main()
