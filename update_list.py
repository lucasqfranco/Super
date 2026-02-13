import requests
import re

SOURCES = [
    "https://iptv-org.github.io/iptv/index.m3u", # Base Global
    "http://tv.m3uts.xyz/get.php?username=m&password=m&type=m3u_plus&output=ts", # Xtream Privado
    "https://raw.githubusercontent.com/Lsy829/IPTV/main/AR.m3u", # Argentina Directo
    "https://raw.githubusercontent.com/carlosep94/IPTV_M3U/main/Latino_HD.m3u", # Latino Premium
    "https://raw.githubusercontent.com/Sion88/tv-latina/main/latino.m3u" # Deportes & Cine
]

# Solo Argentina y países latinos principales (Sin España)
ALLOWED_COUNTRIES = ['AR', 'MX', 'CL', 'CO', 'US'] 

# Mapeo de categorías para que el Addon las reconozca
CATEGORIES = {
    'DEPORTES': ['espn', 'fox sports', 'tyc', 'directv', 'tnt sports', 'win sports', 'dazn', 'vix', 'f1', 'deportes', 'dsports'],
    'CINE': ['hbo', 'starx', 'cinecanal', 'cine', 'movie', 'cinema', 'max', 'warner', 'universal', 'tnt series', 'paramount'],
    'DOCS': ['discovery', 'history', 'natgeo', 'animal', 'wild', 'world', 'science', 'investigation', 'h&h'],
    'KIDS': ['disney', 'nick', 'cartoon', 'nene', 'kids', 'discovery kids', 'boing', 'discovery kids']
}

def main():
    combined_channels = []
    seen_urls = set()
    print("Filtrando canales para Argentina y contenido Premium...")

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
                    
                    # 1. Filtro: ¿Es Argentina o es contenido Premium (Deportes/Cine/Docs/Kids)?
                    is_arg = 'tvg-country="AR"' in current_inf or "ar |" in name_low
                    is_premium = any(word in name_low for cat in CATEGORIES.values() for word in cat)

                    if is_arg or is_premium:
                        # 2. Clasificar en grupos propios
                        group = "VARIEDADES"
                        for cat, keywords in CATEGORIES.items():
                            if any(word in name_low for word in keywords):
                                group = cat
                                break
                        
                        # 3. Limpiar el nombre para que se vea bien en la TV
                        # Quita prefijos como "AR |", "LAT |", "HD |" y corchetes
                        clean_name = re.sub(r'#EXTINF:-1.*?,', '', current_inf)
                        clean_name = re.sub(r'\[.*?\]|\(.*?\)|\b(AR|LAT|ES|MX|HD|SD|FHD)\b\s?\|?\s?', '', clean_name, flags=re.IGNORECASE).strip()
                        
                        combined_channels.append(f'#EXTINF:-1 group-title="{group}" tvg-country="{ "AR" if is_arg else "" }",{clean_name}\n{line}')
                        seen_urls.add(line)
        except:
            continue

    with open("mi_lista_privada.m3u", "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n" + "\n".join(combined_channels))
    print(f"Lista finalizada: {len(combined_channels)} canales únicos.")

if __name__ == "__main__":
    main()
