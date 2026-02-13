import requests
import re
from concurrent.futures import ThreadPoolExecutor

SOURCES = [
    "https://iptv-org.github.io/iptv/index.m3u",
    "http://tv.m3uts.xyz/get.php?username=m&password=m&type=m3u_plus&output=ts",
    "https://raw.githubusercontent.com/Lsy829/IPTV/main/AR.m3u",
    "https://raw.githubusercontent.com/Lsy829/IPTV/main/VOD.m3u",
    "https://raw.githubusercontent.com/david76/IPTV-FILMES-SERIES/main/lista.m3u",
    "https://raw.githubusercontent.com/Sion88/tv-latina/main/peliculas.m3u",
    "https://raw.githubusercontent.com/De-Todo-Un-Poco-Gratis/Lista-M3U/master/VOD.m3u"
]

CATEGORIES = {
    'DEPORTES': ['espn', 'fox sports', 'tyc', 'directv', 'tnt sports', 'win sports', 'dazn', 'bein', 'vix', 'f1', 'dsports', 'deporte'],
    'CINE': ['hbo', 'starx', 'cinecanal', 'pelicula', 'movie', 'cinema', 'max', 'universal', 'paramount', 'netflix'],
    'SERIES': ['serie', 'season', 'temporada', 'capitulo', 'episode'],
    'DOCS': ['discovery', 'history', 'natgeo', 'animal', 'wild', 'science', 'investigation'],
    'NIÑOS': ['disney', 'nick', 'cartoon', 'kids', 'nene', 'discovery kids', 'junior', 'baby']
}

def check_link(channel):
    try:
        r = requests.head(channel['url'], timeout=2, allow_redirects=True)
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
            is_vod_source = any(x in source.lower() for x in ["vod", "peliculas", "filmes", "serie"])
            for line in lines:
                if line.startswith("#EXTINF"): current_inf = line
                elif line.startswith("http") and line not in seen_urls:
                    name_low = current_inf.lower()
                    is_arg = any(x in name_low for x in ["ar:", "ar |", "[ar]", "argentina", "🇦🇷"]) or 'country="AR"' in current_inf
                    
                    group = "VARIEDADES"
                    if is_arg: group = "ARGENTINA" # Prioridad Argentina
                    elif is_vod_source or any(w in name_low for w in CATEGORIES['CINE']): group = "CINE"
                    elif any(w in name_low for w in CATEGORIES['SERIES']): group = "SERIES"
                    elif any(w in name_low for w in CATEGORIES['DEPORTES']): group = "DEPORTES"
                    elif any(w in name_low for w in CATEGORIES['DOCS']): group = "DOCS"
                    elif any(w in name_low for w in CATEGORIES['NIÑOS']): group = "NIÑOS"
                    
                    clean_name = re.sub(r'#EXTINF:-1.*?,', '', current_inf)
                    clean_name = re.sub(r'\[.*?\]|\(.*?\)|(AR|LAT|HD|SD|FHD|VIP)\s?[:|]?\s?', '', clean_name, flags=re.IGNORECASE).strip()
                    country_tag = 'tvg-country="AR"' if is_arg else ''
                    raw_list.append({'inf': f'#EXTINF:-1 group-title="{group}" {country_tag}', 'name': clean_name, 'url': line})
                    seen_urls.add(line)
        except: continue

    with ThreadPoolExecutor(max_workers=40) as executor:
        valid_channels = [c for c in list(executor.map(check_link, raw_list)) if c]

    with open("mi_lista_privada.m3u", "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        for c in valid_channels: f.write(f"{c['inf']},{c['name']}\n{c['url']}\n")

if __name__ == "__main__": main()
