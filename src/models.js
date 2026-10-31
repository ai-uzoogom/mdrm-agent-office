import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const CACHE = new Map();
const BOX = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map();
const clothingTextures = new Map();
export const CHARACTER_FILES = ['character-male-a', 'character-female-a', 'character-male-c', 'character-female-d', 'character-male-f', 'character-female-b'];
const FURNITURE = ['desk','chairDesk','computerScreen','computerKeyboard','computerMouse','bookcaseOpen','books','kitchenCoffeeMachine','kitchenCabinet','plantSmall1','pottedPlant','table','chairCushion','laptop','rugRectangle'];
const DUNGEON = ['character-human','character-orc','weapon-sword','shield-rectangle','barrel','rocks'];
export async function loadAssets() {
  const missing=[];const manager=new THREE.LoadingManager();manager.onError=url=>missing.push(url);const loader = new GLTFLoader(manager);
  const entries = [...CHARACTER_FILES.map(n => ['mini-characters',n]),...FURNITURE.map(n => ['furniture-kit',n]),...DUNGEON.map(n => ['mini-dungeon',n]),['graveyard-kit','character-ghost']];
  await Promise.all(entries.map(async ([pack,name]) => {
    const gltf = await loader.loadAsync(new URL(`../assets/kenney/${pack}/${name}.glb`, import.meta.url).href);
    gltf.scene.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true; node.receiveShadow = true;
      for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
        mat.flatShading = true; mat.roughness = 1;
        if (mat.map) { mat.map.magFilter = THREE.NearestFilter; mat.map.minFilter = THREE.NearestFilter; mat.map.generateMipmaps = false; }
      }
    });
    CACHE.set(name,gltf);
  }));
  if(missing.length)throw new Error('에셋 파일 누락: '+missing.join(', '));
  return { files: CACHE.size, characterAnimations: CACHE.get(CHARACTER_FILES[0]).animations.map(a => a.name), ghostAnimations: CACHE.get('character-ghost').animations.map(a => a.name) };
}
export function material(color, emissive = false) {
  const key = color + ':' + emissive;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...(emissive ? { emissive: color, emissiveIntensity: .65 } : {}) }));
  return materials.get(key);
}
export function box(parent, w,h,d, color, x=0,y=0,z=0, glow=false) {
  const mesh = new THREE.Mesh(BOX, typeof color === 'string' ? material(color,glow) : color);
  mesh.scale.set(w,h,d); mesh.position.set(x,y,z); mesh.castShadow = !glow; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function group(parent, x=0,y=0,z=0) { const g = new THREE.Group(); g.position.set(x,y,z); if(parent) parent.add(g); return g; }
export function prop(name, dims={}) {
  const source = CACHE.get(name);
  if (!source) throw new Error(`모델이 없습니다: ${name}`);
  const root = group(); const model = source.scene.clone(true); root.add(model);
  const b = new THREE.Box3().setFromObject(model); const size=b.getSize(new THREE.Vector3()); const center=b.getCenter(new THREE.Vector3());
  model.position.set(-center.x,-b.min.y,-center.z);
  const scalar = (dims.h ?? size.y) / size.y;
  root.scale.set(dims.w ? dims.w/size.x : scalar,scalar,dims.d ? dims.d/size.z : scalar);
  return root;
}
export function place(parent, object, x,y,z, rotation=0) { parent.add(object); object.position.set(x,y,z); object.rotation.y=rotation; return object; }

function recolorClothing(model,index,color) {
  const key=`${index}:${color}`;
  const columns=[[.219],[.969],[.719,.344],[.219],[.219],[.344]][index%6];
  model.traverse(node=>{
    if(!node.isMesh||!node.name.includes('body'))return;
    const mats=Array.isArray(node.material)?node.material:[node.material];
    for(const mat of mats){
      if(!mat.map)continue;
      if(!clothingTextures.has(key)){
        const source=mat.map.image,canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
        const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16));
        const rowStart=index%6===3?.75:.5,rowEnd=index%6===3?1:.75;
        for(const u of columns){
          const startX=Math.floor(u*16)*canvas.width/16,endX=startX+canvas.width/16;
          for(let y=Math.floor(canvas.height*rowStart);y<canvas.height*rowEnd;y++)for(let x=startX;x<endX;x++){
            const offset=(y*canvas.width+x)*4,shade=1-(y/canvas.height-rowStart)/(rowEnd-rowStart)*.20;
            for(let channel=0;channel<3;channel++)pixels.data[offset+channel]=Math.round(rgb[channel]*shade);
          }
        }
        ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;clothingTextures.set(key,texture);
      }
      mat.map=clothingTextures.get(key);mat.needsUpdate=true;
    }
  });
}

