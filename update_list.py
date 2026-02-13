import requests
import re

# FUENTES: He añadido una fuente más específica para contenido en español
SOURCES = [
    "https://iptv-org.github.io/iptv/index.m3u",
    "https://raw.githubusercontent.com/guifre/iptv-es/master/lista.m3u", # España
    "https://raw.githubusercontent.com/freeiptvlatino/lista/main/cl.m3u"   # Latino
]

# FILTROS: Solo nos quedaremos con estos países y categorías
ALLOWED_COUNTRIES = ['AR', 'ES', 'MX', 'CL', 'CO'] # Argentina, España, México, Chile, Colombia
CATEGORIES = {
    'DEPORTES': ['deporte', 'sports', 'espn', 'fox sports', 'tyc', 'directv sports', 'tnt sports'],
    'CINE': ['pelicula', 'movie', 'cinema', 'hbo', 'starx', 'cinecanal'],
    'NIÑOS': ['nene', 'kids', 'disney', 'nick', 'cartoon'],
    'NOTICIAS': ['noticias', 'news', 'tn', 'c5n', 'bbc', 'cnn']
}

def main():
    combined_channels = []
    print("Iniciando filtrado inteligente...")

    for source in SOURCES:
        try:
            r = requests.get(source, timeout=10)
            lines = r.text.splitlines()
            
            current_inf = ""
            for line in lines:
                if line.startswith("#EXTINF"):
                    current_inf = line
                elif line.startswith("http"):
                    # 1. Filtro de País: Buscamos el código de país en la etiqueta tvg-country
                    country_match = re.search(r'tvg-country="([^"]+)"', current_inf)
                    country = country_match.group(1).upper() if country_match else ""
                    
                    # 2. Si no es de nuestros países permitidos, lo saltamos (excepto si es deporte internacional)
                    is_sports = any(word in current_inf.lower() for word in CATEGORIES['DEPORTES'])
                    
                    if country in ALLOWED_COUNTRIES or is_sports:
                        # 3. Asignar Categoría (Group-title)
                        group = "General"
                        for cat, keywords in CATEGORIES.items():
                            if any(word in current_inf.lower() for word in keywords):
                                group = cat
                                break
                        
                        # Limpiamos el group-title original y ponemos el nuestro
                        clean_inf = re.sub(r'group-title="[^"]+"', '', current_inf)
                        clean_inf = clean_inf.replace("#EXTINF:-1", f'#EXTINF:-1 group-title="{group}" tvg-country="{country}"')
                        
                        combined_channels.append(f"{clean_inf}\n{line}")
        except:
            continue

    with open("mi_lista_privada.m3u", "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        f.write("\n".join(combined_channels))
    
    print(f"Filtrado terminado. De 13k bajamos a {len(combined_channels)} canales de calidad.")

if __name__ == "__main__":
    main()
