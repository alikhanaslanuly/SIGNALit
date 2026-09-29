import { describe, it, expect, vi } from 'vitest';
import { correctionFinger, FINGER_LANDMARKS } from '../core/vision/correction';
import { drawHandFrame } from '../core/vision/draw';
import { getHintText, getText } from '../ui/i18n';
import type { Finger } from '../core/vision/types';
import { MockEngine } from '../core/mock/mockEngine';
import { MemoryTransport } from '../transport';
import { SignalSession } from './session';
import * as audio from '../audio/feedback';

describe('Experience preservation regressions',()=>{
 it.each(['HELP','PAIN'] as const)('%s → cancellation context → NO cancels without timing changes',async gesture=>{
  let now=1000;const engine=new MockEngine();const session=new SignalSession({engine,transport:new MemoryTransport(),mode:'mock',now:()=>now,makeId:()=>String(now)});
  await session.start();engine.emitConfirmed(gesture);expect(session.snapshot.dialog).toMatchObject({phase:'CANCEL_WINDOW',cancelUntil:6000});
  now=2000;engine.emitConfirmed('NO');expect(session.snapshot.dialog.activeRequest).toBeNull();expect(session.snapshot.dashboard.requests[0].status).toBe('CANCELLED');session.dispose();
 });
 it.each(Object.keys(FINGER_LANDMARKS) as Finger[])('%s text, finger ID and rendered landmarks match in both locales',finger=>{
  for(const code of ['EXTEND_FINGER','FOLD_FINGER']) {
   const hint={code,params:{finger},layer:3 as const,severity:'warn' as const};
   expect(correctionFinger(hint,'none')).toBe(finger);
   for(const locale of ['ru','en'] as const) expect(getHintText(locale,hint)).toContain(getText(locale).fingers[finger]);
   for(const mirror of [false,true]) {
    const lines:Array<{color:string,start:number,end:number}>=[];let start=0,end=0;
    const ctx={strokeStyle:'',fillStyle:'',lineWidth:0,clearRect(){},beginPath(){},moveTo(x:number){start=x;},lineTo(x:number){end=x;},stroke(){lines.push({color:this.strokeStyle,start,end});},arc(){},fill(){}};
    const canvas={width:640,height:480,getContext:()=>ctx} as unknown as HTMLCanvasElement;
    drawHandFrame(canvas,{width:640,height:480,brightness:.5,handedness:'Left',timestampMs:0,landmarks:Array.from({length:21},(_,i)=>({x:i/21,y:.5,z:0}))},mirror,{finger,state:'correcting'});
    const highlighted=lines.filter(line=>line.color==='#ffbd45');expect(highlighted).toHaveLength(3);
    const x=(i:number)=>(mirror?1-i/21:i/21)*640;
    highlighted.forEach((line,i)=>{expect(line.start).toBeCloseTo(x(FINGER_LANDMARKS[finger][i]));expect(line.end).toBeCloseTo(x(FINGER_LANDMARKS[finger][i+1]));});
   }
  }
 });
 it('candidate, hold, tick and locale changes do not speak; disabling sound cancels speech',async()=>{
  const speak=vi.spyOn(audio,'speakFeedback').mockImplementation(()=>{});const sound=vi.spyOn(audio,'playFeedbackSound').mockImplementation(()=>{});const cancel=vi.fn();vi.stubGlobal('window',{speechSynthesis:{cancel}});
  const engine=new MockEngine();const session=new SignalSession({engine,transport:new MemoryTransport(),mode:'mock'});
  try {
   session.setAudioEnabled(true);await session.start();engine.emitCandidate('HELP');
   for(let i=0;i<10;i++){engine.emitHolding('HELP',i/10);session.tick();}
   session.setLocale('en');expect(speak).not.toHaveBeenCalled();expect(sound).not.toHaveBeenCalled();
   engine.emitConfirmed('HELP');expect(speak).toHaveBeenCalledTimes(1);
   session.tick();session.setLocale('ru');expect(speak).toHaveBeenCalledTimes(1);
   session.setAudioEnabled(false);expect(cancel).toHaveBeenCalledOnce();
  } finally {session.dispose();vi.restoreAllMocks();vi.unstubAllGlobals();}
 });
});
