import * as THREE from 'three';
import { PRODUCT, RENDERING, CREW, GRADES, activeIssues, issueLabel, particle, targetVersion, dDay } from './data.js';
import { loadAssets, box, group, place, prop, mini, hero, robot, monster, material, thumbnail } from './models.js';

const PALETTE={ wall:'#4a4383', partition:'#6a63a8', wood:['#b07c4c','#a06e42'], meeting:['#4d6199','#45578c'], server:['#323e60','#2b3654'] };
const lerp=THREE.MathUtils.lerp, ease=t=>t*t*(3-2*t), random=(a,b)=>a+Math.random()*(b-a);
export class OfficeScene {
  constructor({canvas,stage,overlay,onLog,onCrew,onMotion,onReady}) {
    Object.assign(this,{canvas,stage,overlay,onLog,onCrew,onMotion,onReady});
    this.elapsed=0;this.frameCount=0;this.metrics={walk:0,typing:0,led:0,melee:0,breath:0,combat:0};this.actors=[];this.obstacles=[];this.targets=[];this.labels=[];this.bubbles=[];this.monsters=[];this.leds=[];this.codeLines=[];this.crewActors=[];this.mixers=[];this.clickHandlers=new Map();this.assets=null;
    this.motionQuery=matchMedia('(prefers-reduced-motion: reduce)');this.reduced=this.motionQuery.matches;this.pointer=new THREE.Vector2();this.raycaster=new THREE.Raycaster();this.projectVector=new THREE.Vector3();this.raf=null;this.ready=false;this.battleCursor=2;
    this.nextCrew=1.6;this.nextLed=.4;this.nextCode=.13;this.nextBattle=1.8;this.nextMeeting=5;this.lastCalendar=0;
  }
  async init(){
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:false,alpha:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NoToneMapping;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.BasicShadowMap;
    this.scene=new THREE.Scene();
    this.camera=new THREE.OrthographicCamera(-45,45,34,-34,.1,300);
    const target=new THREE.Vector3(0,2,0);this.camera.position.copy(target).add(new THREE.Vector3(80,80,80));this.camera.lookAt(target);this.camera.updateMatrixWorld(true); // azimuth 45°, elevation atan(1/sqrt(2)) = 35.264°.
    this.scene.add(new THREE.HemisphereLight('#fff1da','#6d6595',2.25));
    const sun=new THREE.DirectionalLight('#ffe6c7',3.4);sun.position.set(-25,65,35);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-48;sun.shadow.camera.right=48;sun.shadow.camera.top=48;sun.shadow.camera.bottom=-48;sun.shadow.camera.near=1;sun.shadow.camera.far=140;sun.shadow.bias=-.0007;sun.shadow.normalBias=.04;sun.target.position.set(0,0,0);this.scene.add(sun,sun.target);
    this.renderTarget=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,format:THREE.RGBAFormat,depthBuffer:true,stencilBuffer:false});
    this.renderTarget.texture.colorSpace=THREE.SRGBColorSpace;this.renderTarget.texture.generateMipmaps=false;
    this.blitScene=new THREE.Scene();this.blitCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:this.renderTarget.texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false})));
    this.assets=await loadAssets();
    this.buildRoom();this.buildCrew();this.buildServer();this.buildMonsters();this.buildEffects();
    this.makeThumbnails();this.ready=true;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.stage);this.resize();
    this.installEvents();
    this.onLog('오피스 오픈 · v'+PRODUCT.next+' 릴리스를 준비합니다','special');
    this.onLog('MDRM 용사와 AGENT가 방어선을 지키는 중','good');
    this.onReady(this);
    this.updateMotion();
  }
  addProp(name,dims,x,y,z,rotation=0,parent=this.scene){const object=place(parent,prop(name,dims),x,y,z,rotation);if(['desk','chairDesk','chairCushion','bookcaseOpen','kitchenCabinet','table','pottedPlant'].includes(name))this.obstacles.push({name,object});return object;}
  buildRoom(){
    const room=group(this.scene);
    box(room,61.4,1.4,45.4,'#25253e',0,-1.25,0);box(room,60.6,.45,44.6,'#5a5579',0,-.32,0);
    box(room,57,.45,41,'#18172d',0,-2.06,0);
    const positions=[[],[],[],[],[],[]];
    for(let ix=0;ix<20;ix++)for(let iz=0;iz<15;iz++){
      const x=-28.5+ix*3,z=-20.5+iz*2.93;const zone=z>=2?4:x>4?2:0;positions[zone+(ix+iz)%2].push([x,-.03,z]);
    }
    const floorColors=[...PALETTE.wood,...PALETTE.meeting,...PALETTE.server];const transform=new THREE.Object3D();
    positions.forEach((list,i)=>{const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(2.98,.16,2.91),material(floorColors[i]),list.length);list.forEach(([x,y,z],j)=>{transform.position.set(x,y,z);transform.updateMatrix();mesh.setMatrixAt(j,transform.matrix);});mesh.receiveShadow=true;room.add(mesh);});
    box(room,61,12,1.1,PALETTE.wall,0,6,-22);box(room,1.1,12,44,PALETTE.wall,-30,6,0);
    box(room,61,.45,1.4,'#857dab',0,12.1,-22);box(room,1.4,.45,44,'#857dab',-30,12.1,0);
    box(room,60,.7,.3,'#6a619b',0,.4,-21.35);box(room,.3,.7,44,'#6a619b',-29.35,.4,0);
    // Office partition: both rooms retain open, navigable doorways.
    box(room,.65,3,17,PALETTE.partition,4.3,1.5,-13);box(room,.85,.2,17.2,'#938ac1',4.3,3.05,-13);
    for(const [x,w] of [[-25,10],[-6,18],[19.5,21]]){box(room,w,3,.65,PALETTE.partition,x,1.5,2.5);box(room,w+.15,.2,.85,'#938ac1',x,3.05,2.5);}
    for(const x of [-19,-6]){
      box(room,8.1,6,.3,'#292944',x,7.6,-21.3);box(room,7.4,5.3,.35,'#9bb6d6',x,7.6,-21.05,true);
      box(room,7.4,1.3,.04,'#becfda',x,9.6,-20.85,true);
      box(room,.24,5.4,.3,'#e4d9c4',x,7.6,-20.8);box(room,7.6,.24,.3,'#e4d9c4',x,7.4,-20.8);
      box(room,8.3,.28,1,'#e4d9c4',x,4.7,-20.6);
    }
    this.addProp('bookcaseOpen',{h:6.9,w:7,d:1.5},-28.5,0,-10,Math.PI/2);
    for(let row=0;row<3;row++)for(let col=0;col<5;col++)box(room,.65,1.2,.75,['#c79bff','#f5c542','#4fb3ff','#f6a050','#4fd1c5'][(col+row)%5],-28,1.2+row*1.8,-12+col*.86);
    this.addProp('kitchenCabinet',{h:3.0,w:5.5,d:2.5},-26.1,0,-18.8);
    this.addProp('kitchenCoffeeMachine',{h:2,w:2.2,d:1.8},-26.1,3,-18.7,Math.PI);
    this.addProp('rugRectangle',{h:.12,w:5.8,d:7},-25.2,.12,-4);
    for(const [x,z,h] of [[-27,18,5],[1,-19,4.7],[28,-19.8,4.5],[7,-18,3.9]])this.addProp('pottedPlant',{h},x,0,z);
    this.addProp('table',{h:3.3,w:11,d:6.5},18,0,-8.5);
    this.addProp('laptop',{h:1.55,w:2.6,d:2.2},18,3.3,-7.6,Math.PI);
    box(room,2,.07,1.4,'#e5e4d8',14.6,3.4,-8.1);box(room,1.5,.07,1,'#c79bff',21,3.4,-9.5);
    for(const [x,z,rot] of [[11.1,-8.5,-Math.PI/2],[24.8,-8.5,Math.PI/2],[18,-3.7,0],[18,-13,Math.PI]])this.addProp('chairCushion',{h:3.7,w:2.6,d:2.8},x,0,z,rot);
    box(room,15.8,6.3,.4,'#34334f',18.2,7.1,-21.3);box(room,15.1,5.6,.22,'#f4efe0',18.2,7.1,-21);
    box(room,15.7,.2,.8,'#aaa8b8',18.2,3.95,-20.8);
    for(let i=0;i<3;i++){box(room,3.4,1.1,.08,['#ff8a86','#f6a050','#c79bff'][i],13.9+i*4.25,6.2,-20.82);box(room,2.8,.12,.09,'#bfc5bb',13.9+i*4.25,5.25,-20.82);}
    this.boardLabel=this.label('board-label',`v${PRODUCT.next} · ${dDay()}`,new THREE.Vector3(18.2,8.2,-20.75));
    this.label('wall-label','개발실',new THREE.Vector3(-29.3,9.8,-8),true);
    this.label('wall-label','회의실',new THREE.Vector3(18,11.1,-21.2),true);
    this.label('wall-label server','서버실',new THREE.Vector3(-29.2,7.3,11),true);
    // A quiet server-room edge includes real Mini Dungeon props.
    this.addProp('barrel',{h:2.4},-27,0,5.5);this.addProp('rocks',{h:1.3,w:3},28,0,19);
  }
  register(actor,key,description){
    actor.key=key;actor.describe=description;actor.root.userData.actorKey=key;this.actors.push(actor);this.targets.push(actor.root);this.clickHandlers.set(key,()=>this.describe(actor));return actor;
  }
  buildCrew(){
    const desks=[[-18,-12],[-5,-12],[-18,-3.2],[-5,-3.2]];
    CREW.forEach((person,i)=>{
      const actor=mini(i,person.shirt,4.5);this.scene.add(actor.root);this.mixers.push(actor.mixer);actor.index=i;actor.statusIndex=0;actor.status=person.statuses?.[0]??person.stops[0];actor.data=person;
      if(!person.walker){
        const [x,z]=desks[i];this.addProp('desk',{h:3.15,w:8.7,d:3.7},x,0,z,Math.PI);
        this.addProp('computerScreen',{h:2.45,w:3.7,d:.95},x,3.15,z-.6);
        const screen=group(this.scene,x,4.6,z-.09);box(screen,3.1,1.65,.05,'#182f42',0,0,0);box(screen,3.15,.15,.06,person.screen,0,.8,.02,true);
        for(let line=0;line<5;line++){
          const l=box(screen,random(.6,2.3),.1,.06,person.screen,-.3, .48-line*.26,.04,true);this.codeLines.push({mesh:l,crew:i,seed:Math.random()});
        }
        this.addProp('computerKeyboard',{h:.13,w:2.8,d:.9},x,3.2,z+.95);
        this.addProp('computerMouse',{h:.18,w:.5,d:.7},x+2,3.2,z+.95);
        this.mug(this.scene,x+3.1,3.2,z+.6,'#e9dbbe');
        this.addProp('chairDesk',{h:3.3,w:2.5,d:2.5},x,0,z+3,Math.PI);
        actor.root.position.set(x,.5,z+3);actor.root.rotation.y=Math.PI;actor.setAction('sit');actor.mixer.update(.02);
        actor.baseY=.5;actor.typingPose={head:actor.bones.head?.rotation.x,left:actor.bones['arm-left']?.rotation.x,right:actor.bones['arm-right']?.rotation.x};
        if(i===0||i===2)this.addProp('plantSmall1',{h:.9},x-3.3,3.2,z-.1);
      } else if(i===4){
        actor.path=[{x:22,z:-17.1,stop:0},{x:27.9,z:-17.1},{x:27.9,z:-8.1,stop:1},{x:27.9,z:-17.1}];actor.root.position.set(22,0,-17.1);actor.pathIndex=1;actor.wait=.45;
      } else {
        actor.path=[{x:-25.2,z:-15.5,stop:1},{x:-25.2,z:-7,stop:0},{x:-25.2,z:-.9,stop:2},{x:-23.7,z:-.9,stop:3},{x:-25.2,z:-.9},{x:-25.2,z:-7}];actor.root.position.set(-25.2,0,-15.5);actor.pathIndex=1;actor.wait=.25;
        this.mug(actor.root,-1.25,2.15,.7,'#f4efe0');
      }
      this.crewActors.push(actor);this.register(actor,`crew-${i}`,()=>`${person.role} · ${actor.status}`);
      this.label('name-label',person.role,actor.root,false,5.15);
      this.onCrew(i,actor.status);this.bubble(actor,actor.status,4.5,{fixed:this.reduced});
    });
    const meeting=mini(1,'#5263a4',4.3);this.scene.add(meeting.root);meeting.root.position.set(18,.4,-3.3);meeting.root.rotation.y=Math.PI;meeting.setAction('sit');meeting.mixer.update(.02);this.mixers.push(meeting.mixer);this.meeting=meeting;
    this.register(meeting,'meeting',()=>`v${PRODUCT.next} 일정 점검 · 이슈 ${activeIssues().length}건 확인`);
    this.bubble(meeting,`v${PRODUCT.next} 일정 점검`,4,{fixed:this.reduced});
  }
  mug(parent,x,y,z,color){const g=group(parent,x,y,z);box(g,.53,.7,.53,color,0,.35,0);box(g,.37,.05,.37,'#795c4f',0,.72,0);box(g,.24,.4,.13,color,.36,.4,0);return g;}
  buildServer(){
    for(let i=0;i<5;i++){
      const root=group(this.scene,-24+i*6.3,0,6.9);
      box(root,4.3,7,3.1,'#1d263e',0,3.5,0);box(root,4.6,.35,3.4,'#536079',0,7.1,0);box(root,4.6,.3,3.4,'#1a2033',0,.2,0);
      for(let r=0;r<7;r++){
        box(root,3.6,.66,.2,'#39465e',0,1+r*.83,1.64);
        box(root,1.6,.11,.1,'#121d33',-.5,1+r*.83,1.8);
        for(let j=0;j<2;j++){
          const led=box(root,.22,.18,.1,new THREE.MeshStandardMaterial({color:'#4fd16b',emissive:'#4fd16b',emissiveIntensity:1.2}),.85+j*.5,1+r*.83,1.83);this.leds.push(led);
        }
      }
      const rack={root,height:7.2,kind:'rack'};this.register(rack,`rack-${i}`,()=> '모든 서비스 정상 동작 중');
    }
    for(let z=4.6;z<22;z+=2.2)box(this.scene,.35,.04,1.25,'#f5c542',9.8,.13,z,true);
    this.hero=hero();this.scene.add(this.hero.root);this.hero.root.position.set(6.5,0,14.7);this.hero.root.rotation.y=Math.PI/2;this.hero.home=this.hero.root.position.clone();this.mixers.push(this.hero.mixer);
    this.register(this.hero,'hero',()=> '방어선은 내가 지킨다');this.label('name-label hero','HERO · MDRM',this.hero.root,false,6.5);
    this.bubble(this.hero,'오늘도 이상 무!',5,{fixed:this.reduced});
    this.pet=robot();this.scene.add(this.pet.root);this.pet.root.position.set(2.7,0,18.7);this.pet.root.rotation.y=Math.PI/3;this.pet.home=this.pet.root.position.clone();
    this.register(this.pet,'pet',()=> '삐빅!');this.label('name-label pet','PET · AGENT',this.pet.root,false,4.8);this.bubble(this.pet,'삐빅!',4,{fixed:this.reduced});
    // A voxel fissure, painted light and emissive geometry keep the one-sun lighting setup.
    const rift=group(this.scene,27,0,3.4);this.rift=rift;
    for(const [x,y,w,h] of [[-2.3,3,1.5,6],[2.3,3.7,1.5,7.4],[-.7,7,1.8,1.4],[1.2,7.6,1.7,1.3]])box(rift,w,h,1.4,'#54486d',x,y,0);
    const riftMaterial=new THREE.MeshStandardMaterial({color:'#ef5350',emissive:'#ef5350',emissiveIntensity:1.8,transparent:true,opacity:.8});
    this.riftCore=box(rift,2.1,5.7,.3,riftMaterial,0,3.3,.4);
    for(let i=0;i<5;i++)box(rift,.65,1.3,.2,'#ff9681',i%2?.4:-.25,1+i*1.1,.65,true).rotation.z=i%2?.3:-.3;
    const aura=new THREE.Mesh(new THREE.CircleGeometry(4,16),new THREE.MeshBasicMaterial({color:'#ef5350',transparent:true,opacity:.16,depthWrite:false}));aura.rotation.x=-Math.PI/2;aura.position.set(27,.18,5.8);this.scene.add(aura);this.riftAura=aura;
  }
  buildMonsters(){
    const issues=activeIssues();const count=issues.length;
    // Dynamic rows reserve the whole invasion lane; additions never need a new placement table.
    const rows=Math.ceil(count/2),spacing=Math.min(6.7,15/Math.max(1,rows-1));
    issues.forEach((issue,i)=>{
      const actor=monster(issue.grade);actor.root.traverse(n=>{if(n.isMesh)n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone();});this.scene.add(actor.root);const x=count<=3?23.5+(i%2)*1.1:19.3+(i%2)*7.1;const z=count<=3?7.2+i*6.1:5.5+Math.floor(i/2)*spacing;
      actor.root.position.set(x,0,z);actor.root.rotation.y=-Math.PI/2;actor.home=actor.root.position.clone();actor.baseScale=actor.root.scale.clone();actor.issue=issue;actor.height=actor.height??5.4;
      if(count>6){const s=Math.max(.48,Math.min(1,Math.sqrt(6/count)));actor.root.scale.multiplyScalar(s);actor.baseScale.copy(actor.root.scale);actor.height*=s;}
      if(actor.mixer)this.mixers.push(actor.mixer);
      this.register(actor,`issue-${issue.id}`,()=>`${issueLabel(issue)} · ${GRADES[issue.grade].ko} · ${targetVersion(issue)}에서 퇴치 예정`);
      this.monsters.push(actor);
      const el=this.label('monster-label','',actor.root,false,actor.height+1.1);
      const badge=document.createElement('span');badge.className='grade-badge';badge.style.setProperty('--grade-color',GRADES[issue.grade].color);badge.textContent=GRADES[issue.grade].en;
      const name=document.createElement('span');name.textContent=issue.name;el.append(badge,name);
    });
  }
  buildEffects(){
    this.sparks=group(this.scene);this.sparks.visible=false;
    for(let i=0;i<18;i++){const m=box(this.sparks,random(.16,.34),random(.16,.34),random(.16,.34),i%3?'#f5c542':'#ffffff');m.material=new THREE.MeshBasicMaterial({color:i%3?'#f5c542':'#ffffff'});m.userData.velocity=new THREE.Vector3(random(-5,5),random(2,7),random(-5,5));}
    this.flame=group(this.scene);this.flame.visible=false;
    for(let i=0;i<20;i++){const m=box(this.flame,1,1,1,i%3?'#f6a050':'#f5c542',0,0,0,true);m.castShadow=false;}
  }
  makeThumbnails(){
    const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,preserveDrawingBuffer:true});renderer.setSize(RENDERING.thumbnailSize,RENDERING.thumbnailSize);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
    const thumbs={hero:thumbnail(renderer,this.hero.root),pet:thumbnail(renderer,this.pet.root)};
    this.crewActors.forEach((a,i)=>{const model=mini(i,a.data.shirt);model.mixer.update(.2);thumbs[`crew-${i}`]=thumbnail(renderer,model.root);});
    Object.keys(GRADES).forEach(grade=>{const m=monster(grade);m.mixer?.update(.2);thumbs[grade]=thumbnail(renderer,m.root);});
    renderer.dispose();renderer.forceContextLoss();this.thumbnails=thumbs;
  }
  label(className,text,target,skew=false,height=0){
    const el=document.createElement('div');el.className='overlay '+className;
    if(skew){const inner=document.createElement('span');inner.className='wall-label-inner';inner.textContent=text;el.append(inner);}else el.textContent=text;
    this.overlay.append(el);this.labels.push({el,target,height});return el;
  }
  bubble(actor,text,duration=3,{fixed=false,battle=false}={}){
    let entry=this.bubbles.find(b=>b.actor===actor);
    if(!entry){const el=document.createElement('div');el.className='overlay bubble';this.overlay.append(el);entry={el,actor,target:actor.root,height:(actor.height??4.5)+2.4};this.bubbles.push(entry);}
    entry.el.textContent=text;entry.el.hidden=false;entry.until=this.elapsed+duration;entry.fixed=fixed||this.reduced;
    const color=/확인 필요/.test(text)?'#f6a050':/커밋!|빌드 통과/.test(text)?'#4fd16b':battle?'#f5c542':'#f4efe0';entry.el.style.setProperty('--bubble-color',color);entry.el.classList.toggle('battle-pop',battle);
    if(this.ready&&(this.reduced||document.hidden))this.render();
  }
  describe(actor){
    const text=actor.describe();this.bubble(actor,text,4.5);this.onLog(text,actor===this.hero||actor===this.pet?'good':'');
    if(actor===this.pet&&!this.reduced)this.pet.jumpUntil=this.elapsed+.85;
  }
  inspect(key){this.clickHandlers.get(key)?.();}
  installEvents(){
    this.canvas.addEventListener('pointermove',event=>{this.canvas.classList.toggle('is-pointing',!!this.hit(event));});
    this.canvas.addEventListener('pointerleave',()=>this.canvas.classList.remove('is-pointing'));
    this.canvas.addEventListener('click',event=>{const actor=this.hit(event);if(actor)this.describe(actor);});
    document.addEventListener('visibilitychange',()=>this.updateMotion());
    window.addEventListener('resize',()=>this.resize());
    this.motionQuery.addEventListener('change',event=>{this.reduced=event.matches;if(this.reduced){this.resetBattle();this.bubbles.forEach(b=>{b.fixed=true;b.el.hidden=false;});this.crewActors.forEach(a=>this.bubble(a,a.status,3,{fixed:true}));}else this.bubbles.forEach(b=>{b.fixed=false;b.until=this.elapsed+3;});this.updateMotion();});
    this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(this.raf)cancelAnimationFrame(this.raf);this.raf=null;this.onMotion('그래픽 연결이 중단되었습니다');});
    this.canvas.addEventListener('webglcontextrestored',()=>location.reload());
  }
  hit(event){
    const rect=this.canvas.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
    const hits=this.raycaster.intersectObjects(this.targets,true);
    for(const hit of hits){let node=hit.object;while(node){if(node.userData.actorKey)return this.actors.find(a=>a.key===node.userData.actorKey);node=node.parent;}}return null;
  }
  resize(){
    if(!this.ready)return;
    this.width=Math.round(this.stage.clientWidth);this.height=Math.round(this.stage.clientHeight);if(!this.width||!this.height)return;
    const aspect=this.width/this.height;
    // Compute the full diorama's projected bounds, then fit with room for HTML bubbles.
    this.camera.left=-50;this.camera.right=50;this.camera.top=50;this.camera.bottom=-50;this.camera.updateProjectionMatrix();
    const coords=[];
    for(const x of [-32,32])for(const y of [-3,15])for(const z of [-24,24])coords.push(new THREE.Vector3(x,y,z).applyMatrix4(this.camera.matrixWorldInverse));
    const minX=Math.min(...coords.map(p=>p.x)),maxX=Math.max(...coords.map(p=>p.x)),minY=Math.min(...coords.map(p=>p.y)),maxY=Math.max(...coords.map(p=>p.y));
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const w=(maxX-minX)*1.08,h=(maxY-minY)*1.10,viewH=Math.max(h,w/aspect),viewW=viewH*aspect;
    this.camera.left=cx-viewW/2;this.camera.right=cx+viewW/2;this.camera.top=cy+viewH/2;this.camera.bottom=cy-viewH/2;this.camera.updateProjectionMatrix();
    const pixelRatio=Math.min(window.devicePixelRatio||1,RENDERING.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);this.renderer.setSize(this.width,this.height,false);
    const renderWidth=Math.min(RENDERING.maxSceneWidth,Math.round(this.width*pixelRatio));
    this.renderTarget.setSize(renderWidth,Math.max(1,Math.round(renderWidth/aspect)));
    this.render();
  }
  updateMotion(){
    if(this.raf)cancelAnimationFrame(this.raf);this.raf=null;this.lastTime=null;
    const paused=document.hidden||this.reduced;
    this.onMotion(this.reduced?'모션 줄이기 · 정지 화면':document.hidden?'잠시 쉬어가는 중':'자율 업무 진행 중');
    if(!this.ready)return;
    if(paused){if(!document.hidden)this.render();return;}
    this.raf=requestAnimationFrame(t=>this.frame(t));
  }
  frame(now){
    this.raf=null;if(document.hidden||this.reduced)return;
    const dt=this.lastTime===null?0:Math.min((now-this.lastTime)/1000,.06);this.lastTime=now;this.elapsed+=dt;
    this.update(dt);this.render();this.raf=requestAnimationFrame(t=>this.frame(t));
  }
  update(dt){
    const t=this.elapsed;this.mixers.forEach(m=>m.update(dt));
    this.crewActors.forEach(actor=>{
      if(actor.data.walker)this.walk(actor,dt);
      else if(actor.status.includes('타이핑')){
        if(actor.bones.head)actor.bones.head.rotation.x=actor.typingPose.head+Math.sin(t*7+actor.index)*.045;
        if(actor.bones['arm-left'])actor.bones['arm-left'].rotation.x=actor.typingPose.left+Math.sin(t*14)*.05;
        if(actor.bones['arm-right'])actor.bones['arm-right'].rotation.x=actor.typingPose.right-Math.sin(t*14)*.05;
        this.metrics.typing++;
      }
    });
    if(t>=this.nextCrew){this.nextCrew=t+random(1.6,2.8);const actor=this.crewActors[Math.floor(Math.random()*4)];actor.statusIndex=(actor.statusIndex+1)%actor.data.statuses.length;actor.status=actor.data.statuses[actor.statusIndex];this.onCrew(actor.index,actor.status);this.bubble(actor,actor.status);this.onLog(`${actor.data.role} · ${actor.status}`,/확인 필요/.test(actor.status)?'warn':/커밋|통과/.test(actor.status)?'good':'');}
    if(t>=this.nextCode){this.nextCode=t+.14;this.codeLines.forEach(line=>{if(this.crewActors[line.crew].status.includes('타이핑'))line.mesh.scale.x=random(.5,2.6);});}
    if(t>=this.nextLed){this.nextLed=t+.4;this.metrics.led++;this.leds.forEach(led=>{const r=Math.random(),color=r<.78?'#4fd16b':r<.87?'#f5c542':r<.97?'#4fb3ff':'#ff8a86';led.material.color.set(color);led.material.emissive.set(color);led.material.emissiveIntensity=Math.random()>.12?1.4:.15;});}
    if(t>=this.nextMeeting){this.nextMeeting=t+random(6,9);const options=[`${PRODUCT.next} 일정 점검`,`이슈 ${activeIssues().length}건 확인`,`발행 ${dDay()}`];const text=options[Math.floor(t)%options.length];this.bubble(this.meeting,text);this.onLog(`회의실 · ${text}`);}
    this.riftCore.material.emissiveIntensity=1.2+Math.sin(t*2.8)*.6;this.riftAura.material.opacity=.12+(Math.sin(t*2.8)+1)*.06;
    const jump=(this.pet.jumpUntil??0)>t?Math.abs(Math.sin(((this.pet.jumpUntil-t)/.85)*Math.PI*2))*1.6:Math.max(0,Math.sin(t*3.2))*.3;this.pet.root.position.y=jump;
    for(const actor of this.monsters){
      if(actor!==this.battle?.actor){if(actor.kind==='slime'){actor.root.scale.y=actor.baseScale.y*(1+Math.sin(t*2.5+actor.home.z)*.05);actor.root.position.y=Math.max(0,Math.sin(t*2.5+actor.home.z))*.17;}if(actor.kind==='dragon')actor.wings.forEach((w,i)=>w.rotation.z=Math.sin(t*2)*.06*(i?1:-1));}
    }
    if(!this.battle&&this.monsters.length&&t>=this.nextBattle)this.startBattle();
    if(this.battle)this.updateBattle();
    this.bubbles.forEach(b=>{if(!b.fixed&&t>b.until)b.el.hidden=true;});
    if(t-this.lastCalendar>30){this.lastCalendar=t;this.boardLabel.textContent=`v${PRODUCT.next} · ${dDay()}`;window.dispatchEvent(new Event('office:calendar'));}
  }
  walk(actor,dt){
    if(actor.wait>0){actor.wait-=dt;actor.setAction('idle');return;}
    actor.setAction('walk');const next=actor.path[actor.pathIndex],dx=next.x-actor.root.position.x,dz=next.z-actor.root.position.z,distance=Math.hypot(dx,dz),step=2.4*dt;
    if(distance<=step){actor.root.position.x=next.x;actor.root.position.z=next.z;actor.pathIndex=(actor.pathIndex+1)%actor.path.length;if(next.stop!==undefined){actor.wait=1.8;actor.status=actor.data.stops[next.stop];this.onCrew(actor.index,actor.status);this.bubble(actor,actor.status);this.onLog(`${actor.data.role} · ${actor.status}`);}return;}
    actor.root.position.x+=dx/distance*step;actor.root.position.z+=dz/distance*step;actor.root.rotation.y=Math.atan2(dx,dz);this.metrics.walk++;
  }
  startBattle(){
    const actor=this.monsters[this.battleCursor%this.monsters.length];this.battleCursor++;
    const type=actor.kind==='dragon'?'breath':'melee';this.battle={actor,type,start:this.elapsed,impact:false,defended:false};this.metrics.combat++;this.metrics[type]++;
    this.nextBattle=this.elapsed+random(2.6,4.2);this.pet.jumpUntil=this.elapsed+.85;this.bubble(this.pet,'삐빅!',1.2,{battle:true});
    const label=issueLabel(actor.issue);this.onLog(`${particle(label)} ${type==='breath'?'브레스를 준비한다':'방어선으로 다가온다'}`,'warn');
    if(type==='melee'){actor.attackPosition=new THREE.Vector3(12.5,0,14.7);actor.setAction?.('walk');}
  }
  updateBattle(){
    const battle=this.battle,actor=battle.actor,t=this.elapsed-battle.start;
    if(battle.type==='melee'){
      if(t<.8){actor.root.position.lerpVectors(actor.home,actor.attackPosition,ease(t/.8));actor.root.rotation.y=Math.atan2(this.hero.home.x-actor.home.x,this.hero.home.z-actor.home.z);}
      else if(t<1.1){actor.setAction?.('idle');if(actor.club)actor.club.rotation.z=-.22-(t-.8)/.3*1.5;else actor.root.scale.y=actor.baseScale.y*(1-(t-.8)/.3*.35);}
      else if(t<1.27){const p=(t-1.1)/.17;this.hero.root.position.x=lerp(this.hero.home.x,10.2,p);this.hero.sword.rotation.z=lerp(-.35,-2.1,p);if(actor.club)actor.club.rotation.z=lerp(-1.72,.4,p);}
      else if(t<2.25){
        if(!battle.impact){battle.impact=true;this.bubble(this.hero,'반격!',1.3,{battle:true});this.onLog(`MDRM 용사가 ${particle(issueLabel(actor.issue),'을/를')} 밀어냈다`,'good');this.sparks.visible=true;this.sparks.position.set(11.5,2.7,14.7);this.flash(actor,true);}
        const p=Math.min(1,(t-1.27)/.9);actor.root.position.lerpVectors(actor.attackPosition,actor.home,ease(p));actor.root.position.y=Math.sin(p*Math.PI)*1.1;this.hero.root.position.lerpVectors(new THREE.Vector3(10.2,0,14.7),this.hero.home,ease(Math.min(1,p*1.4)));this.hero.sword.rotation.z=lerp(-2.1,-.35,p);actor.root.scale.copy(actor.baseScale);if(actor.club)actor.club.rotation.z=lerp(.4,-.22,p);
        const st=t-1.27;this.sparks.children.forEach(s=>{s.position.copy(s.userData.velocity).multiplyScalar(st);s.position.y-=st*st*3;s.scale.setScalar(Math.max(.03,.3-st*.4));});if(st>.14)this.flash(actor,false);if(st>.6)this.sparks.visible=false;
      } else this.resetBattle();
    }else{
      actor.mouth.getWorldPosition(this.projectVector);const origin=this.projectVector.clone(),target=this.hero.root.position.clone().add(new THREE.Vector3(0,2.7,0));
      let growth=t<.8?t/.8:t<1.5?1:Math.max(0,1-(t-1.5)/.55);
      this.flame.visible=growth>0;this.flame.children.forEach((f,i)=>{const p=(i+1)/this.flame.children.length;f.visible=p<=growth;f.position.lerpVectors(origin,target,p);f.position.y+=Math.sin(this.elapsed*17+i*2)*.15;const size=.35+p*.6;f.scale.set(size,size*(.7+Math.sin(this.elapsed*19+i)*.2),size);});
      this.hero.shield.rotation.x=lerp(0,-.65,Math.min(1,t/.55));this.hero.shield.position.z=lerp(.55,1.05,Math.min(1,t/.55));
      if(t>=.7&&!battle.defended){battle.defended=true;this.bubble(this.hero,'방어!',1.3,{battle:true});this.onLog(`MDRM 용사가 ${issueLabel(actor.issue)}의 브레스를 막았다`,'good');}
      if(t>=2.05)this.resetBattle();
    }
  }
  flash(actor,active){
    actor.root.traverse(n=>{if(!n.isMesh)return;const list=Array.isArray(n.material)?n.material:[n.material];list.forEach(m=>{if(!m.emissive)return;if(active){if(!m.userData.savedFlash)m.userData.savedFlash={color:m.emissive.clone(),intensity:m.emissiveIntensity};m.emissive.set('#ffffff');m.emissiveIntensity=2;}else if(m.userData.savedFlash){m.emissive.copy(m.userData.savedFlash.color);m.emissiveIntensity=m.userData.savedFlash.intensity;delete m.userData.savedFlash;}});});
  }
  resetBattle(){
    if(this.battle){const actor=this.battle.actor;actor.root.position.copy(actor.home);actor.root.scale.copy(actor.baseScale);actor.root.rotation.y=-Math.PI/2;actor.setAction?.('idle');if(actor.club)actor.club.rotation.z=-.22;this.flash(actor,false);}
    if(this.hero){this.hero.root.position.copy(this.hero.home);this.hero.sword.rotation.z=-.35;this.hero.shield.rotation.x=0;this.hero.shield.position.z=.55;}
    if(this.sparks)this.sparks.visible=false;if(this.flame)this.flame.visible=false;this.battle=null;
  }
  project(target,height=0){
    if(target.isVector3)this.projectVector.copy(target);else target.getWorldPosition(this.projectVector);
    this.projectVector.y+=height;this.projectVector.project(this.camera);
    return {x:(this.projectVector.x*.5+.5)*this.width,y:(-.5*this.projectVector.y+.5)*this.height,z:this.projectVector.z};
  }
  updateOverlays(){
    const bubbles=[];
    for(const entry of this.labels){const p=this.project(entry.target,entry.height);entry.el.style.transform=`translate(${Math.round(p.x)}px,${Math.round(p.y)}px) translate(-50%,-100%)`;}
    // Keep crisp HTML balloons close to their actors; test nearby slots before lifting them.
    for(const entry of this.bubbles){
      if(entry.el.hidden)continue;const p=this.project(entry.target,entry.height);const w=Math.min(this.width-14,entry.el.offsetWidth),h=entry.el.offsetHeight;
      const baseX=Math.max(w/2+6,Math.min(this.width-w/2-6,p.x)),baseY=Math.max(h+8,p.y);
      let best={x:baseX,y:baseY,score:Infinity};
      for(const dy of [0,-h-8,h+8,-2*(h+8)])for(const dx of [0,-w*.65,w*.65,-w,w,-w*1.5,w*1.5]){
        const x=Math.max(w/2+6,Math.min(this.width-w/2-6,baseX+dx)),y=Math.max(h+5,Math.min(this.height-12,baseY+dy));
        let overlap=0;
        for(const b of bubbles){const ox=Math.max(0,(w+b.w)/2+5-Math.abs(x-b.x)),oy=Math.max(0,(h+b.h)/2+5-Math.abs(y-h/2-(b.y-b.h/2)));overlap+=ox*oy;}
        const score=(x-baseX)**2+(y-baseY)**2*1.4+overlap*1000;
        if(score<best.score)best={x,y,score};
      }
      const {x,y}=best;bubbles.push({x,y,w,h});entry.el.style.setProperty('--tail-left',`${Math.max(8,Math.min(w-14,p.x-x+w/2-3))}px`);entry.el.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-100%)`;
    }
  }
  render(){
    if(!this.width||!this.height)return;this.scene.updateMatrixWorld(true);
    this.renderer.setRenderTarget(this.renderTarget);this.renderer.setClearColor(0x18152e,0);this.renderer.clear();this.renderer.render(this.scene,this.camera);this.sceneDrawCalls=this.renderer.info.render.calls;
    this.renderer.setRenderTarget(null);this.renderer.setClearColor(0x18152e,0);this.renderer.clear();this.renderer.render(this.blitScene,this.blitCamera);this.updateOverlays();this.frameCount++;
  }
  snapshot(){
    return {ready:this.ready,elapsed:this.elapsed,frames:this.frameCount,reduced:this.reduced,hidden:document.hidden,metrics:{...this.metrics},issues:this.monsters.map(a=>({id:a.issue.id,grade:a.issue.grade,position:a.root.position.toArray(),screen:this.project(a.root,a.height*.45)})),crew:this.crewActors.map(a=>({key:a.key,status:a.status,position:a.root.position.toArray(),screen:this.project(a.root,2)})),hero:this.project(this.hero.root,3),pet:this.project(this.pet.root,2),rack:this.project(this.actors.find(a=>a.kind==='rack').root,4),assets:this.assets,target:{width:this.renderTarget.width,height:this.renderTarget.height},viewport:{width:this.width,height:this.height},drawCalls:this.sceneDrawCalls,walkObstacles:this.obstacles.map(({name,object})=>{const b=new THREE.Box3().setFromObject(object);return {name,min:b.min.toArray(),max:b.max.toArray()};})};
  }
}
