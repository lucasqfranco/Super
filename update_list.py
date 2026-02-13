import requests
import re

# Fuentes de ejemplo (puedes añadir más)
SOURCES = [
    "https://iptv-org.github.io/iptv/index.m3u",
    "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8"
]

VOD_KEYWORDS = ['Película', 'Movie', '2023', '2024', 'Cinema', 'Pelicula']

def validate_link(url):
    try:
        # Realizamos una petición HEAD para no descargar todo el video, solo ver el estado
        response = requests.head(url, timeout=5, allow_redirects=True)
        return response.status_code == 200
    except:
        return False

def main():
    combined_channels = []
    print("Iniciando procesamiento de listas...")

    for source in SOURCES:
        try:
            r = requests.get(source, timeout=10)
            lines = r.text.splitlines()
            
            current_inf = ""
            for line in lines:
                if line.startswith("#EXTINF"):
                    current_inf = line
                elif line.startswith("http"):
                    # Es un link, procesamos el canal anterior
                    name_match = re.search(r',(.+)$', current_inf)
                    channel_name = name_match.group(1) if name_match else "Sin Nombre"
                    
                    # Clasificación VOD vs TV
                    category = "TV"
                    if any(word.lower() in current_inf.lower() or word.lower() in channel_name.lower() for word in VOD_KEYWORDS):
                        category = "VOD"
                    
                    # Validación (Solo si quieres una lista ultra limpia, esto tarda un poco)
                    # if validate_link(line): 
                    
                    # Añadir metadato de grupo si no existe
                    if 'group-title="' not in current_inf:
                        current_inf = current_inf.replace("#EXTINF:-1", f'#EXTINF:-1 group-title="{category}"')
                    else:
                        # Forzar la categoría según nuestras reglas
                        current_inf = re.sub(r'group-title="[^"]+"', f'group-title="{category}"', current_inf)
                    
                    combined_channels.append(f"{current_inf}\n{line}")
        except Exception as e:
            print(f"Error procesando {source}: {e}")

    # Generar archivo de salida
    with open("mi_lista_privada.m3u", "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        f.write("\n".join(combined_channels))
    
    print(f"Proceso finalizado. Se encontraron {len(combined_channels)} canales.")

if __name__ == "__main__":
    main()