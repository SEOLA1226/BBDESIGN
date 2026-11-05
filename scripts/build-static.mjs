import { cpSync,mkdirSync,writeFileSync,rmSync } from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const raw=process.env.SUPABASE_URL||'',key=process.env.SUPABASE_PUBLISHABLE_KEY||'';
let url;try{url=new URL(raw);}catch{throw Error('Set SUPABASE_URL in the Cloudflare Pages build environment.');}
if(url.protocol!=='https:'||! /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('SUPABASE_URL must be your HTTPS project URL, e.g. https://PROJECT.supabase.co');
let valid=key.startsWith('sb_publishable_');
if(!valid){try{valid=JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon';}catch{}}
if(!valid)throw Error('Set SUPABASE_PUBLISHABLE_KEY to a publishable key (or legacy anon key). Never use a secret or service_role key.');
const out=path.join(root,'dist');rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});cpSync(path.join(root,'public'),out,{recursive:true});
writeFileSync(path.join(out,'config.js'),'window.BBDESIGN_CONFIG = '+JSON.stringify({mode:'supabase',url:url.origin,key})+';\n');
writeFileSync(path.join(out,'_headers'),`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n  X-Frame-Options: DENY\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob: data: ${url.origin}; connect-src 'self' ${url.origin}; base-uri 'none'; frame-ancestors 'none'; form-action 'self'\n/config.js\n  Cache-Control: no-cache\n`);
console.log('Built dist/ for Cloudflare Pages with Supabase. No private keys or local database included.');
