
/* ============================  THREE.JS  ============================ */
(function(){
  var canvas=document.getElementById('c3d');
  try{var tc=canvas.getContext('webgl')||canvas.getContext('experimental-webgl');if(!tc)return}catch(e){return}
  var W=window.innerWidth,H=window.innerHeight;
  var renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:false,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.setSize(W,H);renderer.setClearColor(0x000000,0);
  var scene=new THREE.Scene();
  var camera=new THREE.PerspectiveCamera(65,W/H,0.1,100);
  camera.position.set(0,0,4.6);

  var bgN=3800,bgPos=new Float32Array(bgN*3);
  for(var i=0;i<bgN;i++){var r=6+Math.random()*16,phi=Math.acos(2*Math.random()-1),theta=Math.random()*Math.PI*2;bgPos[i*3]=r*Math.sin(phi)*Math.cos(theta);bgPos[i*3+1]=r*Math.sin(phi)*Math.sin(theta);bgPos[i*3+2]=r*Math.cos(phi)}
  var bgGeo=new THREE.BufferGeometry();bgGeo.setAttribute('position',new THREE.BufferAttribute(bgPos,3));
  var bgMat=new THREE.PointsMaterial({color:0x00FFEA,size:0.013,transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,depthWrite:false});
  var bgStars=new THREE.Points(bgGeo,bgMat);scene.add(bgStars);
  var gN=600,gPos=new Float32Array(gN*3);
  for(var i=0;i<gN;i++){var r=5+Math.random()*12,phi=Math.acos(2*Math.random()-1),theta=Math.random()*Math.PI*2;gPos[i*3]=r*Math.sin(phi)*Math.cos(theta);gPos[i*3+1]=r*Math.sin(phi)*Math.sin(theta);gPos[i*3+2]=r*Math.cos(phi)}
  var gGeo=new THREE.BufferGeometry();gGeo.setAttribute('position',new THREE.BufferAttribute(gPos,3));
  scene.add(new THREE.Points(gGeo,new THREE.PointsMaterial({color:0xFFB347,size:0.016,transparent:true,opacity:0.18,blending:THREE.AdditiveBlending,depthWrite:false})));

  var sN=2400,sPos=new Float32Array(sN*3),golden=Math.PI*(1+Math.sqrt(5));
  for(var i=0;i<sN;i++){var phi=Math.acos(1-2*(i+0.5)/sN),theta=golden*i,R=1.6;sPos[i*3]=R*Math.sin(phi)*Math.cos(theta);sPos[i*3+1]=R*Math.sin(phi)*Math.sin(theta);sPos[i*3+2]=R*Math.cos(phi)}
  var sGeo=new THREE.BufferGeometry();sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
  var sMat=new THREE.PointsMaterial({color:0x00FFEA,size:0.022,transparent:true,opacity:0.62,blending:THREE.AdditiveBlending,depthWrite:false});
  var sphere=new THREE.Points(sGeo,sMat);sphere.position.set(0,0.55,0);scene.add(sphere);
  var igN=800,igPos=new Float32Array(igN*3);
  for(var i=0;i<igN;i++){var phi=Math.acos(1-2*(i+0.5)/igN),theta=golden*i*1.618,R=1.1;igPos[i*3]=R*Math.sin(phi)*Math.cos(theta);igPos[i*3+1]=R*Math.sin(phi)*Math.sin(theta);igPos[i*3+2]=R*Math.cos(phi)}
  var igGeo=new THREE.BufferGeometry();igGeo.setAttribute('position',new THREE.BufferAttribute(igPos,3));
  var igMat=new THREE.PointsMaterial({color:0x88FFEE,size:0.015,transparent:true,opacity:0.3,blending:THREE.AdditiveBlending,depthWrite:false});
  var innerSphere=new THREE.Points(igGeo,igMat);innerSphere.position.set(0,0.55,0);scene.add(innerSphere);

  var mx=0,my=0,smx=0,smy=0;
  document.addEventListener('mousemove',function(e){mx=(e.clientX/window.innerWidth-0.5)*2;my=-(e.clientY/window.innerHeight-0.5)*2});
  var flashT=0;window._sphereFlash=function(){flashT=1.0};
  window.addEventListener('resize',function(){W=window.innerWidth;H=window.innerHeight;camera.aspect=W/H;camera.updateProjectionMatrix();renderer.setSize(W,H)});

  function loop(){
    requestAnimationFrame(loop);var t=Date.now()*0.001;
    smx+=(mx-smx)*0.04;smy+=(my-smy)*0.04;
    bgStars.rotation.y=t*0.01;bgStars.rotation.x=t*0.005;
    sphere.rotation.y=t*0.13+smx*0.22;sphere.rotation.x=smy*0.16;
    innerSphere.rotation.y=-t*0.2+smx*0.18;innerSphere.rotation.x=-smy*0.12;
    var breathe=1+Math.sin(t*1.05)*0.038;sphere.scale.setScalar(breathe);innerSphere.scale.setScalar(breathe*0.95);
    if(flashT>0){
      flashT=Math.max(0,flashT-0.028);var f=Math.sin(flashT*Math.PI);
      sMat.opacity=0.62+f*0.38;sMat.size=0.022+f*0.018;
      igMat.opacity=0.3+f*0.5;
    } else {sMat.opacity=0.62;sMat.size=0.022;igMat.opacity=0.3}
    renderer.render(scene,camera);
  }
  loop();
})();

/* ============================  ECG WAVEFORM  ============================ */
const EKG_CYCLES = {
  ok:    { cycle:[[0,59],[58,59],[68,52],[78,59],[100,59],[108,64],[116,19],[124,104],[132,59],[152,59],[165,49],[180,59],[200,59]], W:200 },
  warn:  { cycle:[[0,59],[55,59],[64,50],[73,59],[92,59],[99,66],[106,16],[113,108],[120,59],[138,59],[150,46],[164,59],[180,59]], W:180 },
  danger:{ cycle:[[0,59],[48,59],[56,48],[64,59],[80,59],[86,68],[92,12],[98,112],[104,59],[120,59],[131,42],[145,59],[160,59]], W:160 },
};
function buildEkgSvg(state){
  const conf=EKG_CYCLES[state]||EKG_CYCLES.ok;
  const W=conf.W,H=104,N=20;
  function buildPts(n){var pts=[];for(var c=0;c<n;c++)for(var i=0;i<conf.cycle.length;i++)pts.push((c*W+conf.cycle[i][0])+','+conf.cycle[i][1]);return pts.join(' ')}
  var TW=N*W,pts=buildPts(N),grid='';
  for(var x=0;x<=TW;x+=W/4)grid+='<line class="ecg-grid" x1="'+x+'" y1="0" x2="'+x+'" y2="'+H+'"/>';
  for(var y=0;y<=H;y+=H/3)grid+='<line class="ecg-grid" x1="0" y1="'+y+'" x2="'+TW+'" y2="'+y+'"/>';
  return '<svg width="'+TW+'" height="'+H+'" viewBox="0 0 '+TW+' '+H+'" xmlns="http://www.w3.org/2000/svg" class="ecg-svg">'+grid+'<polyline class="ecg-poly" points="'+pts+'"/></svg>';
}
function renderEkg(state){
  const track=document.getElementById('ecgTrack');
  if(!track) return;
  const svg=buildEkgSvg(state==='flatline'?'ok':state);
  track.innerHTML=svg+svg;
}
renderEkg('ok');

/* ============================  MINI WAVES (beneficiary cards)  ============================ */
function buildMiniWaveSvg(){
  var mc=[[0,10],[9,10],[11,5.5],[13,10],[19,10],[21,12],[23,2],[25,18],[27,10],[34,10],[38,7],[42,10],[52,10]];
  var MW=52,MH=20,MN=8;
  function buildMini(){var pts=[];for(var c=0;c<MN;c++)for(var i=0;i<mc.length;i++)pts.push((c*MW+mc[i][0])+','+mc[i][1]);return pts.join(' ')}
  var TW=MN*MW,p=buildMini();
  return '<svg width="'+TW+'" height="'+MH+'" viewBox="0 0 '+TW+' '+MH+'" xmlns="http://www.w3.org/2000/svg"><polyline points="'+p+'"/></svg>';
}

/* ============================  NAVIGATION  ============================ */
function navigate(el){
  var pageId=el.getAttribute('data-page');
  var name=pageId.replace('page-','');
  showPage(name, el);
}
function showPage(name,el){
  document.querySelectorAll('.app-page').forEach(function(p){p.classList.remove('active')});
  document.querySelectorAll('.sb-item').forEach(function(s){s.classList.remove('active')});
  var target=document.getElementById('page-'+name);
  if(target)target.classList.add('active');
  if(!el) el=document.querySelector('.sb-item[data-page="page-'+name+'"]');
  if(el) el.classList.add('active');
  if(name==='assets') loadAssets();
  if(name==='beneficiaries'&&switchData) loadBeneficiaries(switchData.beneficiaries||[]);
  if(name==='settings') populateSettingsPage();
}

function showTriggered(){ document.getElementById('triggered-overlay').classList.add('active'); }
function hideTriggered(){ document.getElementById('triggered-overlay').classList.remove('active'); }

// ══════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════
const API_BASE    = 'http://localhost:3002';
const CHAIN_ID    = 5003;
const CHAIN_HEX   = '0x138B';
const EXPLORER    = 'https://explorer.sepolia.mantle.xyz';
const FACTORY_KEY = 'ds_factory_v1';

