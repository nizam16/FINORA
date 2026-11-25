import {createHmac} from 'node:crypto'
import {HttpError} from './sheets.mjs'
export async function scriptCall(config, action, args={}) {
  const payload=JSON.stringify({action,args,ts:Date.now()})
  const signature=createHmac('sha256',config.secret).update(payload).digest('base64url')
  const body=JSON.stringify({payload,signature})
  if(Buffer.byteLength(body)>4_500_000)throw new HttpError(413,'Data melebihi batas sinkronisasi Apps Script.')
  let data
  try {
    const response=await fetch(config.script,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(25_000)})
    if(!response.ok)throw Error()
    data=await response.json()
  } catch {
    throw new HttpError(502,'Apps Script tidak merespons. Periksa deployment dan izin web app.')
  }
  if(data.ok!==true)throw new HttpError([400,403,409,413,429].includes(data.status)?data.status:502,data.error||'Apps Script gagal.')
  return data.result
}
