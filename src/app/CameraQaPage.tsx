import { useEffect, useRef, useState } from 'react';
import type { GestureId, Hint, Recognition } from '../contracts';
import { VisionEngine } from '../core/vision';
import type { HandFrame } from '../core/vision/types';
import { FINGER_LANDMARKS } from '../core/vision/correction';
import { cameraFailure } from '../core/vision/cameraFailure';
import { SignalEngineAdapter } from './visionAdapter';
import { cameraCopy } from './SystemCheck';
import { getHintText, getText, type Locale } from '../ui/i18n';
import { useUiStore } from './uiStore';
import { QaAttempt, QA_GESTURES, downloadQa, exportQa, passed, qaCsv, qaSummary, type QaContext, type QaMeasurement, type QaResult } from './cameraQaModel';
import { qaEn, qaRu } from './cameraQaCopy';
import { buildLabel } from './buildInfo';
import './cameraQa.css';

function fingerLabels(canvas: HTMLCanvasElement, frame: HandFrame | null, locale: Locale) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  if (frame) { canvas.width = frame.width; canvas.height = frame.height; }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (!frame || frame.landmarks.length !== 21) return;
  ctx.font = '14px system-ui'; ctx.textBaseline = 'middle';
  for (const [finger, chain] of Object.entries(FINGER_LANDMARKS)) {
    const point = frame.landmarks[chain[3]]; if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const label = getText(locale).fingers[finger as keyof typeof FINGER_LANDMARKS]; const width = ctx.measureText(label).width + 12;
    const x = Math.max(2,Math.min(canvas.width-width-2,(1-point.x)*canvas.width+8)); const y = Math.max(14,Math.min(canvas.height-14,point.y*canvas.height));
    ctx.fillStyle='#fff';ctx.fillRect(x,y-11,width,22);ctx.fillStyle='#172e3b';ctx.fillText(label,x+6,y);
  }
}
const emptyRecognition: Recognition = { gesture:null, confidence:0, state:'none', holdProgress:0 };
const initialReview = { correct:'', alignment:'', false:'', notes:'' };
export function CameraQaPage() {
  const locale = useUiStore(value => value.locale); const localeRef = useRef(locale); localeRef.current = locale;
  const t = locale === 'ru' ? qaRu : qaEn; const all = getText(locale);
  const [mode,setMode] = useState<'fast'|'extended'>('fast');
  const [context,setContext] = useState<QaContext>({ device:'', browser:typeof navigator === 'undefined' ? '' : navigator.userAgent.slice(0,200),camera:'unknown',detectedCamera:'unknown',hand:'Right',lighting:'good',distance:'normal' });
  const [expected,setExpected] = useState<GestureId>('YES'); const [running,setRunning] = useState(false); const [starting,setStarting] = useState(false); const [error,setError] = useState<string|null>(null);
  const [rows,setRows] = useState<QaResult[]>([]); const [phase,setPhase] = useState<'idle'|'recording'|'review'>('idle'); const [measurement,setMeasurement] = useState<QaMeasurement|null>(null); const [review,setReview] = useState(initialReview);
  const video = useRef<HTMLVideoElement>(null); const canvas = useRef<HTMLCanvasElement>(null); const labels = useRef<HTMLCanvasElement>(null);
  const engine = useRef<SignalEngineAdapter|null>(null); const clean = useRef<()=>void>(()=>{}); const attempt = useRef<QaAttempt|null>(null); const epoch = useRef(0);
  const metrics = useRef({ recognition:emptyRecognition, hint:null as Hint|null, hand:null as HandFrame['handedness'], visible:false, frames:0, since:0, fps:null as number|null });
  const [live,setLive] = useState({ ...metrics.current });
  useEffect(() => { const timer = setInterval(() => {
    const now = performance.now(); const value = metrics.current;
    if (now-value.since>=1000) { value.fps = running ? value.frames*1000/(now-value.since) : null;value.frames=0;value.since=now; }
    setLive({...value}); if (attempt.current) setMeasurement(attempt.current.snapshot(now));
  },250); return()=>clearInterval(timer); },[running]);
  useEffect(()=>()=>{epoch.current++;attempt.current=null;clean.current();engine.current?.dispose();},[]);
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(rows.length || phase!=='idle'){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[rows.length,phase]);
  const finish = (interrupted=false) => { if(!attempt.current)return; if(interrupted)attempt.current.interrupt();setMeasurement(attempt.current.snapshot(performance.now()));attempt.current=null;setPhase('review'); };
  const stop = () => { finish(true);epoch.current++;clean.current();engine.current?.dispose();engine.current=null;setRunning(false);setStarting(false);metrics.current.fps=null;metrics.current.visible=false;metrics.current.hand=null;metrics.current.recognition=emptyRecognition;metrics.current.hint=null;for(const surface of [canvas.current,labels.current])surface?.getContext('2d')?.clearRect(0,0,surface.width,surface.height); };
  const startCamera = async () => {
    stop(); const token=++epoch.current;setStarting(true);setError(null);metrics.current.since=performance.now();metrics.current.frames=0;
    const vision=new VisionEngine(video.current!,{baseUrl:import.meta.env.BASE_URL}); const adapter=new SignalEngineAdapter(vision,canvas.current);engine.current=adapter;
    const off=[vision.onFrame(frame=>{metrics.current.frames++;metrics.current.hand=frame?.handedness??null;metrics.current.visible=Boolean(frame);attempt.current?.frame(Boolean(frame),frame?.handedness??null);if(labels.current)fingerLabels(labels.current,frame,localeRef.current);}),
      adapter.onRecognition(value=>{metrics.current.recognition=value;attempt.current?.recognition(value,performance.now());}),
      adapter.onHints(hints=>{metrics.current.hint=hints[0]??null;attempt.current?.hint(hints[0]??null);}),
      adapter.onError(value=>{if(epoch.current!==token)return;setError(cameraFailure(value));finish(true);setRunning(false);setStarting(false);})];
    clean.current=()=>off.forEach(unsubscribe=>unsubscribe());
    try {await adapter.start();if(token===epoch.current){setRunning(true);const track=(video.current?.srcObject as MediaStream|null)?.getVideoTracks()[0];setContext(previous=>({...previous,detectedCamera:track?.getSettings().facingMode??'unknown'}));}}
    catch { /* Engine callback provides the recovery message. */ } finally {if(token===epoch.current)setStarting(false);}
  };
  const begin = () => { if(!running || phase!=='idle')return;setReview(initialReview);engine.current?.setContext({target:expected});attempt.current=new QaAttempt(expected,{...context},performance.now());setMeasurement(attempt.current.snapshot(performance.now()));setPhase('recording'); };
  const save = () => { if(!measurement || !review.correct || !review.alignment || !review.false)return;setRows(previous=>[...previous,{...measurement,review:{correctRecognition:review.correct==='yes',fingerAlignment:review.alignment as 'yes'|'no'|'na',falseConfirmation:review.false==='yes',notes:review.notes.trim().slice(0,500)}}]);setMeasurement(null);setPhase('idle');setExpected(QA_GESTURES[(QA_GESTURES.indexOf(expected)+1)%QA_GESTURES.length]); };
  const summary=qaSummary(rows,mode,context.hand); const fault=error?cameraCopy(error,locale):null;
  const choice=(name:keyof QaContext,values:string[]) => <label>{name==='lighting'?t.light:name==='hand'?t.hand:name==='camera'?t.camera:t.distance}<select disabled={name==='hand'&&mode==='fast'&&rows.length>0} value={context[name]} onChange={event=>setContext(previous=>({...previous,[name]:event.target.value}))}>{values.map(value=><option key={value} value={value}>{t[value as keyof typeof t]??value}</option>)}</select></label>;
  return <section className="camera-qa"><a href="/dashboard/quality">← {t.back}</a><h1>{t.title}</h1><p>{t.intro}</p><small>{t.build}: {buildLabel}</small>
    <fieldset className="qa-context" disabled={phase!=='idle'}><legend>{t.mode}</legend><label>{t.mode}<select value={mode} disabled={rows.length>0} onChange={event=>setMode(event.target.value as typeof mode)}><option value="fast">{t.fast}</option><option value="extended">{t.extended}</option></select></label>
      <label>{t.device}<input maxLength={80} value={context.device} disabled={rows.length>0} onChange={event=>setContext(previous=>({...previous,device:event.target.value}))}/></label>
      <label>{t.browser}<input maxLength={200} value={context.browser} disabled={rows.length>0} onChange={event=>setContext(previous=>({...previous,browser:event.target.value}))}/></label>
      {choice('camera',['unknown','laptop','front','rear'])}{choice('hand',['Right','Left'])}{choice('lighting',['good','medium','poor'])}{choice('distance',['normal','close','far'])}</fieldset>
    <p className="muted">{t.frozen}</p><div className="staff-actions"><button onClick={()=>void startCamera()} disabled={starting||running}>{starting?all.product.loading:t.startCamera}</button>{(running||starting)&&<button onClick={stop}>{t.stopCamera}</button>}</div>
    {fault&&<div className="staff-error" role="alert"><strong>{fault.title}</strong><p>{fault.help}</p></div>}
    <div className="qa-workspace"><div><div className="qa-camera"><video ref={video} autoPlay muted playsInline/><canvas ref={canvas} aria-hidden="true"/><canvas ref={labels} aria-hidden="true"/>{!running&&<p>{starting?all.startingCamera:all.product.cameraOff}</p>}</div><p>{t.alignmentHelp}</p><p>{t.detected}: <strong>{live.hand?t[live.hand]:'—'}</strong> · {live.visible?t.tracking:t.noHand}</p><p>{t.detectedCamera}: {t[context.detectedCamera as keyof typeof t] ?? context.detectedCamera}</p></div>
      <section className="staff-panel qa-attempt"><label>{t.expected}<select value={expected} disabled={phase!=='idle'} onChange={event=>setExpected(event.target.value as GestureId)}>{QA_GESTURES.map(gesture=><option key={gesture} value={gesture}>{all.gestures[gesture].label}</option>)}</select></label><h2>{all.gestures[expected].icon} {all.gestures[expected].label}</h2><p>{all.gestureHints[expected]}</p><p>{t.instruction}</p>
        <div className="qa-hint" role="status">{!running?all.product.cameraOff:live.hint?getHintText(locale,live.hint):all.product.cameraReady}</div>
        <dl><div><dt>{t.candidate}</dt><dd>{live.recognition.gesture ? all.gestures[live.recognition.gesture].label : '—'} · {t[({none:'recognitionNone',candidate:'recognitionCandidate',holding:'recognitionHolding',confirmed:'recognitionConfirmed'} as const)[live.recognition.state]]}</dd></div><div><dt>{t.fps}</dt><dd>{live.fps?.toFixed(1)??'—'}</dd></div><div><dt>{t.confirmed}</dt><dd>{measurement?.confirmations.map(value=>all.gestures[value.gesture].label).join(', ')||'—'}</dd></div><div><dt>{t.visible}</dt><dd>{measurement?.handVisibleRatio==null?'—':`${Math.round(measurement.handVisibleRatio*100)}%`}</dd></div><div><dt>{t.elapsed}</dt><dd>{measurement?`${(measurement.durationMs/1000).toFixed(1)} ${all.product.secondsShort}`:'—'}</dd></div><div><dt>{t.corrections}</dt><dd>{measurement?.corrections.map(value=>`${getHintText(locale,{code:value.code,params:value.finger?{finger:value.finger}:{},layer:3,severity:'info'})} ×${value.count}`).join(', ')||'—'}</dd></div></dl>
        {phase==='idle'&&<button className="staff-primary" disabled={!running||!context.device.trim()||!context.browser.trim()} onClick={begin}>{t.start}</button>}{phase==='recording'&&<button className="staff-primary" onClick={()=>finish()}>{t.finish}</button>}
        {!running&&phase==='idle'&&<p>{t.cameraNeeded}</p>}
      </section></div>
    {phase==='review'&&<section className="staff-panel qa-review"><h2>{t.review} · {measurement?.expected}</h2>{measurement?.interrupted&&<p role="alert">{t.interrupted}</p>}
      {(['correct','alignment','false'] as const).map(key=><label key={key}>{t[key]}<select value={review[key]} onChange={event=>setReview(previous=>({...previous,[key]:event.target.value}))}><option value="">{t.choose}</option><option value="yes">{t.yes}</option><option value="no">{t.no}</option>{key==='alignment'&&<option value="na">{t.na}</option>}</select></label>)}
      <label>{t.notes}<textarea maxLength={500} value={review.notes} onChange={event=>setReview(previous=>({...previous,notes:event.target.value}))}/></label><button className="staff-primary" disabled={!review.correct||!review.alignment||!review.false} onClick={save}>{t.save}</button><button onClick={()=>{setMeasurement(null);setPhase('idle');}}>{t.discard}</button></section>}
    <section className="staff-panel qa-summary"><h2>{t.summary}</h2><p className={summary.ready?'qa-ready':'qa-review-needed'} role="status">{summary.ready?t.ready:t.needsReview}</p><p>{t.summaryHelp}</p>
      <dl className="qa-summary-grid">{[[t.attempts,summary.attempts],[t.gestures,`${summary.checked} / ${summary.required}`],[t.success,`${summary.confirmed} / ${summary.attempts}`],[t.falseCount,summary.falseConfirmations],[t.alignCount,`${summary.alignmentPassed} / ${summary.alignmentChecks}`],[t.meanTime,summary.averageConfirmationMs===null?'—':`${(summary.averageConfirmationMs/1000).toFixed(2)} s`],[t.meanFps,summary.averageFps?.toFixed(1)??'—'],[t.helpCheck,summary.helpAligned?t.yes:t.no]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {rows.length?<div className="qa-results">{rows.map((row,index)=><p key={index}>{index+1}. {row.expected} · {t[row.context.hand]} · {t[row.context.lighting]} · {t[row.context.distance]} — <strong>{passed(row)?t.ready:t.needsReview}</strong></p>)}</div>:<p>{t.noResults}</p>}
      <div className="staff-actions"><button disabled={!rows.length} onClick={()=>downloadQa(JSON.stringify(exportQa(rows,mode,context.hand,buildLabel),null,2),'json')}>{t.json}</button><button disabled={!rows.length} onClick={()=>downloadQa(qaCsv(rows),'csv')}>{t.csv}</button><button disabled={phase!=='idle'} onClick={()=>{if(!rows.length||window.confirm(t.confirmReset)){setRows([]);setMeasurement(null);setExpected('YES');}}}>{t.newRun}</button></div><p>{t.storage}</p>
    </section>
  </section>;
}