const MANTLE_CHAIN_PARAMS = {
  chainId: CHAIN_HEX,
  chainName: 'Mantle Sepolia Testnet',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: ['https://rpc.sepolia.mantle.xyz'],
  blockExplorerUrls: ['https://explorer.sepolia.mantle.xyz'],
};

const FACTORY_ABI = [
  'function createSwitch(uint256 checkInInterval, uint256 gracePeriod) external returns (address)',
  'function getUserSwitch(address owner) external view returns (address)',
  'event SwitchCreated(address indexed owner, address indexed switchAddress)',
];

const FACTORY_BYTECODE = '0x608060405234801561001057600080fd5b50612401806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063309518051461003b578063efac265d14610083575b600080fd5b6100676100493660046101b0565b6001600160a01b039081166000908152602081905260409020541690565b6040516001600160a01b03909116815260200160405180910390f35b6100676100913660046101e0565b336000908152602081905260408120546001600160a01b0316156100fb5760405162461bcd60e51b815260206004820152601e60248201527f466163746f72793a2073776974636820616c7265616479206578697374730000604482015260640160405180910390fd5b600033848460405161010c906101a3565b6001600160a01b03909316835260208301919091526040820152606001604051809103906000f080158015610145573d6000803e3d6000fd5b503360008181526020819052604080822080546001600160a01b0319166001600160a01b0386169081179091559051939450927f9b7d00a51310bc6f1eddf4f8a2d369245731f589184c99f7cea2ed9a28a706b59190a39392505050565b6121c98061020383390190565b6000602082840312156101c257600080fd5b81356001600160a01b03811681146101d957600080fd5b9392505050565b600080604083850312156101f357600080fd5b5050803592602090910135915056fe60806040523480156200001157600080fd5b50604051620021c9380380620021c9833981016040819052620000349162000189565b60017f9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00556001600160a01b038316620000b45760405162461bcd60e51b815260206004820152601760248201527f44656174685377697463683a207a65726f206f776e657200000000000000000060448201526064015b60405180910390fd5b60008211620001065760405162461bcd60e51b815260206004820152601a60248201527f44656174685377697463683a207a65726f20696e74657276616c0000000000006044820152606401620000ab565b60008111620001585760405162461bcd60e51b815260206004820152601e60248201527f44656174685377697463683a207a65726f20677261636520706572696f6400006044820152606401620000ab565b600080546001600160a01b0319166001600160a01b03949094169390931790925560015560025542600355620001ce565b6000806000606084860312156200019f57600080fd5b83516001600160a01b0381168114620001b757600080fd5b602085015160409095015190969495509392505050565b611feb80620001de6000396000f3fe6080604052600436106100f75760003560e01c8063913b722c1161008a578063a9a4715511610059578063a9a4715514610290578063bfd25fa5146102cf578063db6b5246146102e5578063db78dabd146102ed57600080fd5b8063913b722c1461020a578063935a619e1461022c57806397feb9261461024c578063a06db7dc1461026c57600080fd5b8063741c8907116100c6578063741c89071461018e5780637fec8d38146101a8578063853828b6146101bd5780638da5cb5b146101d257600080fd5b8063183ff085146101035780632483f4de1461011a57806359633a1c1461013a5780635c975abb1461015a57600080fd5b366100fe57005b600080fd5b34801561010f57600080fd5b50610118610303565b005b34801561012657600080fd5b506101186101353660046119e8565b6103a2565b34801561014657600080fd5b50610118610155366004611a6e565b61048e565b34801561016657600080fd5b5060045461017990610100900460ff1681565b60405190151581526020015b60405180910390f35b34801561019a57600080fd5b506004546101799060ff1681565b3480156101b457600080fd5b506101186106cd565b3480156101c957600080fd5b50610118610abb565b3480156101de57600080fd5b506000546101f2906001600160a01b031681565b6040516001600160a01b039091168152602001610185565b34801561021657600080fd5b5061021f610d20565b6040516101859190611a90565b34801561023857600080fd5b50610118610247366004611b52565b610e31565b34801561025857600080fd5b50610118610267366004611bd9565b611150565b34801561027857600080fd5b5061028260025481565b604051908152602001610185565b34801561029c57600080fd5b506102a5611367565b6040805195865260208601949094529284019190915215156060830152608082015260a001610185565b3480156102db57600080fd5b5061028260015481565b6101186113b9565b3480156102f957600080fd5b5061028260035481565b6000546001600160a01b031633146103365760405162461bcd60e51b815260040161032d90611c03565b60405180910390fd5b60045460ff16156103595760405162461bcd60e51b815260040161032d90611c33565b4260038190556000546040519182526001600160a01b0316907fa864a8b988e604bb05d6ce75d53efabb5620c45b15380b7bd0c51dcfa71dda03906020015b60405180910390a2565b6000546001600160a01b031633146103cc5760405162461bcd60e51b815260040161032d90611c03565b60045460ff16156103ef5760405162461bcd60e51b815260040161032d90611c33565b6001600160a01b03831660009081526008602052604090205415801561041457508015155b1561046557600780546001810182556000919091527fa66cc928b5edb82af9bd49922954155ab7b0942694bea4ce44661d9a8736c6880180546001600160a01b0319166001600160a01b0385161790555b6001600160a01b0383166000908152600860205260409020610488908383611917565b50505050565b6000546001600160a01b031633146104b85760405162461bcd60e51b815260040161032d90611c03565b60045460ff16156104db5760405162461bcd60e51b815260040161032d90611c33565b6001600160a01b0381166000908152600660205260408120549081900361053d5760405162461bcd60e51b81526020600482015260166024820152751119585d1a14ddda5d18da0e881b9bdd08199bdd5b9960521b604482015260640161032d565b600061054a600183611c80565b60055490915060009061055f90600190611c80565b9050808214610639576005818154811061057b5761057b611c99565b90600052602060002090600302016005838154811061059c5761059c611c99565b60009182526020909120825460039092020180546001600160a01b0319166001600160a01b03909216919091178155600180830154908201556002808201906105e790840182611d4f565b506105f791508390506001611e2c565b600660006005858154811061060e5761060e611c99565b600091825260208083206003909202909101546001600160a01b031683528201929092526040019020555b600580548061064a5761064a611e3f565b60008281526020812060036000199093019283020180546001600160a01b03191681556001810182905590610682600283018261197a565b505090556001600160a01b038416600081815260066020526040808220829055517f72977dad29432f655f11c2f0e72ef5124bb9ade7a512fb7a43a9f504df2234289190a250505050565b60045460ff16156106f05760405162461bcd60e51b815260040161032d90611c33565b6106f8611489565b60025460015460035461070b9190611e2c565b6107159190611e2c565b42116107715760405162461bcd60e51b815260206004820152602560248201527f44656174685377697463683a20677261636520706572696f64206e6f7420656c604482015264185c1cd95960da1b606482015260840161032d565b6005546107c05760405162461bcd60e51b815260206004820152601d60248201527f44656174685377697463683a206e6f2062656e65666963696172696573000000604482015260640161032d565b6000805b60055481101561080857600581815481106107e1576107e1611c99565b906000526020600020906003020160010154826107fe9190611e2c565b91506001016107c4565b50806127101461086d5760405162461bcd60e51b815260206004820152602a60248201527f44656174685377697463683a206261736973506f696e7473206d75737420737560448201526906d20746f2031303030360b41b606482015260840161032d565b6004805460ff1916600117905547801561092a576000808052600860209081527f5eff886ea0ce6ca488a3d6e336d6c0f75f46d19b42c06ce5ee98e42c96d256c780546040805182850281018501909152818152928301828280156108fb57602002820191906000526020600020905b81546001600160a01b031681526001909101906020018083116108dd575b5050505050905060008151111561091d57610918600083836114a5565b610928565b61092860008361163d565b505b60005b600754811015610a6c5760006007828154811061094c5761094c611c99565b60009182526020822001546040516370a0823160e01b81523060048201526001600160a01b03909116925082906370a0823190602401602060405180830381865afa15801561099f573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906109c39190611e55565b90508015610a62576001600160a01b038216600090815260086020908152604080832080548251818502810185019093528083529192909190830182828015610a3557602002820191906000526020600020905b81546001600160a01b03168152600190910190602001808311610a17575b50505050509050600081511115610a5657610a518383836114a5565b610a60565b610a60838361163d565b505b505060010161092d565b506040514281527fcdeba0448cafa891383055f46f2fec420e049fab5171b5b30b5458c0320f68fb9060200160405180910390a15050610ab96001600080516020611f9683398151915255565b565b6000546001600160a01b03163314610ae55760405162461bcd60e51b815260040161032d90611c03565b60045460ff1615610b085760405162461bcd60e51b815260040161032d90611c33565b610b10611489565b478015610bfe57600080546040516001600160a01b039091169083908381818185875af1925050503d8060008114610b64576040519150601f19603f3d011682016040523d82523d6000602084013e610b69565b606091505b5050905080610bc65760405162461bcd60e51b815260206004820152602360248201527f44656174685377697463683a206e6174697665207472616e73666572206661696044820152621b195960ea1b606482015260840161032d565b6040518281526000907f7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d59060200160405180910390a2505b60005b600754811015610d0757600060078281548110610c2057610c20611c99565b60009182526020822001546040516370a0823160e01b81523060048201526001600160a01b03909116925082906370a0823190602401602060405180830381865afa158015610c73573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906109c39190611e55565b90508015610cfd57600054610cb9906001600160a01b038481169116836116df565b816001600160a01b03167f7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d582604051610cf491815260200190565b60405180910390a25b5050600101610c01565b5050610ab96001600080516020611f9683398151915255565b60606005805480602002602001604051908101604052809291908181526020016000905b82821015610e28576000848152602090819020604080516060810182526003860290920180546001600160a01b0316835260018101549383019390935260028301805492939291840191610d9790611caf565b80601f0160208091040260200160405190810160405280929190818152602001828054610dc390611caf565b8015610e105780601f10610de557610100808354040283529160200191610e10565b820191906000526020600020905b815481529060010190602001808311610df357829003601f168201915b50505050508152505081526020019060010190610d44565b50505050905090565b6000546001600160a01b03163314610e5b5760405162461bcd60e51b815260040161032d90611c03565b60045460ff1615610e7e5760405162461bcd60e51b815260040161032d90611c33565b6001600160a01b038416610ed45760405162461bcd60e51b815260206004820152601860248201527f44656174685377697463683a207a65726f2077616c6c65740000000000000000604482015260640161032d565b60008311610f245760405162461bcd60e51b815260206004820152601d60248201527f44656174685377697463683a207a65726f206261736973506f696e7473000000604482015260640161032d565b6001600160a01b03841660009081526006602052604090205415610f8a5760405162461bcd60e51b815260206004820152601b60248201527f44656174685377697463683a20616c7265616479206578697374730000000000604482015260640161032d565b8260005b600554811015610fd25760058181548110610fab57610fab611c99565b90600052602060002090600302016001015482610fc89190611e2c565b9150600101610f8e565b506127108111156110345760405162461bcd60e51b815260206004820152602660248201527f44656174685377697463683a2065786365656473203130303030206261736973604482015265506f696e747360d01b606482015260840161032d565b60056040518060600160405280876001600160a01b0316815260200186815260200185858080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920182905250939094525050835460018082018655948252602091829020845160039092020180546001600160a01b0319166001600160a01b03909216919091178155908301519381019390935550604081015190919060028201906110e89082611e6e565b50506005546001600160a01b038716600081815260066020526040908190209290925590519091507f528333b96a944ae26c836e446cbc62d44a8f3b3c173e7fd4ca6d95fad9703f4b9061114190879087908790611f26565b60405180910390a25050505050565b6000546001600160a01b0316331461117a5760405162461bcd60e51b815260040161032d90611c03565b60045460ff161561119d5760405162461bcd60e51b815260040161032d90611c33565b6111a5611489565b6001600160a01b0382166111fb5760405162461bcd60e51b815260206004820152601760248201527f44656174685377697463683a207a65726f20746f6b656e000000000000000000604482015260640161032d565b6000811161124b5760405162461bcd60e51b815260206004820152601860248201527f44656174685377697463683a207a65726f20616d6f756e740000000000000000604482015260640161032d565b6112606001600160a01b038316333084611714565b6000805b6007548110156112b657836001600160a01b03166007828154811061128b5761128b611c99565b6000918252602090912001546001600160a01b0316036112ae57600191506112b6565b600101611264565b508061130857600780546001810182556000919091527fa66cc928b5edb82af9bd49922954155ab7b0942694bea4ce44661d9a8736c6880180546001600160a01b0319166001600160a01b0385161790555b826001600160a01b03167f2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c48360405161134391815260200190565b60405180910390a2506113636001600080516020611f9683398151915255565b5050565b60008060008060006003546001546003546113829190611e2c565b6002546001546003546113959190611e2c565b61139f9190611e2c565b600454600554939992985090965060ff1694509092509050565b6000546001600160a01b031633146113e35760405162461bcd60e51b815260040161032d90611c03565b60045460ff16156114065760405162461bcd60e51b815260040161032d90611c33565b600034116114565760405162461bcd60e51b815260206004820152601760248201527f44656174685377697463683a207a65726f2076616c7565000000000000000000604482015260640161032d565b6040513481526000907f2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c490602001610398565b61149161174a565b6002600080516020611f9683398151915255565b6000805b8251811015611543576000600660008584815181106114ca576114ca611c99565b60200260200101516001600160a01b03166001600160a01b031681526020019081526020016000205490508060001461153a57600561150a600183611c80565b8154811061151a5761151a611c99565b906000526020600020906003020160010154836115379190611e2c565b92505b506001016114a9565b50806000036115525750505050565b60005b82518110156116365760006006600085848151811061157657611576611c99565b60200260200101516001600160a01b03166001600160a01b03168152602001908152602001600020549050806000036115af575061162e565b60008360056115bf600185611c80565b815481106115cf576115cf611c99565b906000526020600020906003020160010154876115ec9190611f5c565b6115f69190611f73565b90508060000361160757505061162e565b61162b8786858151811061161d5761161d611c99565b60200260200101518361177a565b50505b600101611555565b5050505050565b60005b6005548110156116da5760006127106005838154811061166257611662611c99565b9060005260206000209060030201600101548461167f9190611f5c565b6116899190611f73565b90508060000361169957506116d2565b6116d084600584815481106116b0576116b0611c99565b60009182526020909120600390910201546001600160a01b03168361177a565b505b600101611640565b505050565b6116ec838383600161183f565b6116da57604051635274afe760e01b81526001600160a01b038416600482015260240161032d565b6117228484848460016118a5565b61048857604051635274afe760e01b81526001600160a01b038516600482015260240161032d565b600080516020611f9683398151915254600203610ab957604051633ee5aeb560e01b815260040160405180910390fd5b6001600160a01b03831661182b576000826001600160a01b03168260405160006040518083038185875af1925050503d80600081146117d5576040519150601f19603f3d011682016040523d82523d6000602084013e6117da565b606091505b50509050806104885760405162461bcd60e51b815260206004820152601f60248201527f44656174685377697463683a206e61746976652073656e64206661696c656400604082015260640161032d565b6116da6001600160a01b03841683836116df565b60405163a9059cbb60e01b60008181526001600160a01b038616600452602485905291602083604481808b5af19250600160005114831661189957838315161561188c573d6000823e3d81fd5b6000873b113d1516831692505b60405250949350505050565b6040516323b872dd60e01b60008181526001600160a01b038781166004528616602452604485905291602083606481808c5af1925060016000511483166119055783831516156118f8573d6000823e3d81fd5b6000883b113d1516831692505b60405250600060605295945050505050565b82805482825590600052602060002090810192821561196a579160200282015b8281111561196a5781546001600160a01b0319166001600160a01b03843516178255602090920191600190910190611937565b506119769291506119b7565b5090565b50805461198690611caf565b6000825580601f10611996575050565b601f0160209004906000526020600020908101906119b491906119b7565b50565b5b8082111561197657600081556001016119b8565b80356001600160a01b03811681146119e357600080fd5b919050565b6000806000604084860312156119fd57600080fd5b611a06846119cc565b9250602084013567ffffffffffffffff80821115611a2357600080fd5b818601915086601f830112611a3757600080fd5b813581811115611a4657600080fd5b8760208260051b8501011115611a5b57600080fd5b6020830194508093505050509250925092565b600060208284031215611a8057600080fd5b611a89826119cc565b9392505050565b600060208083018184528085518083526040925060408601915060408160051b8701018488016000805b84811015611b4357898403603f19018652825180516001600160a01b0316855288810151898601528701516060888601819052815190860181905283905b80821015611b16578282018b015187830160800152908a0190611af8565b8681016080908101869052988b0198601f909101601f191690960190950194505091870191600101611aba565b50919998505050505050505050565b60008060008060608587031215611b6857600080fd5b611b71856119cc565b935060208501359250604085013567ffffffffffffffff80821115611b9557600080fd5b818701915087601f830112611ba957600080fd5b813581811115611bb857600080fd5b886020828501011115611bca57600080fd5b95989497505060200194505050565b60008060408385031215611bec57600080fd5b611bf5836119cc565b946020939093013593505050565b6020808252601690820152752232b0ba3429bbb4ba31b41d103737ba1037bbb732b960511b604082015260600190565b6020808252601e908201527f44656174685377697463683a20616c7265616479207472696767657265640000604082015260600190565b634e487b7160e01b600052601160045260246000fd5b81810381811115611c9357611c93611c6a565b92915050565b634e487b7160e01b600052603260045260246000fd5b600181811c90821680611cc357607f821691505b602082108103611ce357634e487b7160e01b600052602260045260246000fd5b50919050565b634e487b7160e01b600052604160045260246000fd5b601f8211156116da576000816000526020600020601f850160051c81016020861015611d285750805b601f850160051c820191505b81811015611d4757828155600101611d34565b505050505050565b818103611d5a575050565b611d648254611caf565b67ffffffffffffffff811115611d7c57611d7c611ce9565b611d9081611d8a8454611caf565b84611cff565b6000601f821160018114611dc45760008315611dac5750848201545b600019600385901b1c1916600184901b178455611636565b600085815260209020601f19841690600086815260209020845b83811015611dfe5782860154825560019586019590910190602001611dde565b5085831015611e1c5781850154600019600388901b60f8161c191681555b5050505050600190811b01905550565b80820180821115611c9357611c93611c6a565b634e487b7160e01b600052603160045260246000fd5b600060208284031215611e6757600080fd5b5051919050565b815167ffffffffffffffff811115611e8857611e88611ce9565b611e9681611d8a8454611caf565b602080601f831160018114611ecb5760008415611eb35750858301515b600019600386901b1c1916600185901b178555611d47565b600085815260208120601f198616915b82811015611efa57888601518255948401946001909101908401611edb565b5085821015611e1c57939096015160001960f8600387901b161c19169092555050600190811b01905550565b83815260406020820152816040820152818360608301376000818301606090810191909152601f909201601f1916010192915050565b8082028115828204841417611c9357611c93611c6a565b600082611f9057634e487b7160e01b600052601260045260246000fd5b50049056fe9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00a2646970667358221220780d54b8f48dfe31ba350343fe014ef1437e560d165b63654265e82b1461a92364736f6c63430008180033a26469706673582212201f53e0b4f506a5b89fc7eafbebd90f148198256309c7f9f198ac56158b9548d664736f6c63430008180033';

