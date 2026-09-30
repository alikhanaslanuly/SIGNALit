import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { useUiStore } from './uiStore';

export function SessionLinks({ patientUrl }: { patientUrl: string; staffUrl?: string }) {
  const ru = useUiStore(state => state.locale) === 'ru';
  const qr = useMemo(() => {
    try {
      const code = qrcode(0, 'M');
      code.addData(patientUrl);
      code.make();
      const size = code.getModuleCount();
      let path = '';
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (code.isDark(y, x)) path += `M${x + 4},${y + 4}h1v1h-1z`;
      return { path, size: size + 8 };
    } catch {
      return null;
    }
  }, [patientUrl]);

  return (
    <div className="session-links">
      {qr && (
        <figure className="qr-container">
          <svg role="img" aria-label={ru ? 'QR-код ссылки пациента' : 'Patient session QR code'} width="160" height="160" viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges">
            <rect width={qr.size} height={qr.size} fill="white" />
            <path d={qr.path} fill="black" />
          </svg>
          <figcaption>{ru ? 'QR-код сессии пациента' : 'Patient session QR code'}</figcaption>
        </figure>
      )}
    </div>
  );
}
