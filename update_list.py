import requests
import re

SOURCES = [
    "https://iptv-org.github.io/iptv/index.m3u", # Base Global
    "http://tv.m3uts.xyz/get.php?username=m&password=m&type=m3u_plus&output=ts", # Tu fuente Xtream
    "https://raw.githubusercontent.com/Lsy829/IPTV/main/AR.m3u", # Argentina Directo
    "https://raw.githubusercontent.com/carlosep94/IPTV_M3U/main/Latino_HD.m3u", # Latino Premium
    "https://raw.githubusercontent.com/Sion88/tv-latina/main/latino.m3u", # Alternativa Deportes
    "https://raw.githubusercontent.com/Lane-S-C/IPTV-Latino/master/Lista-Iptv.m3u" # General Latino
]

# Diccionario de Categorías para el Addon
CATEGORIES = {
    'DEPORTES': ['espn', 'fox sports', 'tyc', 'directv', 'tnt sports', 'win sports', 'dazn', 'bein', 'vix', 'f1', 'deportes'],
    'CINE': ['hbo', 'starx', 'cinecanal', 'cine', 'movie', 'cinema', 'max', 'warner', 'universal', 'tnt series'],
    'KIDS': ['disney', 'nick', 'cartoon', 'nene', 'kids', 'discovery kids', 'boing']
}

def main():
    combined_channels = []
    seen_urls = set()
    print("Iniciando recolección de canales premium...")

    for source in SOURCES:
        try:
            r = requests.get(source, timeout=20)
            lines = r.text.splitlines()
            current_inf = ""
            for line in lines:
                if line.startswith("#EXTINF"):
                    current_inf = line
                elif line.startswith("http") and line not in seen_urls:
                    name_low = current_inf.lower()
                    
                    # 1. Filtro de Interés: ¿Es Argentina, España o contenido Premium?
                    is_es_ar = any(x in name_low for x in ["ar |", "es |", 'country="AR"', 'country="ES"'])
                    is_premium = any(word in name_low for cat in CATEGORIES.values() for word in cat)

                    if is_es_ar or is_premium:
                        # 2. Asignar Categoría para Stremio
                        group = "TV"
                        for cat, keywords in CATEGORIES.items():
                            if any(word in name_low for word in keywords):
                                group = cat
                                break
                        
                        # 3. Limpieza de nombre (quitar basura de las listas)
                        clean_name = re.sub(r'#EXTINF:-1.*?,', '', current_inf) # Extraer solo el nombre
                        clean_name = re.sub(r'\[.*?\]|\(.*?\)', '', clean_name).strip() # Quitar corchetes
                        
                        # Formatear línea final
                        combined_channels.append(f'#EXTINF:-1 group-title="{group}",{clean_name}\n{line}')
                        seen_urls.add(line)
        except:
            continue

    with open("mi_lista_privada.m3u", "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n" + "\n".join(combined_channels))
    print(f"Lista finalizada: {len(combined_channels)} canales únicos de alta calidad.")

if __name__ == "__main__":
    main()
