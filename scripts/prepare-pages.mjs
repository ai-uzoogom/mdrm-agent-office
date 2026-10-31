import {cp,mkdir,rm,writeFile,readFile,lstat,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('..',import.meta.url));
const output=join(root,'_site');
const entries=['index.html','styles.css','src','assets','vendor'];
try{if((await lstat(output)).isSymbolicLink())throw new Error('_site must not be a symbolic link');}
catch(error){if(error.code!=='ENOENT')throw error;}
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const entry of entries)await cp(join(root,entry),join(output,entry),{recursive:true});
// A fresh entry URL alone cannot invalidate its cached dependency modules.
// Version the complete local module graph and stylesheet in the published copy.
const names=(await readdir(join(root,'src'))).filter(n=>n.endsWith('.js')).sort();
const hash=createHash('sha256');for(const name of names)hash.update(await readFile(join(root,'src',name)));
hash.update(await readFile(join(root,'styles.css')));const version=hash.digest('hex').slice(0,12);
for(const name of names){const source=await readFile(join(root,'src',name),'utf8');await writeFile(join(output,'src',name),source.replace(/(from\s+['"])(\.\.?\/[^'"]+\.js)(['"])/g,`$1$2?v=${version}$3`));}
const html=await readFile(join(root,'index.html'),'utf8');await writeFile(join(output,'index.html'),html.replace('./src/main.js',`./src/main.js?v=${version}`).replace('./styles.css',`./styles.css?v=${version}`));
await writeFile(join(output,'.nojekyll'),'');
let count=0,bytes=0;
async function measure(directory){
 for(const name of await readdir(directory)){
  const path=join(directory,name),stat=await lstat(path);
  if(stat.isSymbolicLink())throw new Error('Static assets must not contain symbolic links');
  if(stat.isDirectory())await measure(path);else{count++;bytes+=stat.size;}
 }
}
await measure(output);
console.log(`GitHub Pages artifact: ${count} files, ${(bytes/1024/1024).toFixed(2)} MiB → _site/`);
