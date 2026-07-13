import { config } from 'dotenv'
config({ path: '.env.local' })
import { put } from '@vercel/blob'
import sharp from 'sharp'
const jobs=[
  ['front','C:/Users/Aouub/Pictures/WhatsApp Image 2026-02-24 at 19.52.09.jpeg'],
  ['right','C:/Users/Aouub/Pictures/WhatsApp Image 2026-06-22 at 21.43.38.jpeg'],
]
for (const [name,path] of jobs){
  const buf=await sharp(path).rotate().resize({width:1600,withoutEnlargement:true}).jpeg({quality:85}).toBuffer()
  const blob=await put(`demo-src/${name}.jpg`, buf, { access:'public', addRandomSuffix:true, contentType:'image/jpeg' })
  console.log(name, buf.length, blob.url)
}
