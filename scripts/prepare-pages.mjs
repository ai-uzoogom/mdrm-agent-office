import {cp,mkdir,rm,writeFile,lstat,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
const output=join(root,'_site');
const entries=['index.html','styles.css','src','assets','vendor'];
try{if((await lstat(output)).isSymbolicLink())throw new Error('_site must not be a symbolic link');}
catch(error){if(error.code!=='ENOENT')throw error;}
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const entry of entries)await cp(join(root,entry),join(output,entry),{recursive:true});
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
