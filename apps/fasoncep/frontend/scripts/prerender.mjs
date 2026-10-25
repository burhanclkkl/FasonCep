import { build } from 'esbuild'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const bundle = new URL('../.prerender.mjs', import.meta.url)
try {
  await build({stdin: {contents: `import React from 'react'; import {renderToString} from 'react-dom/server'; import Landing from './src/Landing'; export default renderToString(React.createElement(Landing,{navigate:()=>{},signedIn:false}));`, resolveDir: fileURLToPath(new URL('..',import.meta.url)), loader:'tsx'}, bundle:true, platform:'node', format:'esm', packages:'external', jsx:'automatic', outfile:fileURLToPath(bundle)})
  const {default: html} = await import(bundle.href)
  const index = new URL('../dist/index.html', import.meta.url)
  const template = await readFile(index,'utf8')
  if (!template.includes('<!-- LANDING_START -->')) throw new Error('Landing marker missing')
  await writeFile(index,template.replace(/<!-- LANDING_START -->[\s\S]*?<!-- LANDING_END -->/,`<!-- LANDING_START -->${html}<!-- LANDING_END -->`))
  console.log('Landing HTML pre-rendered for users and crawlers.')
} finally { await rm(bundle,{force:true}) }
