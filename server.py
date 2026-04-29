import http.server
import socketserver
import os

PORT = 8081

# Cambiamos al directorio del script para asegurarnos de servir los archivos correctos
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🚀 Servidor estático iniciado en: http://localhost:{PORT}")
        print(f"👉 Puedes ver el Home aquí: http://localhost:{PORT}/")
        print(f"👉 Puedes probar Conectar aquí: http://localhost:{PORT}/conectar/")
        print(f"👉 Puedes probar Reporte aquí: http://localhost:{PORT}/reporte/")
        print("\nOprime Ctrl+C para detener el servidor.")
        httpd.serve_forever()
except OSError as e:
    if e.errno == 98:
        print(f"❌ El puerto {PORT} ya está en uso. Intenta cerrando otros servidores o cambia el PORT en el script.")
    else:
        print(f"❌ Error al iniciar el servidor: {e}")
except KeyboardInterrupt:
    print("\n🛑 Servidor detenido. ¡Hasta pronto!")
