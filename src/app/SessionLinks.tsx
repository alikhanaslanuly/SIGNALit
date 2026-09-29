import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { useUiStore } from './uiStore';

export function SessionLinks({ patientUrl, staffUrl }: { patientUrl: string; staffUrl: string }) {
  const ru = useUiStore(state => state.locale) === 'ru';
  const [feedback, setFeedback] = useState('');
  const qr = useMemo(() => {
    try { const code = qrcode(0, 'M'); code.addData(patientUrl); code.make(); const size = code.getModuleCount(); let path = '';
      for (let y=0;y<size;y++) for(let x=0;x<size;x++) if(code.isDark(y,x)) path+=`M${x+4},${y+4}h1v1h-1z`;
      return { path, size:size+8 };
    } catch { return null; }
  }, [patientUrl]);
  async function copy(value: string, id: string) {
    try { if(!navigator.clipboard) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(value); setFeedback(ru?'Ссылка скопирована':'Link copied'); }
    catch { const input=document.getElementById(id) as HTMLInputElement|null; input?.focus(); input?.select(); setFeedback(ru?'Ссылка выделена. Скопируйте вручную.':'Link selected. Copy it manually.'); }
  }
  return <div className="session-links">{[[ru?'Экран пациента':'Patient URL',patientUrl,'session-patient-url'],[ru?'Экран персонала':'Staff URL',staffUrl,'session-staff-url']].map(([label,url,id])=><div key={id}><label htmlFor={id}>{label}</label><input id={id} readOnly value={url} onFocus={event=>event.currentTarget.select()} /><button onClick={()=>void copy(url,id)}>{ru?'Скопировать':'Copy'} {label}</button></div>)}<p role="status">{feedback}</p>{qr&&<figure><svg role="img" aria-label={ru?'QR-код ссылки пациента':'Patient session QR code'} width="176" height="176" viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges"><rect width={qr.size} height={qr.size} fill="white"/><path d={qr.path} fill="black"/></svg><figcaption>{ru?'Для камеры на телефоне нужен доступный HTTPS-адрес. localhost указывает на само устройство.':'Phone camera access needs a reachable HTTPS address. localhost refers to the device itself.'}</figcaption></figure>}</div>;
}
