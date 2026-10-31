import * as THREE from 'three';

// Coordinates of the inner LCD faces in the original Furniture Kit meshes.
// Parenting here preserves the stand/lid's real tilt and all prop transforms.
const FACES={
  computerScreen:{center:[.196344,.171279,-.0520715],width:.379136,rise:.231386,depth:-.032519},
  laptop:{center:[.3,.198874,-.4426765],width:.519386,rise:.264162,depth:-.118165},
};
export function attachDisplay(object,type,{color='#4fd16b',seed=0}={}){
  const face=FACES[type];let surface;
  object.traverse(node=>{if(!surface&&node.name.startsWith(type))surface=node;});
  if(!surface)throw new Error(`화면 면이 없습니다: ${type}`);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=160;
  const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
  const height=Math.hypot(face.rise,face.depth),normal=new THREE.Vector3(0,-face.depth/height,face.rise/height);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(face.width*.97,height*.97),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));
  mesh.name=`${type}-live-display`;mesh.position.set(...face.center).addScaledVector(normal,.0003);mesh.rotation.x=Math.atan2(face.depth,face.rise);surface.add(mesh);
  let previous='';
  const display={mesh,canvas,texture,surface,face,normal,update(time,status='타이핑…'){
    const tick=Math.floor(time*7),key=`${tick}:${status}`;if(key===previous)return;previous=key;
    const testing=/테스트|빌드|검수|확인/.test(status),done=/커밋|통과/.test(status),warning=/확인 필요/.test(status),meeting=type==='laptop';
    ctx.fillStyle='#142638';ctx.fillRect(0,0,256,160);
    ctx.fillStyle='#263e55';ctx.fillRect(0,0,256,15);ctx.fillRect(0,15,36,145);
    ctx.fillStyle=color;ctx.fillRect(7,5,5,5);ctx.fillRect(44,5,54,4);
    ctx.fillStyle='#748a9b';ctx.fillRect(111,5,31,4);
    for(let i=0;i<8;i++){ctx.fillStyle=i===(Math.floor(tick/9)+seed)%8?color:'#4b657d';ctx.fillRect(7,25+i*13,18-(i%3)*3,3);}
    if(meeting){
      ctx.fillStyle='#91a4b8';ctx.fillRect(47,23,132,6);
      for(let i=0;i<5;i++){
        const complete=(Math.floor(tick/5)+i+seed)%9>3;
        ctx.fillStyle=complete?'#4fd16b':'#4b657d';ctx.fillRect(47,40+i*20,7,7);
        ctx.fillStyle=i%2?'#b9c4ff':'#92c7d7';ctx.fillRect(63,41+i*20,68+(i*13)%53,4);
        ctx.fillStyle='#263e55';ctx.fillRect(173,40+i*20,65,7);
        ctx.fillStyle=color;ctx.fillRect(173,40+i*20,12+(tick*3+i*11)%52,7);
      }
    }else if(testing||done){
      ctx.font='10px monospace';ctx.fillStyle=warning?'#ff8a86':done?'#4fd16b':color;
      ctx.fillText(warning?'CHECK REQUIRED':done?'DONE':'RUNNING...',47,31);
      const rows=done?7:2+(Math.floor(tick/3)+seed)%6;
      for(let i=0;i<rows;i++){
        ctx.fillStyle=warning&&i===rows-1?'#ff8a86':'#4fd16b';ctx.fillRect(47,40+i*12,5,5);
        ctx.fillStyle='#a5becb';ctx.fillRect(61,41+i*12,55+(i*29+seed*11)%105,3);
      }
      ctx.fillStyle='#263e55';ctx.fillRect(47,136,192,7);ctx.fillStyle=done?'#4fd16b':color;ctx.fillRect(47,136,done?192:16+(tick*5+seed*29)%177,7);
    }else{
      const row=Math.floor(tick/5)%8,scroll=Math.floor(tick/40);
      for(let i=0;i<8;i++){
        const indent=((i+scroll+seed)%3)*9,y=26+i*14;
        ctx.fillStyle='#4b657d';ctx.fillRect(42,y,4,3);
        let x=55+indent;
        for(let token=0;token<3;token++){
          const width=12+((i+scroll)*11+token*17+seed*7)%39;
          ctx.fillStyle=[color,'#b9c4ff','#92c7d7'][token];
          const visible=i===row&&token===2?Math.max(3,width*(tick%5+1)/5):width;
          ctx.fillRect(x,y,visible,4);x+=width+6;
          if(i===row&&token===2&&tick%4<3){ctx.fillStyle='#f4efe0';ctx.fillRect(x-width-6+visible+2,y-1,2,7);}
        }
      }
      ctx.fillStyle='#4b657d';ctx.fillRect(47,145,80+(tick*4+seed*13)%100,3);
    }
    ctx.fillStyle=color;ctx.fillRect(0,155,256,5);texture.needsUpdate=true;
  }};
  display.update(0);return display;
}
