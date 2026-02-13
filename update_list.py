import requests
import re
from concurrent.futures import ThreadPoolExecutor

# TODAS las fuentes integradas y reforzadas
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

SUB_GENRES = {
    'Aire': ['telefe', 'trece', 'america', 'canal 9', 'tv publica', 'encuentro'],
    'Noticias': ['tn', 'c5n', 'a24', 'cronica', '26', 'ln+', 'noticias'],
    'Deportes': ['tyc', 'tnt sports', 'espn', 'fox sports', 'dazn', 'vix', 'dsports', 'f1'],
    'Cine': ['hbo', 'star', 'cine', 'movie', 'max', 'warner', 'universal'],
    'Infantil': ['disney', 'nick', 'cartoon', 'kids', 'nene', 'junior']
}

def check_link(channel):
    """Validación permisiva: si responde en 5 segundos, entra."""
    try:
        # Usamos GET con stream=True para ser más compatibles que con HEAD
        r = requests.get(channel['url'], timeout=5, stream=True)
        r.close()
        return channel if r.status_code == 200 else None
    except:
        return None

def main():
    raw_list = []
    seen_urls = set()
    print("Iniciando recolección masiva...")

    for source in SOURCES:
        try:
            r = requests.get(source, timeout=20)
            lines = r.text.splitlines()
            current_inf = ""
            for line in lines:
                if line.startswith("#EXTINF"): current_inf = line
                elif line.startswith("http") and line not in seen_urls:
                    name_low = current_inf.lower()
                    
                    # Detección de Argentina (Prioridad 1)
                    is_arg = any(x in name_low for x in ["ar:", "ar |", "[ar]", "argentina"]) or 'country="AR"' in current_inf
                    
                    matched_genre = "General"
                    for genre, keywords in SUB_GENRES.items():
                        if any(k in name_low for k in keywords):
                            matched_genre = genre
                            break
                    
                    group = "VARIEDADES"
                    if is_arg: group = "ARGENTINA"
                    elif matched_genre == "Deportes": group = "DEPORTES"
                    elif matched_genre == "Cine": group = "CINE"
                    elif matched_genre == "Infantil": group = "NIÑOS"

                    clean_name = re.sub(r'#EXTINF:-1.*?,', '', current_inf)
                    clean_name = re.sub(r'\[.*?\]|\(.*?\)|(AR|LAT|HD|SD|FHD|VIP)\s?[:|]?\s?', '', clean_name, flags=re.IGNORECASE).strip()
                    
                    # Formato robusto: usamos una etiqueta propia x-genre
                    raw_list.append({
                        'inf': f'#EXTINF:-1 group-title="{group}" x-genre="{matched_genre}" tvg-country="{"AR" if is_arg else ""}"',
                        'name': clean_name, 'url': line
                    })
                    seen_urls.add(line)
        except: continue

    print(f"Validando {len(raw_list)} enlaces. Paciencia...")
    with ThreadPoolExecutor(max_workers=50) as executor:
        valid_channels = [c for c in list(executor.map(check_link, raw_list)) if c]

    with open("mi_lista_privada.m3u", "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        for c in valid_channels: f.write(f"{c['inf']},{c['name']}\n{c['url']}\n")
    print(f"¡Hecho! Lista con {len(valid_channels)} canales.")

if __name__ == "__main__": main()