const SWITCH_ABI = [
  'function checkIn() external',
  'function addBeneficiary(address wallet, uint256 basisPoints, string calldata label) external',
  'function removeBeneficiary(address wallet) external',
  'function withdrawAll() external',
  'function getSwitchStatus() external view returns (uint256,uint256,uint256,bool,uint256)',
  'function depositNative() external payable',
  'function depositERC20(address token, uint256 amount) external',
];

const ERC20_ABI_FE = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

let provider = null, signer = null, userAddr = null, jwt = null, switchData = null;
let _countdownTimer = null;
let factoryAddress = localStorage.getItem(FACTORY_KEY) || null;
console.log('[DeathSwitch] Factory address from storage:', factoryAddress);

// ══════════════════════════════════════
//  CONNECT WALLET
// ══════════════════════════════════════
async function connectWallet() {
  if (!window.ethereum) { toast('No wallet extension found. Please install Rabby or MetaMask.', 'error'); return; }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    signer   = await provider.getSigner();
    userAddr = await signer.getAddress();
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) {
      await switchNetwork();
      provider = new ethers.BrowserProvider(window.ethereum);
      signer   = await provider.getSigner();
      userAddr = await signer.getAddress();
    }
    document.getElementById('conn-addr').textContent = userAddr.slice(0,6)+'...'+userAddr.slice(-4);
    document.getElementById('page-connect').classList.remove('active');
    if (!factoryAddress) {
      const bal = await provider.getBalance(userAddr);
      document.getElementById('deploy-addr-label').textContent = userAddr.slice(0,6)+'...'+userAddr.slice(-4);
      document.getElementById('deploy-balance-label').textContent = parseFloat(ethers.formatEther(bal)).toFixed(4)+' MNT';
      document.getElementById('deploy-screen').classList.add('show');
    } else { await enterApp(); }
    window.ethereum.on('accountsChanged', () => location.reload());
    window.ethereum.on('chainChanged',    () => location.reload());
  } catch(e) { toast('Connection failed: '+(e.shortMessage||e.message), 'error'); }
}

