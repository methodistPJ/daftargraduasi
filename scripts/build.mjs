import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await fs.rm(path.join(root,'dist'),{recursive:true,force:true});await fs.cp(path.join(root,'frontend'),path.join(root,'dist'),{recursive:true});
for (const f of ['qa-viewports.html','qa-viewports.css','qa-viewports.js']) await fs.rm(path.join(root,'dist',f),{force:true});
const apiBase=process.env.TWY_API_BASE||'',googleClientId=process.env.TWY_GOOGLE_CLIENT_ID||'';
if(apiBase&&!/^https:\/\/[a-z0-9.-]+\.workers\.dev\/api$/.test(apiBase))throw new Error('TWY_API_BASE must be an HTTPS workers.dev /api endpoint.');
await fs.writeFile(path.join(root,'dist/config.js'),'window.TWY_CONFIG = '+JSON.stringify({apiBase,googleClientId,preview:false})+';\n');
await fs.writeFile(path.join(root,'dist/.nojekyll'),'');
await fs.copyFile(path.join(root,'backend/domain.js'),path.join(root,'backend/apps-script/Domain.gs'));
console.log('Built static frontend and Apps Script shared domain. No roster or secrets included.');

// Version entry assets and their module imports so browser caches cannot hide a deployment.
const scriptFiles=(await fs.readdir(path.join(root,'dist/js'))).filter(f=>f.endsWith('.js')).sort().map(f=>'js/'+f);
const versionFiles=['styles.css','admin.css','privacy.css','config.js',...scriptFiles];
const digest=createHash('sha256');for(const f of versionFiles)digest.update(await fs.readFile(path.join(root,'dist',f)));
const assetVersion=digest.digest('hex').slice(0,12);
for(const f of scriptFiles){const target=path.join(root,'dist',f);const source=await fs.readFile(target,'utf8');await fs.writeFile(target,source.replace(/from (['"])(\.\/[^'"]+\.js)\1/g,(_m,q,url)=>'from '+q+url+'?v='+assetVersion+q));}
for(const f of ['index.html','admin.html','privacy.html']){const target=path.join(root,'dist',f);const source=await fs.readFile(target,'utf8');await fs.writeFile(target,source.replace(/((?:src|href)=['"])([^'"?#]+\.(?:css|js))(['"])/g,(_m,prefix,url,suffix)=>prefix+url+'?v='+assetVersion+suffix));}
console.log('Versioned browser assets:',assetVersion);
