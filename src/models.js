import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const CACHE = new Map();
const BOX = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map();
const clothingTextures = new Map();
export const CHARACTER_FILES = ['character-male-a', 'character-female-a', 'character-male-c', 'character-female-d', 'character-male-f', 'character-female-b', 'character-female-e'];
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
  const filename = {hero:'character-human',ogre:'character-orc',ghost:'character-ghost',coordinator:'character-female-e'}[kind] ?? CHARACTER_FILES[index%CHARACTER_FILES.length];
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
  const actor={root,model,mixer,actions,bones,setAction,height,scale,kind,filename};
  return actor;
}
// Kenney's mini rigs end at the arm bones. Locate the fist from the distal
// skinned vertices in bind space, so the grip follows the actual animated hand.
function handMount(actor,side) {
  const bone=actor.bones[`arm-${side}`],points=[],point=new THREE.Vector3();
  actor.model.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const joint=mesh.skeleton.bones.indexOf(bone);if(joint<0)return;
    const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
    for(let i=0;i<position.count;i++)for(let k=0;k<4;k++){
      if(skinIndex.getComponent(i,k)!==joint||skinWeight.getComponent(i,k)<.9)continue;
      point.fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[joint]);points.push(point.clone());break;
    }
  });
  const reach=Math.max(...points.map(p=>Math.abs(p.x)));
  const hand=new THREE.Box3().setFromPoints(points.filter(p=>Math.abs(p.x)>reach*.65)).getCenter(new THREE.Vector3());
  const mount=group(bone);mount.position.copy(hand);mount.name=`${side}-hand-grip`;
  actor.root.updateMatrixWorld(true);
  const frame=actor.model.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  mount.quaternion.copy(frame.invert());
  return mount;
}
function faceInModelSpace(actor,mount,x=0,y=0,z=0) {
  actor.root.updateMatrixWorld(true);
  const modelFrame=actor.model.getWorldQuaternion(new THREE.Quaternion()).invert();
  const boneFrame=mount.parent.getWorldQuaternion(new THREE.Quaternion());
  mount.quaternion.copy(modelFrame.multiply(boneFrame).invert()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)));
}
export function hero() {
  const actor=mini(0,null,5.3,'hero'); const {bones}=actor;
  // The full helmet replaces the separate original head mesh; its hair must
  // not protrude through the shell. Keep the head bone for attached equipment.
  actor.model.getObjectByName('head-mesh').visible=false;
  const head=bones.head;
  box(head,.14,.08,.14,'#34425a',0,0,0);
  box(head,.46,.34,.41,'#c2cdd7',0,.19,.015);
  box(head,.48,.045,.43,'#e1e5e2',0,.375,.015);
  box(head,.34,.10,.018,'#34425a',0,.19,.228);
  for(const x of [-.105,-.035,.035,.105])box(head,.018,.10,.018,'#c2cdd7',x,.19,.245);
  box(head,.075,.18,.17,'#d74b5d',0,.47,-.025);
  box(head,.075,.10,.16,'#ff7881',0,.56,-.08);
  box(bones.torso,.32,.18,.285,'#4166bb',0,.084,0);
  box(bones.torso,.325,.025,.29,'#c4cfdb',0,.17,0);
  const swordPivot=handMount(actor,'right'),shieldPivot=handMount(actor,'left');
  swordPivot.rotateZ(.18);
  const sword=prop('weapon-sword',{h:.44});swordPivot.add(sword);sword.position.y=-.045;
  const shield=prop('shield-rectangle',{h:.28,w:.25});shieldPivot.add(shield);shield.position.set(0,-.105,.055);
  box(shieldPivot,.14,.20,.018,'#4168bd',0,.035,.124);
  box(shieldPivot,.024,.12,.012,'#f5c542',0,.035,.139);box(shieldPivot,.09,.024,.012,'#f5c542',0,.055,.140);
  const rest={right:bones['arm-right'].quaternion.clone(),left:bones['arm-left'].quaternion.clone()};
  actor.setEquipmentPose=(swing=0,guard=0)=>{
    bones['arm-right'].quaternion.copy(rest.right);bones['arm-right'].rotateY(.9*swing);bones['arm-right'].rotateZ(-.55*swing);
    bones['arm-left'].quaternion.copy(rest.left);bones['arm-left'].rotateY(-.7*guard);bones['arm-left'].rotateZ(1.05*guard);
    // Aim the blade into the invasion lane while retaining the grip on the hand.
    faceInModelSpace(actor,swordPivot,1.65*swing,0,.18);
    faceInModelSpace(actor,shieldPivot,-.12*guard,-.2*guard,0);
  };
  actor.sword=swordPivot;actor.shield=shieldPivot;return actor;
}
export function crewCharacter(person,index) {
  if(person.behavior!=='encourage')return mini(index,person.shirt);
  const actor=mini(0,null,4.5,'coordinator'),phone=handMount(actor,'right');
  box(phone,.045,.10,.05,'#4166bb',0,.025,0);
  const horn=new THREE.Mesh(new THREE.CylinderGeometry(.115,.055,.19,8),material('#f5c542'));
  horn.rotation.x=Math.PI/2;horn.position.set(0,.12,.045);horn.castShadow=true;phone.add(horn);
  const opening=new THREE.Mesh(new THREE.CircleGeometry(.10,8),material('#34425a'));opening.position.set(0,.12,.142);phone.add(opening);
  const waves=group(phone,0,.12,.18);
  for(let i=0;i<3;i++){
    const wave=new THREE.Mesh(new THREE.TorusGeometry(.12+i*.035,.008,4,12),new THREE.MeshBasicMaterial({color:'#f5c542',transparent:true,opacity:.7,depthWrite:false}));
    wave.position.z=i*.12;wave.castShadow=false;waves.add(wave);
  }
  const arm=actor.bones['arm-right'],rest=arm.quaternion.clone();
  // The original mouth is at head-local (0, .075, .162). Leave a small gap
  // before the lips. The narrow end of the horn, rather than its bell, meets it.
  const mouth=group(actor.bones.head,0,.075,.168),mouthpiece=group(phone,0,.12,-.05);
  const restHand=phone.position.clone().applyQuaternion(rest).normalize();
  const reachSquared=phone.position.lengthSq(),offset=mouthpiece.position.clone();
  const headFrame=new THREE.Quaternion(),pose=new THREE.Quaternion(),correction=new THREE.Quaternion();
  const target=new THREE.Vector3(),delta=new THREE.Vector3(),inHead=new THREE.Vector3();
  actor.setEncouragementPose=(time,calling)=>{
    if(calling){
      actor.root.updateMatrixWorld(true);
      headFrame.copy(arm.parent.getWorldQuaternion(pose)).invert().multiply(actor.bones.head.getWorldQuaternion(correction));
      mouth.getWorldPosition(delta);arm.parent.worldToLocal(delta).sub(arm.position);
      inHead.copy(delta).applyQuaternion(correction.copy(headFrame).invert());
      // Solve the shoulder–hand–mouth triangle at the original arm length.
      // For a pitch p: dot(delta, rotated intake offset) = a*cos(p)+b*sin(p).
      const a=inHead.y*offset.y+inHead.z*offset.z,b=-inHead.y*offset.z+inHead.z*offset.y;
      const phase=Math.atan2(b,a),arc=Math.acos(THREE.MathUtils.clamp((delta.lengthSq()+offset.lengthSq()-reachSquared)/(2*Math.hypot(a,b)),-1,1));
      const pitches=[phase-arc,phase+arc].map(p=>Math.atan2(Math.sin(p),Math.cos(p)));
      const pitch=pitches.reduce((best,p)=>Math.abs(p)<Math.abs(best)?p:best);
      pose.setFromAxisAngle(new THREE.Vector3(1,0,0),pitch).premultiply(headFrame);
      target.copy(offset).applyQuaternion(pose);target.subVectors(delta,target).normalize();
      correction.setFromUnitVectors(restHand,target);arm.quaternion.copy(rest).premultiply(correction);
      phone.quaternion.copy(arm.quaternion).invert().multiply(pose);
    }else faceInModelSpace(actor,phone,0,.12,0);
    waves.visible=calling;
    waves.children.forEach((wave,i)=>{const pulse=(time*1.8+i/3)%1;wave.scale.setScalar(.8+pulse*.5);wave.material.opacity=.65*(1-pulse*.65);});
    actor.calling=calling;
  };
  actor.phone=phone;actor.mouth=mouth;actor.mouthpiece=mouthpiece;actor.waves=waves;actor.setEncouragementPose(0,true);return actor;
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
