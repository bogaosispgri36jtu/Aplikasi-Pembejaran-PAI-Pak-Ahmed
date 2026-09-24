// Generator & parser data TTD guru untuk laporan PDF resmi

/**
 * Mengubah berbagai format URL Google Drive menjadi URL langsung gambar (Direct Image URL)
 */
export const formatGoogleDriveImageUrl = (rawUrl: string): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  // Jika sudah berupa data URL base64 atau link non-drive biasa, kembalikan langsung
  if (trimmed.startsWith('data:image/')) return trimmed;

  // Ekstrak file ID dari berbagai variasi URL Google Drive
  let fileId = '';

  const driveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (driveMatch && driveMatch[1]) {
    fileId = driveMatch[1];
  } else {
    const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
    if (idParamMatch && idParamMatch[1]) {
      fileId = idParamMatch[1];
    } else {
      const openMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i);
      if (openMatch && openMatch[1]) {
        fileId = openMatch[1];
      }
    }
  }

  // Jika terdeteksi file ID Google Drive, gunakan Google CDN direct viewer (lh3.googleusercontent.com)
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return trimmed;
};

/**
 * Mencoba memuat gambar dari URL dan mengonversinya ke Base64 PNG
 */
const loadImageAsDataUrl = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 400;
        canvas.height = img.naturalHeight || img.height || 200;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (err) {
        // Jika canvas ter-taint karena CORS tapi img berhasil dimuat,
        // kita coba kembalikan src langsung (jsPDF bisa menerima HTMLImageElement atau URL langsung)
        resolve(src);
      }
    };
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
};

/**
 * Mengambil data gambar TTD guru:
 * 1. Cek custom base64 / URL di localStorage
 * 2. Coba direct CDN Google Drive
 * 3. Fallback alternatif Google Drive thumbnail jika format pertama gagal
 * 4. Fallback ke kaligrafi TTD resmi Ahmad Nawasyi, S.Pd
 */
export const getTeacherSignatureDataUrl = async (): Promise<string> => {
  const saved = localStorage.getItem('teacher_signature_url');
  if (saved && saved.trim()) {
    const trimmed = saved.trim();

    // 1. Jika sudah base64 data URL
    if (trimmed.startsWith('data:image/')) {
      return trimmed;
    }

    // 2. Ekstrak file ID Google Drive jika ada
    let fileId = '';
    const driveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
    if (driveMatch && driveMatch[1]) {
      fileId = driveMatch[1];
    } else {
      const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
      if (idParam && idParam[1]) fileId = idParam[1];
    }

    const candidateUrls: string[] = [];
    if (fileId) {
      candidateUrls.push(`https://lh3.googleusercontent.com/d/${fileId}`);
      candidateUrls.push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`);
      candidateUrls.push(`https://drive.google.com/uc?export=view&id=${fileId}`);
    } else if (trimmed.startsWith('http')) {
      candidateUrls.push(trimmed);
    }

    // Coba setiap kandidat direct image URL
    for (const url of candidateUrls) {
      try {
        const dataUrl = await loadImageAsDataUrl(url);
        if (dataUrl) return dataUrl;
      } catch (e) {
        // Coba url berikutnya
      }
    }
  }

  // 3. Render TTD resmi Ahmad Nawasyi, S.Pd (vektor kaligrafi sesuai TTD AHMED 2.png)
  return getOfficialAhmedSignatureCanvas();
};

/**
 * Vektor kaligrafi resmi TTD Ahmad Nawasyi, S.Pd
 */
export const getOfficialAhmedSignatureCanvas = (): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 750;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.strokeStyle = '#0a0a0a';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Garis awal lengkung halus
  ctx.lineWidth = 5.2;
  ctx.beginPath();
  ctx.moveTo(40, 245);
  ctx.bezierCurveTo(65, 275, 105, 280, 130, 235);
  ctx.bezierCurveTo(150, 200, 170, 230, 195, 260);
  ctx.bezierCurveTo(225, 290, 260, 275, 285, 220);
  
  // Tarikan loop lonjong khas
  ctx.bezierCurveTo(310, 150, 335, 65, 365, 25);
  ctx.bezierCurveTo(385, 5, 415, 10, 425, 45);
  ctx.bezierCurveTo(435, 90, 410, 165, 375, 230);
  ctx.bezierCurveTo(345, 285, 315, 305, 295, 295);
  ctx.bezierCurveTo(275, 280, 280, 250, 310, 225);
  ctx.bezierCurveTo(335, 200, 368, 218, 390, 258);
  ctx.bezierCurveTo(408, 290, 435, 290, 460, 255);
  ctx.stroke();

  // Sambungan tengah ke arah huruf kanan
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(455, 258);
  ctx.bezierCurveTo(478, 238, 502, 245, 520, 272);
  ctx.stroke();

  // Garis vertikal tegak khas di sebelah kanan
  ctx.lineWidth = 5.8;
  ctx.beginPath();
  ctx.moveTo(555, 22);
  ctx.lineTo(470, 325);
  ctx.stroke();

  // Lekukan balik dari bawah garis vertikal ke atas
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.moveTo(470, 325);
  ctx.bezierCurveTo(495, 285, 525, 220, 555, 145);
  ctx.stroke();

  // Garis horizontal tajam memotong
  ctx.lineWidth = 5.6;
  ctx.beginPath();
  ctx.moveTo(435, 155);
  ctx.bezierCurveTo(500, 140, 580, 130, 685, 118);
  ctx.stroke();

  return canvas.toDataURL('image/png');
};
