import fs from 'node:fs/promises';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const name of ['backend/domain.js','backend/apps-script/Code.gs'])new vm.Script(await fs.readFile(path.join(root,name),'utf8'),{filename:name});
JSON.parse(await fs.readFile(path.join(root,'backend/apps-script/appsscript.json'),'utf8'));
const config=await fs.readFile(path.join(root,'frontend/config.js'),'utf8');if(!config.includes("apiBase: ''"))throw new Error('Source configuration should remain unconfigured; production uses build-time public settings.');
const files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else files.push(p);}}await walk(path.join(root,'frontend'));
for(const f of files){if(/\.(json|js|html|css)$/.test(f)){const s=await fs.readFile(f,'utf8');if(/spreadsheets\/d\/[a-zA-Z0-9_-]{20,}|access_token|refresh_token|GATEWAY_SECRET/.test(s)||(process.env.TWY_PRIVATE_ROSTER_ID&&s.includes(process.env.TWY_PRIVATE_ROSTER_ID)))throw new Error('Private configuration found in public frontend: '+f);}}
console.log('Apps Script syntax, manifest and frontend privacy checks passed.');
