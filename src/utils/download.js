export function descargarArchivo(data, filename, mimeType = 'application/octet-stream') {
  try {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);

    const mensaje = document.createElement('div');
    mensaje.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #22c55e;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      z-index: 9999;
      font-size: 14px;
      font-family: 'Segoe UI', sans-serif;
      max-width: 380px;
      animation: slideIn 0.3s ease;
    `;
    mensaje.innerHTML = `✅ <strong>Descarga completada</strong><br><span style="font-size:12px;opacity:0.9;">${filename}</span>`;
    document.body.appendChild(mensaje);

    setTimeout(() => {
      mensaje.style.opacity = '0';
      mensaje.style.transition = 'opacity 0.5s ease';
      setTimeout(() => mensaje.remove(), 500);
    }, 4000);
  } catch (e) {
    console.error('Error en descarga:', e);
    alert('❌ Error al preparar la descarga:\n' + e.message);
  }
}
