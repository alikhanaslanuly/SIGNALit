import { describe,it,expect } from 'vitest';
import { QaAttempt, QA_GESTURES, qaSummary, qaCsv, exportQa, type QaContext, type QaResult } from './cameraQaModel';
import type { GestureId } from '../contracts';
const context:QaContext={device:'Demo laptop',browser:'Chrome',camera:'laptop',detectedCamera:'unknown',hand:'Right',lighting:'good',distance:'normal'};
function result(gesture:GestureId='HELP'):QaResult {
 const attempt=new QaAttempt(gesture,context,0); attempt.frame(true,'Right');
 attempt.recognition({gesture,state:'candidate',confidence:1,holdProgress:0},100);
 attempt.recognition({gesture,state:'confirmed',confidence:1,holdProgress:1},1000);
 attempt.recognition({gesture,state:'confirmed',confidence:1,holdProgress:1},1100);
 if(gesture==='HELP')attempt.hint({code:'EXTEND_FINGER',layer:3,severity:'warn',params:{finger:'pinky'}});
 return {...attempt.snapshot(1200),review:{correctRecognition:true,fingerAlignment:'yes',falseConfirmation:false,notes:''}};
}
describe('manual camera demo checks',()=>{
 it('records confirmation edges, timing and aggregate visibility without camera data',()=>{const row=result();expect(row.confirmations).toEqual([{gesture:'HELP',elapsedMs:1000,candidateMs:900}]);expect(row.handVisibleRatio).toBe(1);expect(row.corrections[0].finger).toBe('pinky');expect(JSON.stringify(exportQa([row],'fast','Right','build'))).not.toMatch(/landmarks|data:image|video/);});
 it('requires six normal checks and observed HELP pinky alignment',()=>{const rows=QA_GESTURES.map(result);expect(qaSummary(rows,'fast','Right').ready).toBe(true);expect(qaSummary(rows.slice(1),'fast','Right').ready).toBe(false);rows[2].corrections=[];expect(qaSummary(rows,'fast','Right').ready).toBe(false);});
 it('requires both hands for extended checks',()=>{const rows=QA_GESTURES.map(result);expect(qaSummary(rows,'extended','Right').ready).toBe(false);expect(qaSummary([...rows,...rows.map(row=>({...row,context:{...row.context,hand:'Left' as const}}))],'extended','Right').ready).toBe(true);});
 it('blocks readiness for interruptions, incorrect alignment, and false confirmations',()=>{for(const change of [{interrupted:true},{review:{...result().review,fingerAlignment:'no' as const}},{confirmations:[{gesture:'PAIN' as const,elapsedMs:1000,candidateMs:900}]}]){const rows=QA_GESTURES.map(result);rows[2]={...rows[2],...change};expect(qaSummary(rows,'fast','Right').ready).toBe(false);}});
 it('does not treat difficult conditions as normal coverage',()=>{const rows=QA_GESTURES.map(result).map(row=>({...row,context:{...row.context,lighting:'poor' as const}}));expect(qaSummary(rows,'fast','Right').checked).toBe(0);expect(qaSummary(rows,'fast','Right').ready).toBe(false);});
 it('exports quoted text and prevents CSV formula execution',()=>{const row=result();row.review.notes='=HYPERLINK("example")';expect(qaCsv([row])).toContain('"\'=HYPERLINK(""example"")"');expect(qaCsv([row]).split('\r\n')).toHaveLength(2);});
});
