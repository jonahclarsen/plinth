import sharp from 'sharp'
import {mkdirSync} from 'node:fs'
mkdirSync('public/__preview-fixtures__',{recursive:true})
for(let i=0;i<150;i++){
 const width=1200,data=Buffer.allocUnsafe(width*width*3);let seed=i+1
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=(seed>>>27)-16;const p=(y*width+x)*3
  data[p]=(x/6+i*23+noise)&255;data[p+1]=(y/6+i*47+noise)&255;data[p+2]=((x+y)/12+i*61+noise)&255
 }
 await sharp(data,{raw:{width,height:width,channels:3}}).jpeg({quality:82}).toFile(`public/__preview-fixtures__/cover-${i}.jpg`)
}