async function switchNetwork() {
  try { await window.ethereum.request({ method:'wallet_switchEthereumChain', params:[{chainId:CHAIN_HEX}] }); }
  catch(e) { if (e.code===4902) { await window.ethereum.request({ method:'wallet_addEthereumChain', params:[MANTLE_CHAIN_PARAMS] }); } else { throw e; } }
}

async function deployFactory() {
  const btn = document.getElementById('deploy-factory-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Waiting for wallet confirmation...';
  try {
    const factory = new ethers.ContractFactory(FACTORY_ABI, FACTORY_BYTECODE, signer);
    const contract = await factory.deploy();
    const txHash = contract.deploymentTransaction().hash;
    btn.innerHTML = '<span class="spinner"></span> Confirming... ('+txHash.slice(0,10)+'...)';
    factoryAddress = await pollForContractAddress(txHash);
    localStorage.setItem(FACTORY_KEY, factoryAddress);
    toast('Factory deployed! 🎉', 'success');
    document.getElementById('deploy-screen').classList.remove('show');
    await enterApp();
  } catch(e) {
    toast('Deploy failed: '+(e.shortMessage||e.message), 'error');
    btn.disabled = false;
    btn.innerHTML = '🚀 Deploy Factory Contract';
  }
}

async function pollTx(txHash, maxWaitMs=120000) {
  const start = Date.now();
  while (Date.now()-start < maxWaitMs) {
    await new Promise(r => setTimeout(r,3000));
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) { if (receipt.status===0) throw new Error('Transaction reverted on-chain'); return receipt; }
  }
  throw new Error('Transaction not confirmed after 2 min. Check: '+EXPLORER+'/tx/'+txHash);
}

async function pollForContractAddress(txHash, maxWaitMs=120000) {
  const start = Date.now();
  while (Date.now()-start < maxWaitMs) {
    await new Promise(r => setTimeout(r,3000));
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) {
      if (receipt.status===0) throw new Error('Transaction failed (reverted)');
      if (receipt.contractAddress) return receipt.contractAddress;
      throw new Error('No contract address in receipt');
    }
  }
  throw new Error('Transaction not confirmed after 2 minutes. Check explorer: '+EXPLORER+'/tx/'+txHash);
}

function resetFactory() { localStorage.removeItem(FACTORY_KEY); factoryAddress=null; location.reload(); }

async function resetSwitchAndRedeploy() {
  if (!confirm(
    'This will permanently delete your current switch record from the backend and take you back to the deployment screen.\n\n' +
    'Your old contract remains on-chain (unused), but this app will no longer track it.\n\n' +
    'You will need to deploy a new contract and re-add all beneficiaries.\n\nContinue?'
  )) return;
  try {
    toast('Deleting switch record...','info');
    const res = await apiFetch('/switch', 'DELETE');
    if(!res.success) throw new Error(res.error||'Delete failed');
    switchData = null;
    if(_countdownTimer){ clearInterval(_countdownTimer); _countdownTimer=null; }
    if(_pollTimer){ clearInterval(_pollTimer); _pollTimer=null; }
    toast('Switch reset. Redirecting to deploy screen...','success');
    setTimeout(()=>{
      document.getElementById('app-layout').classList.remove('visible');
      document.getElementById('page-connect').classList.remove('active');
      const bl=document.getElementById('deploy-addr-label'), bn=document.getElementById('deploy-balance-label');
      if(bl) bl.textContent=userAddr.slice(0,6)+'...'+userAddr.slice(-4);
      provider.getBalance(userAddr).then(bal=>{ if(bn) bn.textContent=parseFloat(ethers.formatEther(bal)).toFixed(4)+' MNT'; });
      document.getElementById('deploy-screen').classList.add('show');
    }, 1200);
  } catch(err) {
    toast('Reset failed: '+(err.message||err),'error');
  }
}

function resetAndRedeploy() {
  if (!confirm('This will clear the saved factory address and take you back to the deploy screen. Continue?')) return;
  localStorage.removeItem(FACTORY_KEY); factoryAddress=null;
  document.getElementById('app-layout').classList.remove('visible');
  document.getElementById('page-connect').classList.remove('active');
  const bl=document.getElementById('deploy-addr-label'), bn=document.getElementById('deploy-balance-label');
  if(bl) bl.textContent=userAddr.slice(0,6)+'...'+userAddr.slice(-4);
  provider.getBalance(userAddr).then(bal=>{ if(bn) bn.textContent=parseFloat(ethers.formatEther(bal)).toFixed(4)+' MNT'; });
  document.getElementById('deploy-screen').classList.add('show');
  toast('Factory reset. Please deploy a fresh factory contract.','info');
}

function useExistingFactory() {
  const addr=document.getElementById('existing-factory-input').value.trim();
  if(!addr||!addr.startsWith('0x')) return toast('Enter a valid 0x... address','error');
  factoryAddress=addr; localStorage.setItem(FACTORY_KEY,factoryAddress);
  document.getElementById('deploy-screen').classList.remove('show'); enterApp();
}

async function enterApp() {
  await siweLogin();
  document.getElementById('app-layout').classList.add('visible');
  const network=await provider.getNetwork();
  const netChip=document.getElementById('conn-net-chip');
  document.getElementById('conn-net').textContent=Number(network.chainId)===CHAIN_ID?'Mantle Sepolia':'Wrong Network';
  if(Number(network.chainId)!==CHAIN_ID){
    document.getElementById('net-warn').classList.add('show');
    if(netChip) netChip.classList.add('warn');
  } else if(netChip) netChip.classList.remove('warn');
  await loadDashboard();
}

