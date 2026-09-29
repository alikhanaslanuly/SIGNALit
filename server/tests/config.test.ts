import {it,expect} from 'vitest';
import { serverConfig } from '../src/config.js';
import { publicApiOrigin } from '../../scripts/build-config.js';
it('requires explicit secure origins and persistent storage in production',()=>{
 const valid={NODE_ENV:'production',FRONTEND_ORIGIN:'https://demo.example',SIGNAL_DB_PATH:'./data/demo.db'};
 expect(serverConfig(valid).origins).toEqual(['https://demo.example']);
 for(const patch of [{FRONTEND_ORIGIN:''},{FRONTEND_ORIGIN:'*'},{FRONTEND_ORIGIN:'https://demo.example/path'},{FRONTEND_ORIGIN:'http://demo.example'},{SIGNAL_DB_PATH:':memory:'},{SIGNAL_DB_PATH:' :memory: '},{SIGNAL_DB_PATH:''},{PORT:'bad'}]) expect(()=>serverConfig({...valid,...patch})).toThrow();
});
it('keeps development defaults while rejecting accidental production loopback APIs',()=>{
 expect(serverConfig({}).port).toBe(4000);expect(publicApiOrigin('',true)).toBe('');
 expect(publicApiOrigin('https://api.example',true)).toBe('https://api.example');
 for(const url of ['http://localhost:4000','https://127.0.0.1','http://api.example','https://api.example/api','https://user:pass@api.example'])expect(()=>publicApiOrigin(url,true)).toThrow();
 expect(publicApiOrigin('http://127.0.0.1:4610',true,true)).toBe('http://127.0.0.1:4610');
});
