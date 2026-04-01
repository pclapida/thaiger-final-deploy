import time
import requests
import urllib.parse
import os
from playwright.sync_api import sync_playwright
from supabase import create_client, Client
import sys
import warnings
from duckduckgo_search import DDGS

warnings.filterwarnings('ignore', message='Unverified HTTPS request')

# Claves leídas desde variables de entorno (configura SUPABASE_URL y SUPABASE_SERVICE_KEY)
url = os.environ.get("SUPABASE_URL", "TU_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY", "TU_SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

def traducir_espanol(texto_ingles):
    """Traduce un bloque de texto usando la API pública gratuita de Google Translate sin keys."""
    if not texto_ingles or len(texto_ingles) < 5: return texto_ingles
    try:
        api_url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=" + urllib.parse.quote(texto_ingles)
        res = requests.get(api_url, timeout=7)
        if res.status_code == 200:
            datos = res.json()
            # Google parte la traducción por oraciones. Las concatenamos todas.
            return "".join([fragment[0] for fragment in datos[0] if fragment[0]])
    except Exception as e:
        print(f"    [!] Fallo del traductor: {e}")
    return texto_ingles # Fallback en caso de ban


def get_bing_image_url(page, query):
    """ Busca en Bing Imágenes manipulando una ventana Chromium real y extrae la URL de la primera foto. """
    encoded_query = urllib.parse.quote(query)
    search_url = f"https://www.bing.com/images/search?q={encoded_query}"
    
    try:
        # Ir a la página y esperar que el navegador reciba algo
        page.goto(search_url, wait_until="domcontentloaded", timeout=12000)
        
        # Le damos un instante extra al javascript para montar las fotos del grid
        time.sleep(2) 
        
        # Sacar todas las imágenes tipo miniatura de Bing (suelen tener clase mimg)
        img_elements = page.query_selector_all('img.mimg')
        
        for img in img_elements:
            src = img.get_attribute("src") or img.get_attribute("data-src")
            
            # Bing aloja sus miniaturas en tse1.mm.bing.net o similares. Nos funciona perfecto porque son links HTTP reales.
            if src and src.startswith("http"):
                # Si encontramos un link http crudo de imagen, lo regresamos.
                return src
                
    except Exception as e:
        print(f"  -> Error buscando en Bing: {e}")
        
    return None

def main():
    print("Obteniendo productos de Supabase para llenar Fotografías y Textos...")
    try:
        response = supabase.table("products").select("id, brand, name, image_url, description").execute()
        products = response.data
    except Exception as e:
        print("Error conectando a Supabase:", e)
        sys.exit(1)

    updated_images = 0
    updated_texts = 0
    failed_count = 0

    print(f"Total de productos en la BD: {len(products)}")

    # Aquí empieza la magia: Lanzamos Google Chromium en 2do Plano Oculto
    with sync_playwright() as p:
        print("Iniciando motor de Bing en Chromium (Ventana Oculta)...")
        browser = p.chromium.launch(headless=True)
        # Contexto de navegador que finge ser un Windows 10 con Chrome regular
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        for i, proj in enumerate(products):
            needs_image = not (proj.get("image_url") and str(proj["image_url"]).startswith("http") and "placehold.co" not in proj["image_url"])
            
            # Buscaremos texto si no hay, o si el que hay no contiene nuestra frase clave corporativa
            needs_text = not proj.get("description") or "INFORMACIÓN CLÍNICA" not in str(proj["description"])

            if not needs_image and not needs_text:
                continue

            print(f"\n[{i+1}/{len(products)}] Procesando: '{proj['name']}'...")
            
            # PARTE 1: OBTENER DESCRIPCIONES DE TEXTO (Puro request rápido)
            if needs_text:
                print("  -> Buscando y Traduciendo texto descriptivo...")
                texto_descripcion = ""
                try:
                    with DDGS() as ddgs:
                        text_res = list(ddgs.text(f"What is {proj['brand']} {proj['name']} supplement details benefits reviews", max_results=4))
                        if text_res:
                            # Formateamos todo en un súper bloque de texto muy comercial, traduciéndolo al vuelo
                            snippets_traducidos = []
                            for r in text_res:
                                trad = traducir_espanol(r['body'])
                                snippets_traducidos.append(f"- {trad.strip()}")
                                
                            snippets = "\n\n".join(snippets_traducidos)
                            
                            texto_descripcion = f"{proj['name'].upper()} PRO-SERIES: LA EXCELENCIA DE {proj['brand'].upper()}\n\n"
                            texto_descripcion += f"Diseñado en los laboratorios de grado premium de {proj['brand']}, este producto ha sido formulado para atletas que buscan romper el límite del rendimiento físico. Sin fórmulas mágicas, aplicando la ciencia y biodisponibilidad correcta para tu cuerpo.\n\n"
                            texto_descripcion += f"INFORMACIÓN CLÍNICA Y BENEFICIOS:\n{snippets}\n\n"
                            texto_descripcion += f"PROTOCOLOS DE CONSUMO:\n- Utilizar conforme a los requerimientos calóricos o de entrenamiento diario.\n- Formulación respaldada bajo estrictos controles sanitarios por {proj['brand']}.\n- Para posología o porciones exactas, validar la etiqueta física impresa al reverso del envase adquirido."
                except Exception as text_e:
                    print(f"  -> DDG no devolvió texto: {text_e}")
                
                if len(texto_descripcion) > 50:
                    supabase.table("products").update({"description": texto_descripcion[:1800]}).eq("id", proj["id"]).execute()
                    print(f"  -> [EXITO] Súper-Descripción en Español 🇲🇽 guardada en BD.")
                    updated_texts += 1

            # PARTE 2: OBTENER FOTOS POR CHROMIUM (Si lo necesita)
            if needs_image:
                queries = [
                    f"{proj['brand']} {proj['name']} supplement jar container",
                    f"{proj['brand']} {proj['name']} supplement",
                    f"{proj['name']}"
                ]
            
                img_url = None
                try:
                    for q in queries:
                        print(f"  -> Evaluando Búsqueda: {q}")
                        img_url = get_bing_image_url(page, q)
                        if img_url:
                            break # Encontramos un src bueno, ya no probamos las búsquedas simples
                except Exception as browser_crash:
                    print(f"  -> [CRACK] El navegador falló o fue cerrado: {browser_crash}")
                    print("  -> Reiniciando Chromium en caliente...")
                    try: browser.close()
                    except: pass
                    browser = p.chromium.launch(headless=True)
                    context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
                    page = context.new_page()
                    continue
                
                # 3. Descargar y subir a Supabase Storage
                if img_url:
                    print(f"  -> Detectada Imagen: {img_url[:70]}...")
                    headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "image/*" }
                    try:
                        img_response = requests.get(img_url, headers=headers, timeout=10, verify=False) 
                        
                        if img_response.status_code == 200:
                            file_ext = img_url.split('.')[-1].split('?')[0].lower()
                            if file_ext not in ['jpg', 'jpeg', 'png', 'webp', 'avif']:
                                file_ext = 'jpg'
                            
                            file_name = f"scraped_{proj['id']}_{int(time.time())}.{file_ext}"
                            mime_type = "image/jpeg" if file_ext == "jpg" else f"image/{file_ext}"
                            
                            print(f"  -> Subiendo al Bucket 'product-images' como {file_name}...")
                            supabase.storage.from_("product-images").upload(file_name, img_response.content, {"content-type": mime_type})
                            public_url = supabase.storage.from_("product-images").get_public_url(file_name)
                            
                            print(f"  -> Guardando URL en la BD...")
                            supabase.table("products").update({"image_url": public_url}).eq("id", proj["id"]).execute()
                            
                            print(f"  -> [EXITO] Fotografía de {proj['name']} actualizada con Chromium 🔥.")
                            updated_images += 1
                        else:
                            print(f"  -> [ERROR] No puedo descargar ese enlace HTTP {img_response.status_code}.")
                            failed_count += 1
                    
                    except Exception as upload_error:
                        print(f"  -> [ERROR] Falló la manipulación de base de datos: {upload_error}")
                        failed_count += 1
                else:
                    print(f"[AVISO] Bing Images escondió las fotos o falló la búsqueda.")
                    failed_count += 1
                
            # Random sleep corto de seguridad para no asustar bloqueos
            if needs_image or needs_text:
                time.sleep(2)
            
        print("\nCerrando navegador Chromium seguro...")
        browser.close()

    print("======================================")
    print(f"¡Scraping terminado! ✅ Fotografías: {updated_images}, ✍️ Textos: {updated_texts}, ❌ Errores: {failed_count}")

if __name__ == "__main__":
    main()
