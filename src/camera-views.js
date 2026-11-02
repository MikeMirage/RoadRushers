export const CAMERA_VIEWS=[
  {id:'topdown',label:'Cenital 1×',shortLabel:'1×',zoom:1},
  {id:'topdown-1.2',label:'Cenital 1,2×',shortLabel:'1,2×',zoom:1.2},
  {id:'topdown-1.4',label:'Cenital 1,4×',shortLabel:'1,4×',zoom:1.4},
  {id:'chase',label:'3ª persona',shortLabel:'3ª',zoom:1},
  {id:'chase-high',label:'3ª persona cenital',shortLabel:'3ª ↑',zoom:1},
];

export function cameraView(id){return CAMERA_VIEWS.find(view=>view.id===id)||CAMERA_VIEWS[0];}
export function nextCameraMode(id){return CAMERA_VIEWS[(CAMERA_VIEWS.indexOf(cameraView(id))+1)%CAMERA_VIEWS.length].id;}
