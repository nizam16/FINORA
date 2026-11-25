const FINORA_EMPTY = {wallets:[],categories:[],entries:[],plans:[],receipts:[]};
const FINORA_PREFIX = '_FINORA_';

// Run once from the editor on the private spreadsheet that owns this script.
function setupFinora() {
  const sheet=SpreadsheetApp.getActiveSpreadsheet();
  if (!sheet) throw new Error('Buka Apps Script lewat spreadsheet FINORA.');
  PropertiesService.getScriptProperties().setProperty('FINORA_SHEET_ID',sheet.getId());
}

function doPost(event) {
  try {
    const text=event && event.postData && event.postData.contents;
    if(!text || text.length>4500000) return finoraResponse_(false,413,'Permintaan terlalu besar.');
    const request=JSON.parse(text);
    const props=PropertiesService.getScriptProperties();
    const secret=props.getProperty('FINORA_SCRIPT_SECRET');
    if(!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret) ||
       typeof request.payload!=='string'||typeof request.signature!=='string')
      return finoraResponse_(false,403,'Tanda tangan tidak valid.');
    const expected=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(request.payload,secret)).replace(/=+$/,'');
    let diff=expected.length^request.signature.length;
    for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^(request.signature.charCodeAt(i)||0);
    if(diff) return finoraResponse_(false,403,'Tanda tangan tidak valid.');
    const {action,args,ts}=JSON.parse(request.payload);
    if(!Number.isSafeInteger(ts)||Math.abs(Date.now()-ts)>120000)
      return finoraResponse_(false,403,'Permintaan kedaluwarsa.');
    const lock=LockService.getScriptLock();
    if(!lock.tryLock(5000)) return finoraResponse_(false,429,'Sinkronisasi lain sedang berjalan.');
    try {
      const id=props.getProperty('FINORA_SHEET_ID');
      if(!id) return finoraResponse_(false,400,'Jalankan setupFinora terlebih dahulu.');
      const file=DriveApp.getFileById(id);
      if(file.getSharingAccess()!==DriveApp.Access.PRIVATE || file.getEditors().length || file.getViewers().length)
        return finoraResponse_(false,403,'Spreadsheet FINORA harus privat tanpa kolaborator.');
      const book=SpreadsheetApp.openById(id);
      if(action==='info') return finoraResponse_(true,{sheet:id,name:book.getName()});
      if(action==='export') {
        const report=SpreadsheetApp.create('FINORA - Laporan Transaksi');
        finoraRows_(report.getSheets()[0],args.rows);
        return finoraResponse_(true,{sheet:report.getId()});
      }
      if(action==='receipt'){
        const match=typeof args.image==='string' && args.image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
        if(!match || args.image.length>4000000 || !/^[\w-]{1,80}$/.test(args.id))
          return finoraResponse_(false,400,'Foto JPEG tidak valid.');
        const bytes=Utilities.base64Decode(match[1]);
        if ((bytes[0]&255)!==255 || (bytes[1]&255)!==216 || (bytes[2]&255)!==255)
          return finoraResponse_(false,400,'Foto JPEG tidak valid.');
        const key='FINORA_RECEIPT_FOLDER';
        const folderId=props.getProperty(key);
        const folder=folderId?DriveApp.getFolderById(folderId):DriveApp.createFolder('FINORA - Arsip Struk Privat');
        if(!folderId) props.setProperty(key,folder.getId());
        if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE || folder.getEditors().length || folder.getViewers().length)
          return finoraResponse_(false,403,'Folder struk FINORA harus privat.');
        const name='FINORA-'+args.id+'.jpg';
        const matches=folder.getFilesByName(name);
        const receipt=matches.hasNext()?matches.next():folder.createFile(Utilities.newBlob(bytes,'image/jpeg',name));
        if(receipt.getSharingAccess()!==DriveApp.Access.PRIVATE || receipt.getEditors().length || receipt.getViewers().length)
          return finoraResponse_(false,403,'Foto struk FINORA harus privat.');
        return finoraResponse_(true,{id:receipt.getId()});
      }
      if(args.sheet!==id) return finoraResponse_(false,403,'Spreadsheet tidak sesuai.');
      const current=props.getProperty('FINORA_ACTIVE_SNAPSHOT');
      if(action==='read') {
        if(!current) return finoraResponse_(true,{revision:'0',data:FINORA_EMPTY});
        const snap=JSON.parse(current);
        const tab=book.getSheetByName(FINORA_PREFIX+snap.slot);
        const raw=tab.getRange(1,1,snap.count,1).getValues().flat().map(s=>String(s).slice(1)).join('');
        return finoraResponse_(true,{revision:snap.revision,data:JSON.parse(raw)});
      }
      if(action==='write'){
        const prior=current?JSON.parse(current):{revision:'0',slot:'B'};
        if(args.revision!==prior.revision) return finoraResponse_(false,409,'Spreadsheet berubah. Sinkronkan kembali.');
        const slot=prior.slot==='A'?'B':'A';
        const tab=book.getSheetByName(FINORA_PREFIX+slot)||book.insertSheet(FINORA_PREFIX+slot);
        const raw=JSON.stringify(args.data);
        const chunks=[];
        for(let i=0;i<raw.length;){
          let end=Math.min(raw.length,i+20000);
          if(end<raw.length && /[\uD800-\uDBFF]/.test(raw[end-1]))end--;
          chunks.push(['#'+raw.slice(i,end)]);
          i=end;
        }
        finoraRows_(tab,chunks);
        Object.keys(args.tables).forEach(name=>{
          const report=book.getSheetByName('FINORA - '+name)||book.insertSheet('FINORA - '+name);
          finoraRows_(report,args.tables[name]);
        });
        tab.hideSheet();
        SpreadsheetApp.flush();
        props.setProperty('FINORA_ACTIVE_SNAPSHOT',JSON.stringify({slot,count:chunks.length,revision:Utilities.getUuid()}));
        return finoraResponse_(true,{ok:true});
      }
      return finoraResponse_(false,400,'Aksi tidak valid.');
    } finally { lock.releaseLock(); }
  } catch (_) {
    return finoraResponse_(false,502,'Apps Script gagal memproses data. Periksa izin, kuota dan konfigurasi.');
  }
}
function finoraRows_(sheet,rows){
  const cols=rows[0].length;
  if(sheet.getMaxRows()<rows.length)sheet.insertRowsAfter(sheet.getMaxRows(),rows.length-sheet.getMaxRows());
  if(sheet.getMaxColumns()<cols)sheet.insertColumnsAfter(sheet.getMaxColumns(),cols-sheet.getMaxColumns());
  sheet.clearContents();
  sheet.getRange(1,1,rows.length,cols).setValues(rows.map(row=>row.map(value=>
    typeof value==='string'&&/^\s*[=+\-@]/.test(value)?"'"+value:value)));
}
function finoraResponse_(ok,value,error){
  return ContentService.createTextOutput(JSON.stringify(ok?{ok:true,result:value}:{ok:false,status:value,error})).setMimeType(ContentService.MimeType.JSON);
}
