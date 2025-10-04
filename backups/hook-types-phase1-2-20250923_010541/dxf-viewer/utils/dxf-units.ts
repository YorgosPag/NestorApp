export function insunitsToMeters(code:number|undefined|null): number {
  switch(code){
    case 0:  return 1;
    case 1:  return 0.0254;
    case 2:  return 0.3048;
    case 3:  return 1609.344;
    case 4:  return 0.001;
    case 5:  return 0.01;
    case 6:  return 1;
    default: return 1;
  }
}