async function siweLogin() {
  const nonceRes=await apiFetch('/auth/nonce','POST',{walletAddress:userAddr});
  const nonce=nonceRes.data?.nonce||nonceRes.nonce;
  const domain=window.location.hostname||'localhost';
  const message=[
    `${domain} wants you to sign in with your Ethereum account:`,
    userAddr,'','Sign in to DeathSwitch','',
    `URI: ${window.location.origin||'http://localhost'}`,
    'Version: 1',`Chain ID: ${CHAIN_ID}`,`Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');
  const signature=await signer.signMessage(message);
  const authRes=await apiFetch('/auth/verify','POST',{message,signature});
  jwt=authRes.data?.token||authRes.token;
}

async function loadDashboard() {
  const res=await apiFetch('/switch','GET');
  if(res.success&&res.data){switchData=res.data;showSwitchInfo();}else showNoSwitch();
}

function showNoSwitch() {
  document.getElementById('no-switch-banner').style.display='block';
  document.getElementById('switch-info').style.display='none';
  ['deploy-interval-d','deploy-interval-h','deploy-interval-m','deploy-grace-d','deploy-grace-h','deploy-grace-m'].forEach(id=>{
    const el=document.getElementById(id);
    if(el && !el._previewWired){ el.addEventListener('input',updateDeployPreview); el._previewWired=true; }
  });
  updateDeployPreview();
}

let _pollTimer = null;

function showSwitchInfo() {
  document.getElementById('no-switch-banner').style.display='none';
  document.getElementById('switch-info').style.display='block';
  const d=switchData;
  const isTriggered = d.status==='TRIGGERED' || d.onChainTriggered;

  const statusLabel=d.status.replace('_',' ');
  document.getElementById('stat-status').innerHTML=`<div class="stat-dot"></div>${statusLabel}`;
  document.getElementById('stat-status-text').textContent=statusLabel;
  document.getElementById('cfg-status').textContent=statusLabel;
  document.getElementById('tb-status').textContent=statusLabel;
  document.getElementById('stat-stage').textContent=`${d.escalationStage} / 4`;
  document.getElementById('stat-stage-label').textContent=['None','Email sent','SMS sent','Call logged','Triggered'][d.escalationStage]||'';
  const beneCount=d.beneficiaries?.length??0;
  document.getElementById('stat-bene').textContent=beneCount;
  const usedBp=(d.beneficiaries||[]).reduce((s,b)=>s+b.basisPoints,0);
  document.getElementById('stat-bene-sub').textContent=beneCount?`${usedBp/100}% allocated`:'No beneficiaries';
  document.getElementById('contract-addr').textContent=d.contractAddress.slice(0,8)+'...'+d.contractAddress.slice(-6);
  document.getElementById('explorer-link').href=`${EXPLORER}/address/${d.contractAddress}`;
  document.getElementById('cfg-interval').textContent=secsToLabel(d.checkInIntervalSecs);
  document.getElementById('cfg-grace').textContent=secsToLabel(d.gracePeriodSecs);
  document.getElementById('tb-grace').textContent=secsToLabel(d.gracePeriodSecs);
  if(d.gracePeriodDue) document.getElementById('cfg-deadline').textContent=new Date(d.gracePeriodDue).toLocaleString();

  const trigZone=document.getElementById('trigger-action-zone');

  // TRIGGERED state — show big banner, flatline EKG, hide check-in
  if(isTriggered) {
    if(_countdownTimer){ clearInterval(_countdownTimer); _countdownTimer=null; }
    if(_pollTimer){ clearInterval(_pollTimer); _pollTimer=null; }
    showTriggeredOverlay();
    setEkgState('flatline');
    document.getElementById('countdown').textContent='TRIGGERED';
    document.getElementById('vt-timer').textContent='—';
    const pulseBtn=document.getElementById('pulseBtn');
    if(pulseBtn){ pulseBtn.disabled=true; }
    document.getElementById('pulseBtnLabel').textContent='TRIGGERED';
    document.getElementById('checkin-sub').textContent='This switch has been triggered and assets distributed.';
    if(trigZone) trigZone.innerHTML='';
  } else {
    hideTriggered();
    const pulseBtn=document.getElementById('pulseBtn');
    if(pulseBtn){ pulseBtn.disabled=false; }
    document.getElementById('pulseBtnLabel').textContent='CONFIRM';
    startCountdown(d.nextCheckInDue,d.checkInIntervalSecs);

    if(_pollTimer){ clearInterval(_pollTimer); _pollTimer=null; }
    _pollTimer = setInterval(async ()=>{
      const res=await apiFetch('/switch','GET');
      if(res.success&&res.data){
        switchData=res.data;
        if(res.data.status==='TRIGGERED'||res.data.onChainTriggered){
          clearInterval(_pollTimer); _pollTimer=null;
          showSwitchInfo();
        }
      }
    }, 5000);

    updateForceTriggerBtn();
  }

  loadBeneficiaries(d.beneficiaries||[]);
  renderDashboardBeneficiaries(d.beneficiaries||[]);
  loadAssets();
}

function showTriggeredOverlay() {
  const list=document.getElementById('trig-bene-list');
  if(list){
    const benes=switchData?.beneficiaries||[];
    list.innerHTML = benes.length ? benes.map((b,i)=>{
      const initials=(b.label||'?').slice(0,2).toUpperCase();
      const avClass='av'+((i%3)+1);
      return `<div class="trig-bene">
        <div class="trig-bene-info"><div class="av ${avClass}" style="width:34px;height:34px;font-size:11px">${initials}</div>${b.label} — ${b.basisPoints/100}%</div>
        <div class="trig-bene-badge">✓ Assets Sent</div>
      </div>`;
    }).join('') : '';
  }
  const link=document.getElementById('trig-contract-link');
  if(link) link.href=`${EXPLORER}/address/${switchData?.contractAddress||''}`;
  showTriggered();
}

function updateForceTriggerBtn() {
  const d=switchData;
  if(!d) return;
  const overdue = new Date(d.nextCheckInDue) < new Date();
  const notTriggered = d.status!=='TRIGGERED' && !d.onChainTriggered;
  const zone=document.getElementById('trigger-action-zone');
  if(!zone) return;
  if(overdue && notTriggered) {
    if(!document.getElementById('force-trigger-btn')) {
      zone.innerHTML=`
      <div class="panel" id="force-trigger-btn" style="margin-top:18px;border-color:rgba(255,70,70,.25);background:rgba(255,70,70,.03);">
        <div style="font-family:var(--mono);font-size:10px;font-weight:700;color:#FF6B6B;text-transform:uppercase;letter-spacing:.2em;margin-bottom:8px;">⏰ Grace Period Active</div>
        <div style="font-size:13px;color:var(--tm);margin-bottom:14px;line-height:1.7;">
          Check-in deadline has passed. The watchdog will trigger automatically.<br>
          You can also force a trigger attempt right now to test:
        </div>
        <button class="btn btn-danger btn-sm" onclick="forceTrigger()" id="force-trigger-do-btn">🚨 Force Trigger Now</button>
        <div id="force-trigger-result" style="margin-top:10px;font-size:12px;font-family:var(--mono);display:none;"></div>
      </div>`;
    }
  } else {
    zone.innerHTML='';
  }
}

async function forceTrigger() {
  const btn=document.getElementById('force-trigger-do-btn');
  const result=document.getElementById('force-trigger-result');
  if(!btn||!result) return;
  btn.disabled=true; btn.textContent='Triggering...';
  result.style.display='none';
  try {
    const res=await apiFetch('/switch/force-trigger','POST');
    result.style.display='block';
    if(res.success) {
      result.style.color='var(--c)';
      result.textContent=res.alreadyTriggered ? '✅ Already triggered on-chain. Synced.' : `✅ Success! Tx: ${res.txHash}`;
      await loadDashboard();
    } else {
      result.style.color='#FF6B6B';
      result.textContent='❌ '+res.error;
      btn.disabled=false; btn.textContent='🚨 Force Trigger Now';
    }
  } catch(e) {
    result.style.display='block';
    result.style.color='#FF6B6B';
    result.textContent='❌ '+(e.message||e);
    btn.disabled=false; btn.textContent='🚨 Force Trigger Now';
  }
}

let _lastEkgState = '';

function setEkgState(state) {
  if(_lastEkgState === state) return;
  _lastEkgState = state;
  const bar=document.getElementById('ecg-bar');
  if(bar) bar.className='ecg-bar'+(state!=='ok'?' '+state:'');
  renderEkg(state);
}

function startCountdown(dueStr,intervalSecs) {
  if(_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer=null; }
  _lastEkgState = '';
  const el=document.getElementById('countdown');
  const sub=document.getElementById('checkin-sub');
  const vt=document.getElementById('vt-timer');
  const due=new Date(dueStr);
  function tick() {
    const diff=due.getTime()-Date.now();
    if(diff<=0){
      el.textContent='OVERDUE'; el.style.color='#FF6B6B';
      if(vt) vt.textContent='OVERDUE';
      sub.textContent=`Overdue since ${due.toLocaleString()} — grace period in effect`;
      setEkgState('danger'); return;
    }
    const h=Math.floor(diff/3600000);
    const m=Math.floor((diff%3600000)/60000);
    const s=Math.floor((diff%60000)/1000);
    const d=Math.floor(h/24), hh=h%24;
    el.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if(vt) vt.textContent=d>0?`${d}d ${hh}h`:`${hh}h ${m}m`;
    sub.textContent=`Next check-in due: ${due.toLocaleString()}`;
    const pct=Math.max(0,Math.min(100,(diff/(intervalSecs*1000))*100));
    if(pct<20){
      el.style.color='#FF6B6B'; setEkgState('danger');
    } else if(pct<50){
      el.style.color='var(--g)'; setEkgState('warn');
    } else {
      el.style.color='var(--t)'; setEkgState('ok');
    }
  }
  tick(); _countdownTimer=setInterval(tick,1000);
}

async function createSwitch() {
  const intervalSecs = readDHM('deploy-interval-d','deploy-interval-h','deploy-interval-m') || 60;
  const graceSecs    = readDHM('deploy-grace-d','deploy-grace-h','deploy-grace-m')    || 60;
  if(intervalSecs < 60) { toast('Interval must be at least 1 minute','error'); return; }
  if(graceSecs < 60)    { toast('Grace period must be at least 1 minute','error'); return; }
  toast('Check your wallet for confirmation...','info');
  try {
    const factory=new ethers.Contract(factoryAddress,FACTORY_ABI,signer);
    const tx=await factory.createSwitch(intervalSecs,graceSecs);
    toast('Transaction sent, confirming... ('+tx.hash.slice(0,10)+'...)','success');
    let receipt=null; const start=Date.now();
    while(!receipt&&Date.now()-start<120000){
      await new Promise(r=>setTimeout(r,3000));
      receipt=await provider.getTransactionReceipt(tx.hash);
    }
    if(!receipt) throw new Error('Transaction not confirmed after 2 minutes');
    if(receipt.status===0) throw new Error('Transaction reverted on-chain');
    const iface=new ethers.Interface(FACTORY_ABI);
    let contractAddress='';
    for(const log of receipt.logs){
      try{const p=iface.parseLog({topics:[...log.topics],data:log.data});if(p?.name==='SwitchCreated'){contractAddress=p.args.switchAddress;break;}}catch{}
    }
    if(!contractAddress){const fc=new ethers.Contract(factoryAddress,FACTORY_ABI,provider);contractAddress=await fc.getUserSwitch(userAddr);}
    if(!contractAddress||contractAddress==='0x0000000000000000000000000000000000000000') throw new Error('No contract address found');
    const res=await apiFetch('/switch/create','POST',{contractAddress,checkInIntervalSecs:intervalSecs,gracePeriodSecs:graceSecs});
    if(res.success){toast('Switch deployed! 🎉','success');await loadDashboard();}
    else throw new Error(res.error);
  } catch(e) {
    const msg=e.reason||e.shortMessage||e.message||String(e);
    if(msg.includes('insufficient funds')||msg.includes('not enough')) toast('❌ Not enough testnet MNT for gas. Get some at faucet.sepolia.mantle.xyz','error');
    else if(msg.includes('user rejected')||msg.includes('User rejected')||msg.includes('4001')) toast('Transaction cancelled in wallet','error');
    else if(msg.includes('already exists')) toast('You already have a switch deployed. Refresh the page.','error');
    else if(msg.includes('network')||msg.includes('could not detect')) toast('❌ Network error — make sure you are on Mantle Sepolia','error');
    else toast('❌ '+msg.slice(0,120),'error');
  }
}

async function doCheckin() {
  const btn=document.getElementById('pulseBtn');
  const label=document.getElementById('pulseBtnLabel');
  if(btn.disabled) return;
  btn.disabled=true; label.textContent='...';
  try {
    const sw=new ethers.Contract(switchData.contractAddress,SWITCH_ABI,signer);
    const tx=await sw.checkIn();
    label.textContent='Confirming';
    const receipt=await pollTx(tx.hash);
    await apiFetch('/checkin','POST',{txHash:receipt.hash});
    if(window._sphereFlash)window._sphereFlash();
    toast('Pulse confirmed — you\\'re still here ♥','success');
    await loadDashboard();
  } catch(e) { toast('Check-in failed: '+(e.shortMessage||e.message),'error'); }
  finally { if(btn){btn.disabled=false;} if(label) label.textContent='CONFIRM'; }
}

function loadBeneficiaries(list) {
  const el=document.getElementById('bene-list');
  const countMeta=document.getElementById('bene-count-meta');
  if(countMeta) countMeta.textContent=`${list.length} wallet${list.length===1?'':'s'}`;
  if(!list.length){el.innerHTML='<div class="empty">No beneficiaries yet</div>';return;}
  const used=list.reduce((s,b)=>s+b.basisPoints,0);
  const alloc=document.getElementById('allocation-remaining');
  const remaining=(10000-used)/100;
  if(alloc){
    if(used===10000){
      alloc.textContent='100% allocated ✓';
      alloc.className='badge badge-c';
    } else {
      alloc.textContent=`${remaining}% remaining`;
      alloc.className='badge badge-g';
    }
  }
  const warnEl=document.getElementById('bene-alloc-warn');
  if(warnEl) warnEl.style.display = used===10000 ? 'none' : 'flex';
  const isTriggered = switchData?.status==='TRIGGERED' || switchData?.onChainTriggered;
  el.innerHTML=list.map((b,i)=>{
    const initials=(b.label||'?').slice(0,2).toUpperCase();
    const tokensStr=(b.tokens||[]).join(', ');
    const pct=b.basisPoints/100;
    const avClass='av'+((i%3)+1);
    const mwId='mw-'+b.id;
    const actions = isTriggered
      ? `<div class="trig-bene-badge">✓ Assets Sent</div>`
      : `<div class="bcard-actions">
           <button class="baction baction-edit" onclick="toggleEditBene('${b.id}','${(b.label||'').replace(/'/g,"\\\\'")}',${b.basisPoints},'${tokensStr.replace(/'/g,"\\\\'")}')">Edit</button>
           <button class="baction baction-remove" onclick="removeBeneficiary('${b.id}','${b.walletAddress}')">Remove</button>
         </div>`;
    return `<div class="bcard" id="brow-${b.id}">
      <div class="bcard-top">
        <div class="bcard-who"><div class="av ${avClass}">${initials}</div><div><div class="bn">${b.label}</div><div class="br">Beneficiary</div></div></div>
        <div class="bconn"><div class="bconn-lbl">${isTriggered?'Sent':'Connected'}</div><div class="mwave" id="${mwId}"></div></div>
      </div>
      <div class="baddr">${b.walletAddress} <span class="cp" onclick="navigator.clipboard.writeText('${b.walletAddress}');toast('Address copied','info')">⧉</span></div>
      ${(b.tokens||[]).length?`<div style="font-size:11px;color:var(--tm);margin-top:8px;">Tokens: ${tokensStr}</div>`:''}
      <div class="balloc"><span class="pct">${pct}%</span><span class="of">of portfolio</span></div>
      ${actions}
      <div class="bene-edit-panel" id="bedit-${b.id}" style="display:none;">
        <div class="form-group">
          <label class="form-label">Label</label>
          <input class="form-input" type="text" id="bedit-label-${b.id}" value="${b.label}" />
        </div>
        <div class="form-group">
          <label class="form-label">Allocation %</label>
          <input class="form-input" type="number" id="bedit-pct-${b.id}" value="${pct}" min="1" max="100" />
        </div>
        <div class="form-group">
          <label class="form-label">Tokens</label>
          <input class="form-input" type="text" id="bedit-tokens-${b.id}" value="${tokensStr}" />
        </div>
        <div style="grid-column:1/-1;display:flex;gap:8px;">
          <button class="btn btn-c btn-sm" onclick="saveEditBene('${b.id}','${b.walletAddress}')">Save</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleEditBene('${b.id}')">Cancel</button>
        </div>
      </div>
    </div>`;
  }).join('');
  // populate mini waves
  list.forEach(b=>{ const elw=document.getElementById('mw-'+b.id); if(elw) elw.innerHTML=buildMiniWaveSvg(); });
}

function toggleEditBene(id, label, basisPoints, tokens) {
  const panel=document.getElementById('bedit-'+id);
  if(!panel) return;
  const isOpen=panel.style.display!=='none';
  if(isOpen){ panel.style.display='none'; return; }
  if(label!==undefined) document.getElementById('bedit-label-'+id).value=label;
  if(basisPoints!==undefined) document.getElementById('bedit-pct-'+id).value=basisPoints/100;
  if(tokens!==undefined) document.getElementById('bedit-tokens-'+id).value=tokens;
  panel.style.display='grid';
  document.getElementById('bedit-pct-'+id).focus();
}

async function saveEditBene(id, walletAddr) {
  const newLabel=document.getElementById('bedit-label-'+id).value.trim();
  const newPctRaw=parseFloat(document.getElementById('bedit-pct-'+id).value);
  const newTokensRaw=document.getElementById('bedit-tokens-'+id).value.trim();
  if(!newLabel) return toast('Label cannot be empty','error');
  if(isNaN(newPctRaw)||newPctRaw<=0||newPctRaw>100) return toast('Allocation must be 1–100%','error');
  const newBasisPoints=Math.round(newPctRaw*100);
  const newTokens=newTokensRaw?newTokensRaw.split(',').map(t=>t.trim()).filter(Boolean):[];

  const bene=switchData?.beneficiaries?.find(b=>b.id===id);
  if(!bene) return toast('Beneficiary not found','error');
  const otherTotal=(switchData.beneficiaries||[]).reduce((s,b)=>b.id===id?s:s+b.basisPoints,0);
  if(otherTotal+newBasisPoints>10000) return toast(`Exceeds 100% — others use ${otherTotal/100}%`,'error');

  const sw=new ethers.Contract(switchData.contractAddress,SWITCH_ABI,signer);
  try {
    toast('Waiting for wallet — removing old allocation...','info');
    const tx1=await sw.removeBeneficiary(walletAddr);
    await pollTx(tx1.hash);
    toast('Re-adding with new allocation...','info');
    const tx2=await sw.addBeneficiary(walletAddr,newBasisPoints,newLabel);
    const receipt=await pollTx(tx2.hash);
    await apiFetch(`/beneficiaries/${id}`,'DELETE');
    const res=await apiFetch('/beneficiaries','POST',{walletAddress:walletAddr,label:newLabel,basisPoints:newBasisPoints,tokens:newTokens,txHash:receipt.hash});
    if(res.success){ toast('Beneficiary updated ✓','success'); await loadDashboard(); }
    else throw new Error(res.error);
  } catch(e){ toast('Error: '+(e.shortMessage||e.message),'error'); }
}

function renderDashboardBeneficiaries(list) {
  const el=document.getElementById('dashboard-bene-list');
  const meta=document.getElementById('dash-bene-meta');
  if(!el) return;
  const used=list.reduce((s,b)=>s+b.basisPoints,0);
  if(meta) meta.textContent = list.length ? `${used/100}% allocated` : '0 wallets';
  if(!list.length){el.innerHTML='<div class="empty">No beneficiaries yet — add some in the Beneficiaries tab</div>';return;}
  el.innerHTML=list.map((b,i)=>{
    const initials=(b.label||'?').slice(0,2).toUpperCase();
    const addrShort=b.walletAddress.slice(0,6)+'...'+b.walletAddress.slice(-4);
    const avClass='av'+((i%3)+1);
    return `<div style="display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)">
      <div class="av ${avClass}" style="width:36px;height:36px;font-size:11px">${initials}</div>
      <div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:600">${b.label}</div><div style="font-family:var(--mono);font-size:11px;color:var(--tm)">${addrShort}</div></div>
      <div class="badge badge-c">${b.basisPoints/100}%</div>
    </div>`;
  }).join('');
}

async function addBeneficiary() {
  const walletAddr=document.getElementById('b-wallet').value.trim();
  const label=document.getElementById('b-label').value.trim();
  const pct=parseFloat(document.getElementById('b-pct').value);
  const tokens=document.getElementById('b-tokens').value.split(',').map(t=>t.trim()).filter(Boolean);
  const basisPoints=Math.round(pct*100);
  if(!walletAddr||!label||!pct) return toast('Fill in all fields','error');
  toast('Check your wallet for confirmation...','info');
  try {
    const sw=new ethers.Contract(switchData.contractAddress,SWITCH_ABI,signer);
    const tx=await sw.addBeneficiary(walletAddr,basisPoints,label);
    toast('Transaction sent...','success');
    const receipt=await pollTx(tx.hash);
    const res=await apiFetch('/beneficiaries','POST',{walletAddress:walletAddr,label,basisPoints,tokens,txHash:receipt.hash});
    if(res.success){
      toast('Beneficiary added ✓','success');
      ['b-wallet','b-label','b-pct','b-tokens'].forEach(id=>document.getElementById(id).value='');
      await loadDashboard();
    } else throw new Error(res.error);
  } catch(e) { toast('Error: '+(e.shortMessage||e.message),'error'); }
}

async function forceRemoveBeneficiary() {
  const walletAddr=document.getElementById('force-remove-addr').value.trim();
  if(!walletAddr||!walletAddr.startsWith('0x')) return toast('Enter a valid 0x... address','error');
  if(!switchData) return toast('No switch loaded — go to Dashboard first','error');
  if(!confirm(`Remove ${walletAddr} from the on-chain contract?`)) return;
  toast('Check your wallet for confirmation...','info');
  try {
    const sw=new ethers.Contract(switchData.contractAddress,SWITCH_ABI,signer);
    const tx=await sw.removeBeneficiary(walletAddr);
    toast('Transaction sent, confirming...','info');
    await pollTx(tx.hash);
    const benes=switchData.beneficiaries||[];
    const dbMatch=benes.find(b=>b.walletAddress.toLowerCase()===walletAddr.toLowerCase());
    if(dbMatch) await apiFetch(`/beneficiaries/${dbMatch.id}`,'DELETE');
    document.getElementById('force-remove-addr').value='';
    toast('Removed on-chain ✓','success'); await loadDashboard();
  } catch(e) { toast('Error: '+(e.reason||e.shortMessage||e.message||String(e)).slice(0,120),'error'); }
}

async function removeBeneficiary(id,walletAddr) {
  if(!confirm('Remove this beneficiary?')) return;
  toast('Check your wallet for confirmation...','info');
  try {
    const sw=new ethers.Contract(switchData.contractAddress,SWITCH_ABI,signer);
    const tx=await sw.removeBeneficiary(walletAddr);
    await pollTx(tx.hash);
    await apiFetch(`/beneficiaries/${id}`,'DELETE');
    toast('Removed ✓','success'); await loadDashboard();
  } catch(e) { toast('Error: '+(e.shortMessage||e.message),'error'); }
}

// ══════════════════════════════════════
//  ASSETS / DEPOSIT
// ══════════════════════════════════════
let _depositAssets = [];

async function loadAssets() {
  const res=await apiFetch('/assets','GET');
  const icons={MNT:'MNT',ETH:'ETH',USDC:'USD',USDT:'USD',BTC:'BTC',WBTC:'BTC'};
  if(!res.success){
    document.getElementById('asset-list').innerHTML='<div class="empty">Could not load assets</div>';
    return;
  }
  const{assets,totalUsdValue}=res.data;
  const totalStr='$'+(totalUsdValue||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const totalUsd=document.getElementById('total-usd'); if(totalUsd) totalUsd.innerHTML=`<span class="cur">$</span>${(totalUsdValue||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const totalUsd2=document.getElementById('total-usd-2'); if(totalUsd2) totalUsd2.innerHTML=`<span class="cur">$</span>${(totalUsdValue||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const holdingsCount=document.getElementById('holdings-count'); if(holdingsCount) holdingsCount.textContent=`${(assets||[]).length} asset${(assets||[]).length===1?'':'s'}`;
  const dashAssetCount=document.getElementById('dash-asset-count'); if(dashAssetCount) dashAssetCount.textContent=`${(assets||[]).length} token${(assets||[]).length===1?'':'s'}`;

  const maxVal=Math.max(1,...(assets||[]).map(a=>a.usdValue||0));

  const holdingsHtml=(assets||[]).length
    ? assets.map(a=>`<div class="holding-item">
        <div class="h-ico">${icons[a.symbol]||a.symbol.slice(0,3)}</div>
        <div class="h-info"><div class="h-sym">${a.symbol}</div><div class="h-name">${a.balance}</div></div>
        <div class="h-amt"><div class="h-qty">${a.balance}</div><div class="h-usd">$${(a.usdValue||0).toFixed(2)}</div></div>
      </div><div class="h-bar"><div class="h-fill" style="width:${Math.round(((a.usdValue||0)/maxVal)*100)}%"></div></div>`).join('')
    : '<div class="empty">No assets in switch contract</div>';
  document.getElementById('asset-list').innerHTML=holdingsHtml;

  const dashAssetList=document.getElementById('dash-asset-list');
  if(dashAssetList){
    dashAssetList.innerHTML=(assets||[]).length
      ? assets.map(a=>`<div class="asset-item">
          <div class="a-ico">${icons[a.symbol]||a.symbol.slice(0,3)}</div>
          <div class="a-info"><div class="a-sym">${a.symbol}</div><div class="a-name">${a.contractAddress?'ERC-20':'Native'}</div></div>
          <div class="a-amt"><div class="a-qty">${a.balance}</div><div class="a-usd">$${(a.usdValue||0).toFixed(2)}</div></div>
        </div>`).join('')
      : '<div class="empty">No assets yet</div>';
  }

  // Populate deposit asset select
  if(switchData){
    document.getElementById('deposit-contract-addr-short').textContent =
      switchData.contractAddress.slice(0,6)+'...'+switchData.contractAddress.slice(-4);
  }
  const select=document.getElementById('deposit-asset-select');
  if(select){
    _depositAssets = (assets && assets.length) ? assets.map(a=>({symbol:a.symbol,contractAddress:a.contractAddress||null,decimals:a.decimals})) : [{symbol:'MNT',contractAddress:null,decimals:18}];
    if(!_depositAssets.find(a=>!a.contractAddress)) _depositAssets.unshift({symbol:'MNT',contractAddress:null,decimals:18});
    select.innerHTML=_depositAssets.map((a,i)=>
      `<option value="${i}">${a.symbol}${a.contractAddress?` (${a.contractAddress.slice(0,6)}...${a.contractAddress.slice(-4)})`:' (native)'}</option>`
    ).join('');
    await onDepositAssetChange();
  }
}

function closeDepositModal() {} // legacy no-op (deposit is now inline on Assets page)

async function onDepositAssetChange() {
  const idx=document.getElementById('deposit-asset-select').value;
  const asset=_depositAssets[idx];
  if(!asset||!provider||!userAddr) return;
  const balEl=document.getElementById('deposit-wallet-balance');
  balEl.textContent='Loading...';
  try {
    if(!asset.contractAddress) {
      const bal=await provider.getBalance(userAddr);
      balEl.textContent=parseFloat(ethers.formatEther(bal)).toFixed(5)+' '+asset.symbol;
    } else {
      const token=new ethers.Contract(asset.contractAddress,ERC20_ABI_FE,provider);
      const bal=await token.balanceOf(userAddr);
      const dec=asset.decimals ?? await token.decimals();
      balEl.textContent=parseFloat(ethers.formatUnits(bal,dec)).toFixed(5)+' '+asset.symbol;
    }
  } catch(e) {
    balEl.textContent='—';
  }
}

async function setMaxDeposit() {
  const idx=document.getElementById('deposit-asset-select').value;
  const asset=_depositAssets[idx];
  if(!asset||!provider||!userAddr) return;
  try {
    if(!asset.contractAddress) {
      const bal=await provider.getBalance(userAddr);
      const gasBuffer=ethers.parseEther('0.001');
      const max=bal>gasBuffer?bal-gasBuffer:0n;
      document.getElementById('deposit-amount').value=ethers.formatEther(max);
    } else {
      const token=new ethers.Contract(asset.contractAddress,ERC20_ABI_FE,provider);
      const bal=await token.balanceOf(userAddr);
      const dec=asset.decimals ?? await token.decimals();
      document.getElementById('deposit-amount').value=ethers.formatUnits(bal,dec);
    }
  } catch(e) { toast('Could not fetch balance','error'); }
}

async function submitDeposit() {
  const idx=document.getElementById('deposit-asset-select').value;
  const asset=_depositAssets[idx];
  const amountStr=document.getElementById('deposit-amount').value.trim();
  const status=document.getElementById('deposit-status');
  const btn=document.getElementById('deposit-submit-btn');

  if(!asset) return toast('Select an asset','error');
  const amountNum=parseFloat(amountStr);
  if(!amountStr||isNaN(amountNum)||amountNum<=0) return toast('Enter a valid amount','error');

  status.style.display='block'; status.style.color='var(--tm)';
  btn.disabled=true;

  try {
    const sw=new ethers.Contract(switchData.contractAddress,SWITCH_ABI,signer);

    if(!asset.contractAddress) {
      const value=ethers.parseEther(amountStr);
      status.textContent='Confirm in wallet — sending '+amountStr+' MNT...';
      const tx=await sw.depositNative({value});
      status.textContent='Transaction sent, confirming...';
      await pollTx(tx.hash);
      status.style.color='var(--c)';
      status.textContent='✅ Deposited '+amountStr+' MNT! Tx: '+tx.hash.slice(0,10)+'...';
    } else {
      const dec=asset.decimals ?? 18;
      const amount=ethers.parseUnits(amountStr,dec);
      const token=new ethers.Contract(asset.contractAddress,ERC20_ABI_FE,signer);

      const allowance=await token.allowance(userAddr,switchData.contractAddress);
      if(allowance<amount) {
        status.textContent='Confirm in wallet — approving '+asset.symbol+'...';
        const approveTx=await token.approve(switchData.contractAddress,amount);
        await pollTx(approveTx.hash);
      }

      status.textContent='Confirm in wallet — depositing '+asset.symbol+'...';
      const tx=await sw.depositERC20(asset.contractAddress,amount);
      status.textContent='Transaction sent, confirming...';
      await pollTx(tx.hash);
      status.style.color='var(--c)';
      status.textContent='✅ Deposited '+amountStr+' '+asset.symbol+'! Tx: '+tx.hash.slice(0,10)+'...';
    }

    toast('Deposit successful ✓','success');
    document.getElementById('deposit-amount').value='';
    await loadAssets();
    setTimeout(()=>{ btn.disabled=false; }, 1000);
  } catch(e) {
    status.style.color='#FF6B6B';
    status.textContent='❌ '+(e.shortMessage||e.message||e);
    btn.disabled=false;
  }
}

function secsToLabel(secs) {
  const d=Math.floor(secs/86400);
  const h=Math.floor((secs%86400)/3600);
  const m=Math.floor((secs%3600)/60);
  const parts=[];
  if(d) parts.push(d+'d');
  if(h) parts.push(h+'h');
  if(m) parts.push(m+'m');
  return parts.length ? parts.join(' ') : '0m';
}

function updateDeployPreview() {
  const iSecs = readDHM('deploy-interval-d','deploy-interval-h','deploy-interval-m') || 60;
  const gSecs = readDHM('deploy-grace-d','deploy-grace-h','deploy-grace-m') || 60;
  const totalSecs = iSecs + gSecs;
  const el = document.getElementById('deploy-timing-preview');
  if(!el) return;
  el.innerHTML =
    `Check-in every <strong style="color:var(--c)">${secsToLabel(iSecs)}</strong> · ` +
    `Grace period <strong style="color:var(--g)">${secsToLabel(gSecs)}</strong><br>` +
    `Assets distribute <strong style="color:#FF6B6B">${secsToLabel(totalSecs)}</strong> after your last check-in`;
}

function populateSettingsPage() {
  if(!switchData) return;
  const iSecs=switchData.checkInIntervalSecs;
  const gSecs=switchData.gracePeriodSecs;

  const id=Math.floor(iSecs/86400);
  const ih=Math.floor((iSecs%86400)/3600);
  const im=Math.floor((iSecs%3600)/60);
  document.getElementById('s-interval-d').placeholder=id||'0';
  document.getElementById('s-interval-h').placeholder=ih||'0';
  document.getElementById('s-interval-m').placeholder=im||'0';
  document.getElementById('s-interval-current').textContent=secsToLabel(iSecs);

  const gd=Math.floor(gSecs/86400);
  const gh=Math.floor((gSecs%86400)/3600);
  const gm=Math.floor((gSecs%3600)/60);
  document.getElementById('s-grace-d').placeholder=gd||'0';
  document.getElementById('s-grace-h').placeholder=gh||'0';
  document.getElementById('s-grace-m').placeholder=gm||'0';
  document.getElementById('s-grace-current').textContent=secsToLabel(gSecs);

  if(switchData.notificationEmail) document.getElementById('s-email').value=switchData.notificationEmail;
  if(switchData.notificationPhone) document.getElementById('s-phone').value=switchData.notificationPhone;
}

function readDHM(dId,hId,mId) {
  const d=parseInt(document.getElementById(dId).value)||0;
  const h=parseInt(document.getElementById(hId).value)||0;
  const m=parseInt(document.getElementById(mId).value)||0;
  return d*86400 + h*3600 + m*60;
}
function clearDHM(dId,hId,mId) {
  [dId,hId,mId].forEach(id=>{ document.getElementById(id).value=''; });
}

async function saveScheduleSettings() {
  const iSecs=readDHM('s-interval-d','s-interval-h','s-interval-m');
  const gSecs=readDHM('s-grace-d','s-grace-h','s-grace-m');
  const iChanged = document.getElementById('s-interval-d').value||document.getElementById('s-interval-h').value||document.getElementById('s-interval-m').value;
  const gChanged = document.getElementById('s-grace-d').value||document.getElementById('s-grace-h').value||document.getElementById('s-grace-m').value;
  if(!iChanged&&!gChanged) return toast('Enter at least one value to update','error');
  const body={};
  if(iChanged){
    if(iSecs<60) return toast('Interval must be at least 1 minute','error');
    body.checkInIntervalSecs=iSecs;
  }
  if(gChanged){
    if(gSecs<60) return toast('Grace period must be at least 1 minute','error');
    body.gracePeriodSecs=gSecs;
  }
  const res=await apiFetch('/switch/settings','PATCH',body);
  if(res.success){
    toast('Schedule updated ✓','success');
    clearDHM('s-interval-d','s-interval-h','s-interval-m');
    clearDHM('s-grace-d','s-grace-h','s-grace-m');
    await loadDashboard(); populateSettingsPage();
  } else toast('Error: '+res.error,'error');
}

async function saveNotifSettings() {
  const res=await apiFetch('/switch/settings','PATCH',{
    notificationEmail:document.getElementById('s-email').value.trim(),
    notificationPhone:document.getElementById('s-phone').value.trim(),
  });
  toast(res.success?'Saved ✓':'Error: '+res.error, res.success?'success':'error');
}

async function withdrawAll() {
  if(!confirm('Withdraw ALL assets to your wallet?')) return;
  toast('Check your wallet for confirmation...','info');
  try {
    const sw=new ethers.Contract(switchData.contractAddress,SWITCH_ABI,signer);
    const tx=await sw.withdrawAll(); await pollTx(tx.hash);
    toast('Assets withdrawn ✓','success');
    await loadAssets();
  } catch(e) { toast('Error: '+(e.shortMessage||e.message),'error'); }
}

function showAccountInfo() { toast(`Connected: ${userAddr}`,'info'); }
function showFactoryInfo() {
  if(factoryAddress) toast(`Factory: ${factoryAddress.slice(0,10)}...${factoryAddress.slice(-6)}`,'info');
  else toast('No factory address set','error');
}

async function apiFetch(path,method='GET',body=null) {
  const opts={method,headers:{'Content-Type':'application/json'}};
  if(jwt) opts.headers['Authorization']='Bearer '+jwt;
  if(body) opts.body=JSON.stringify(body);
  try { const r=await fetch(API_BASE+path,opts); return await r.json(); }
  catch(e) { return{success:false,error:e.message}; }
}

const TOAST_ICONS={success:'',error:'⚠',info:'ℹ'};
let _tt;
function toast(msg,type='success') {
  const el=document.getElementById('toast');
  document.getElementById('toast-icon').textContent=TOAST_ICONS[type]||'';
  document.getElementById('toast-msg').innerHTML=msg;
  el.className='show '+type;
  clearTimeout(_tt); _tt=setTimeout(()=>{el.className='';},5000);
}
