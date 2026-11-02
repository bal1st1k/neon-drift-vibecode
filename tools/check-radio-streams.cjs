'use strict';
// Read public station pages or a bounded prefix of their live streams.
const pages=['https://laut.fm/eurobeat','https://zeno.fm/radio/initial-d/','https://zeno.fm/republic-eurobeat/'];
(async()=>{
 if(process.argv[2]==='discover'){
  for(const url of pages){try{const response=await fetch(url,{signal:AbortSignal.timeout(15000)}),html=(await response.text()).replaceAll('\\/','/');console.log(JSON.stringify({url,status:response.status,matches:[...html.matchAll(/.{0,65}(?:stream\.zeno|mountPoint|mount_point|streaming_url|streamUrl|stream_url|streamURL).{0,145}/gi)].slice(0,10).map(m=>m[0])}));}catch(error){console.log(JSON.stringify({url,error:error.message}));}}
 }else{
  const {stations}=require('../radio.js');
  for(const station of stations){try{const response=await fetch(station.url,{signal:AbortSignal.timeout(15000)}),reader=response.body.getReader(),chunk=await reader.read();await reader.cancel();console.log(JSON.stringify({id:station.id,status:response.status,type:response.headers.get('content-type'),name:response.headers.get('icy-name'),bytes:chunk.value?.length||0,url:new URL(response.url).origin+new URL(response.url).pathname}));}catch(error){console.log(JSON.stringify({id:station.id,error:error.message}));process.exitCode=1;}}
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
