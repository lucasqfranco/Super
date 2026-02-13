import requests
import re

SOURCES = [
    "https://iptv-org.github.io/iptv/index.m3u",
    "http://tv.m3uts.xyz/get.php?username=m&password=m&type=m3u_plus&output=ts" # Tu nueva fuente
]

# Filtros optimizados
ALLOWED_COUNTRIES = ['AR', 'ES', 'MX'] 
CATEGORIES = {
    'DEPORTES': ['deporte', 'sports', 'espn', 'fox', 'tyc', 'vix', 'tnt'],
    'CINE': ['pelicula', 'movie', 'hbo', 'star', 'cinema', 'cine', 'max'],
    'KIDS': ['kids', 'nene', 'disney', 'nick', 'cartoon']
}

def main():
    combined_channels = []
    print("Procesando fuentes...")

    for source in SOURCES:
        try:
            # Timeout largo porque el servidor m3uts puede ser lento
            r = requests.get(source, timeout=30)
            lines = r.text.splitlines()
            current_inf = ""
            for line in lines:
                if line.startswith("#EXTINF"):
                    current_inf = line
                elif line.startswith("http"):
                    # Lógica de filtrado: Argentina, España o Deportes
                    name = current_inf.lower()
                    is_arg = "ar |" in name or 'tvg-country="AR"' in current_inf
                    is_es = "es |" in name or 'tvg-country="ES"' in current_inf
                    is_sports = any(word in name for word in CATEGORIES['DEPORTES'])

                    if is_arg or is_es or is_sports:
                        # Asignar grupo para el Addon
                        group = "TV"
                        if any(word in name for word in CATEGORIES['CINE']): group = "CINE"
                        elif is_sports: group = "DEPORTES"
                        elif any(word in name for word in CATEGORIES['KIDS']): group = "NIÑOS"
                        
                        # Limpiar nombre (quitar prefijos como "AR |")
                        clean_name = re.sub(r'(AR|ES|MX)\s?\|\s?', '', current_inf, flags=re.IGNORECASE)
                        
                        combined_channels.append(f"{clean_name} group-title=\"{group}\"\n{line}")
        except Exception as e:
            print(f"Error en fuente: {e}")

    with open("mi_lista_privada.m3u", "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n" + "\n".join(combined_channels))
    print(f"Lista creada con {len(combined_channels)} canales.")

if __name__ == "__main__":
    main()
