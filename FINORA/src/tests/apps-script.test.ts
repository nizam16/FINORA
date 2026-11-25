import {createHmac,randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {expect,it,vi} from 'vitest'
import {scriptCall} from '../../backend/apps-script.mjs'
import {tables} from '../../backend/sheets.mjs'
import {initial} from '../database'

it('authenticates Apps Script and preserves data and revision under competing writes',async()=>{
 const secret='a'.repeat(43), id='a'.repeat(24)
 const props=new Map([['FINORA_SCRIPT_SECRET',secret]])
 const tabs=new Map<string,unknown[][]>()
 let shared=false
 const sheet=(name:string)=>({
  getMaxRows:()=>1000,getMaxColumns:()=>30,hideSheet:()=>{},
  clearContents:()=>tabs.set(name,[]),
  getRange:(_r:number,_c:number,count:number)=>({getValues:()=>tabs.get(name)!.slice(0,count),setValues:(rows:unknown[][])=>tabs.set(name,rows)})
 })
 const book={getId:()=>id,getName:()=> 'FINORA',getSheetByName:(name:string)=>tabs.has(name)?sheet(name):null,insertSheet:sheet}
 const ctx={
  SpreadsheetApp:{getActiveSpreadsheet:()=>book,openById:()=>book,flush:()=>{}},
  DriveApp:{Access:{PRIVATE:'private'},getFileById:()=>({getSharingAccess:()=>shared?'public':'private',getEditors:()=>[],getViewers:()=>[]})},
  PropertiesService:{getScriptProperties:()=>({getProperty:(k:string)=>props.get(k),setProperty:(k:string,v:string)=>props.set(k,v)})},
  Utilities:{computeHmacSha256Signature:(s:string,k:string)=>createHmac('sha256',k).update(s).digest(),base64EncodeWebSafe:(bytes:Buffer)=>bytes.toString('base64url'),getUuid:randomUUID},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:(s:string)=>({setMimeType:()=>s})}
 }
 const code=readFileSync(new URL('../../apps-script/Code.gs',import.meta.url),'utf8')
 const bridge=runInNewContext(code+'\nsetupFinora();doPost',ctx)
 const cfg={secret,script:'https://script.google.com/macros/s/example/exec'}
 vi.stubGlobal('fetch',vi.fn(async (_url:string,init:RequestInit)=>new Response(bridge({postData:{contents:init.body}}))))
 try{
  expect(await scriptCall(cfg,'info')).toEqual({sheet:id,name:'FINORA'})
  await expect(scriptCall({...cfg,secret:'b'.repeat(43)},'read',{sheet:id})).rejects.toThrow('Tanda tangan')
  expect((await scriptCall(cfg,'read',{sheet:id})).revision).toBe('0')
  const data=initial(true)
  data.entries[0].merchant='=1+1'
  const write={sheet:id,revision:'0',data,tables:tables(data,'apps-owner','0')}
  await scriptCall(cfg,'write',write)
  await expect(scriptCall(cfg,'write',write)).rejects.toMatchObject({status:409})
  expect((await scriptCall(cfg,'read',{sheet:id})).data).toEqual(data)
  expect(tabs.get('FINORA - Transactions')?.[1]).toContain("'=1+1")
  shared=true
  await expect(scriptCall(cfg,'read',{sheet:id})).rejects.toMatchObject({status:403})
 }finally{vi.unstubAllGlobals()}
})
