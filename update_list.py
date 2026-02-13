import requests
import re
from concurrent.futures import ThreadPoolExecutor

SOURCES = [
    "https://iptv-org.github.io/iptv/index.m3u",
    "http://tv.m3uts.xyz/get.php?username=m&password=m&type=m3u_plus&output=ts",
    "https://raw.githubusercontent.com/Lsy829/IPTV/main/AR.m3u",
    "https://raw.githubusercontent.com/tomas969/iptv-ar/master/argentina.m3u8",
    "https://raw.githubusercontent.com/K-IPTV/K-IPTV/main/K-IPTV.m3u",
    "https://raw.githubusercontent.com/De-Todo-Un-Poco-Gratis/Lista-M3U/master/VOD.m3u"
]

# Diccionario expandido para alimentar la 3ra columna de TODAS las categorías
SUB_GENRES = {
    # Para Argentina
    'Aire': ['telefe', 'trece', 'america', 'canal 9', 'tv publica', 'encuentro'],
    'Noticias': ['tn', 'c5n', 'a24', 'cronica', '26', 'ln+', 'noticias'],
    # Para Deportes
    'Futbol': ['tnt sports', 'tyc', 'espn premium', 'futbol', 'soccer', 'gol tv', 'liga'],
    'F1': ['f1', 'formula 1', 'dazn f1'],
    # Para Cine
    'Accion': ['hbo', 'fox', 'action', 'warner', 'universal', 'sony', 'axn'],
    'Terror': ['horror', 'terror', 'dark', 'panic'],
    # Para Niños
    'Dibujos': ['disney', 'nick', 'cartoon', 'discovery kids', 'nene', 'kids']
}

def check_link(channel):
    try:
        r = requests.get(channel['url'], timeout=3, stream=True)
        r.close()
        return channel if r.status_code == 200 else None
    except: return None

def main():
    raw_list = []
    seen_urls = set()
    for source in SOURCES:
        try:
            r = requests.get(source, timeout=20)
            lines = r.text.splitlines()
            current_inf = ""
            for line in lines:
                if line.startswith("#EXTINF"): current_inf = line
                elif line.startswith("http") and line not in seen_urls:
                    name_low = current_inf.lower()
                    
                    is_arg = any(x in name_low for x in ["ar:", "ar |", "[ar]", "argentina"]) or 'country="AR"' in current_inf
                    
                    matched_genre = "General"
                    for genre, keywords in SUB_GENRES.items():
                        if any(k in name_low for k in keywords):
                            matched_genre = genre
                            break
                    
                    group = "VARIEDADES"
                    if is_arg: group = "ARGENTINA"
                    elif any(k in name_low for k in ['espn', 'fox sports', 'tyc', 'dazn', 'deporte']): group = "DEPORTES"
                    elif any(k in name_low for k in ['hbo', 'star', 'cine', 'movie', 'max']): group = "CINE"
                    elif any(k in name_low for k in ['disney', 'nick', 'kids', 'junior']): group = "NIÑOS"

                    clean_name = re.sub(r'#EXTINF:-1.*?,', '', current_inf)
                    clean_name = re.sub(r'\[.*?\]|\(.*?\)|(AR|LAT|HD|SD|FHD|VIP)\s?[:|]?\s?', '', clean_name, flags=re.IGNORECASE).strip()
                    
                    raw_list.append({
                        'inf': f'#EXTINF:-1 group-title="{group}" x-genre="{matched_genre}" tvg-country="{"AR" if is_arg else ""}"',
                        'name': clean_name, 
                        'url': line
                    })
                    seen_urls.add(line)
        except: continue

    with ThreadPoolExecutor(max_workers=50) as executor:
        valid_channels = [c for c in list(executor.map(check_link, raw_list)) if c]

    with open("mi_lista_privada.m3u", "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        for c in valid_channels: f.write(f"{c['inf']},{c['name']}\n{c['url']}\n")

if __name__ == "__main__": main()
