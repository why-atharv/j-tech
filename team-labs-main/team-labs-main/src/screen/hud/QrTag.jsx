import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

const cache = new Map();

export function qrDataUrl(text) {
  if (!cache.has(text)) {
    cache.set(text, QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 2, width: 480, color: { dark: '#000000', light: '#ffffff' } }));
    if (cache.size > 16) cache.delete(cache.keys().next().value);
  }
  return cache.get(text);
}

export function useQr(text) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    if (text) qrDataUrl(text).then((url) => live && setSrc(url));
    return () => {
      live = false;
    };
  }, [text]);
  return src;
}