export function mini(index=0, shirt, height=4.5, kind='crew') {
  const filename = {hero:'character-human',ogre:'character-orc',ghost:'character-ghost'}[kind] ?? CHARACTER_FILES[index%CHARACTER_FILES.length];
  const asset = CACHE.get(filename), root=group(), model=cloneSkeleton(asset.scene); root.add(model);
  const b = new THREE.Box3().setFromObject(model), size=b.getSize(new THREE.Vector3());
  const scale=height/size.y; model.scale.setScalar(scale); model.position.y=-b.min.y*scale;
  // Every animated actor owns its material state; combat flashes cannot tint siblings.
  model.traverse(n => { if(n.isMesh) n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone(); });
  if(kind==='crew'&&shirt)recolorClothing(model,index,shirt);
  const mixer = new THREE.AnimationMixer(model); const actions=new Map(asset.animations.map(a=>[a.name,mixer.clipAction(a)]));
  let current;
  const setAction = name => { if(current===name)return; if(current)actions.get(current)?.stop();actions.get(name)?.reset().play();current=name; };
  setAction('idle'); mixer.update(.02);
  const bones = Object.fromEntries(['head','torso','arm-left','arm-right','leg-left','leg-right'].map(n=>[n,model.getObjectByName(n)]));
  if(shirt && bones.torso) box(bones.torso,.205,.16,.19,shirt,0,.065,.002);
  const actor={root,model,mixer,actions,bones,setAction,height,scale,kind};
  return actor;
}
export function hero() {
  const actor=mini(0,null,5.3,'hero'); const {root,bones}=actor;
  const head=bones.head;
  box(head,.48,.28,.39,'#c2cdd7',0,.18,.015);
  box(head,.49,.07,.41,'#e1e5e2',0,.3,.015);
  box(head,.34,.10,.025,'#34425a',0,.16,.222);
  for(let x=-.105;x<=.11;x+=.07)box(head,.018,.10,.03,'#c2cdd7',x,.16,.241);
  box(head,.075,.20,.17,'#d74b5d',0,.43,-.025);
  box(head,.075,.12,.16,'#ff7881',0,.52,-.08);
  box(bones.torso,.24,.19,.21,'#4166bb',0,.08,0);
  box(bones.torso,.25,.04,.22,'#c4cfdb',0,.17,0);
  const swordPivot=group(root,-1.45,2.2,.4);
  const sword=prop('weapon-sword',{h:3.6});swordPivot.add(sword);sword.position.y=-.55;swordPivot.rotation.z=-.35;
  const shieldPivot=group(root,1.35,2.1,.55);
  const shield=prop('shield-rectangle',{h:2.5,w:1.9});shieldPivot.add(shield);shield.position.y=-1.1;
  box(shieldPivot,.95,1.35,.24,'#4168bd',0,.1,.24);
  box(shieldPivot,.19,.95,.1,'#f5c542',0,.1,.41);box(shieldPivot,.65,.19,.1,'#f5c542',0,.2,.41);
  actor.sword=swordPivot;actor.shield=shieldPivot;return actor;
}
export function robot() {
  const root=group(), body=group(root);
  box(body,1.55,1.15,1.12,'#369b9d',0,1.1,0);box(body,1.9,1.5,1.45,'#67d9cb',0,2.35,0);
  box(body,1.5,.72,.16,'#183849',0,2.4,.76);
  for(const x of [-.43,.43])box(body,.28,.30,.08,'#c4ffdf',x,2.4,.88,true);
  box(body,.13,.65,.13,'#f5c542',0,3.35,0);box(body,.4,.32,.4,'#f5c542',0,3.76,0,true);
  for(const x of [-.62,.62]){box(body,.45,.55,.7,'#285365',x,.27,.08);box(body,.32,.70,.45,'#47b5af',x*1.7,1.15,0);}
  box(body,.45,.2,.1,'#f5c542',0,1.2,.61,true);
  return {root,body,height:4,kind:'pet'};
}
function ghost(grade) {
  const actor=mini(0,null,grade==='low'?2.6:3.6,'ghost');
  actor.hoverHeight=.45;
  return actor;
}
function dragon() {
  const root=group(), body=group(root), red='#d56d83', light='#ff9b9a', dark='#925774';
  box(body,2.7,2.8,3.0,red,0,2.15,-.5);box(body,2,2.2,1,'#ffba9e',0,2.2,1.1);
  box(body,2.9,2.2,2.4,light,0,4.05,1);box(body,2.35,1.1,1.7,light,0,3.55,2.5);
  box(body,1.5,.34,.11,'#613756',0,3.35,3.4);
  for(const x of [-1.05,1.05]){
    box(body,.75,.75,.2,'#fff0cf',x,4.28,2.23);box(body,.29,.48,.15,'#332f45',x*.92,4.2,2.38);
    box(body,1.05,.65,1.8,dark,x,.4,.6);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(.36,1.15,4),material('#f5dc9d'));horn.position.set(x,5.65,.6);horn.rotation.z=-Math.sign(x)*.2;body.add(horn);
  }
  const wings=[];
  for(const side of [-1,1]){
    const pivot=group(body,side*1.2,3.15,-1);
    const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(side*3.3,2);shape.lineTo(side*3.8,-1);shape.lineTo(side*2,-.55);shape.lineTo(side*.8,-1.4);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false});
    const mesh=new THREE.Mesh(geometry,material(dark));mesh.castShadow=true;pivot.add(mesh);
    box(pivot,.28,2.3,.32,red,side*1.4,.15,0).rotation.z=side*-.55;wings.push(pivot);
  }
  for(let i=0;i<4;i++)box(body,1.5-i*.3,.8-i*.13,1.5,red,0,1.2-i*.18,-2-i*.8);
  for(let i=0;i<3;i++)box(body,.4,.5,.5,'#f5c542',0,3.8-i*.4,-.3-i*.9).rotation.z=Math.PI/4;
  const mouth=group(body,0,3.45,3.6);
  return {root,body,wings,mouth,height:6.2,kind:'dragon'};
}
export function monster(grade) {
  if(grade==='critical')return dragon();
  if(grade==='low'||grade==='medium')return ghost(grade);
  const actor=mini(0,'#f6a050',5.4,'ogre');
  const clubPivot=group(actor.root,-1.7,2.3,.1);
  box(clubPivot,.35,2.5,.35,'#8c5a40',0,.6,0);box(clubPivot,.95,1.4,.95,'#a97854',0,2.1,0);
  for(const y of [1.7,2.3])box(clubPivot,1.03,.14,1.03,'#d7b87a',0,y,0);
  clubPivot.rotation.z=-.22;actor.club=clubPivot;actor.kind='ogre';return actor;
}
export function thumbnail(renderer, object, {bg='#172461',scale=1}={}) {
  const thumbScene = new THREE.Scene();thumbScene.background=new THREE.Color(bg);
  thumbScene.add(new THREE.HemisphereLight('#fff1e0','#6d6595',2.25));
  const light=new THREE.DirectionalLight('#ffe6c7',3.4);light.position.set(-25,65,35);thumbScene.add(light);
  const clone=cloneSkeleton(object);clone.position.set(0,0,0);clone.rotation.set(0,0,0);thumbScene.add(clone);clone.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(clone),center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());
  const extent=Math.max(size.y,size.x*.85,size.z*.85)*1.33/scale;
  const camera=new THREE.OrthographicCamera(-extent/2,extent/2,extent/2,-extent/2,.1,100);
  camera.position.copy(center).add(new THREE.Vector3(10,10,10));camera.lookAt(center);
  renderer.render(thumbScene,camera);
  return renderer.domElement.toDataURL('image/png');
}
