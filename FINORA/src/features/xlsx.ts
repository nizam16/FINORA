import { strToU8, zipSync } from 'fflate'
const sheetNS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const relationNS =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const document = (body: string) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + body
const xml = (text: string) =>
  Array.from(text)
    .filter((c) => {
      const n = c.codePointAt(0)!
      return (
        n === 9 ||
        n === 10 ||
        n === 13 ||
        (n >= 32 && n <= 0xd7ff) ||
        (n >= 0xe000 && n <= 0xfffd) ||
        n >= 0x10000
      )
    })
    .join('')
    .replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&apos;',
        })[c]!,
    )
function column(index: number) {
  let n = index + 1,
    label = ''
  while (n) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}
export function workbook(
  sheets: [string, (string | number)[][]][],
): ArrayBuffer {
  const file: Record<string, Uint8Array> = {}
  const save = (path: string, text: string) => {
    file[path] = strToU8(document(text))
  }
  const contentType =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.'
  save(
    '[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${contentType}sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${contentType}worksheet+xml"/>`).join('')}</Types>`,
  )
  const rel = (links: string) =>
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links}</Relationships>`
  save(
    '_rels/.rels',
    rel(
      `<Relationship Id="rId1" Type="${relationNS}/officeDocument" Target="xl/workbook.xml"/>`,
    ),
  )
  save(
    'xl/workbook.xml',
    `<workbook xmlns="${sheetNS}" xmlns:r="${relationNS}"><sheets>${sheets.map(([name], i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  )
  save(
    'xl/_rels/workbook.xml.rels',
    rel(
      sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="${relationNS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join(''),
    ),
  )
  sheets.forEach(([, rows], i) => {
    const cells = rows
      .map(
        (row, y) =>
          `<row r="${y + 1}">${row
            .map((value, x) => {
              const ref = column(x) + (y + 1)
              return typeof value === 'number'
                ? `<c r="${ref}" t="n"><v>${value}</v></c>`
                : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
            })
            .join('')}</row>`,
      )
      .join('')
    save(
      `xl/worksheets/sheet${i + 1}.xml`,
      `<worksheet xmlns="${sheetNS}"><sheetData>${cells}</sheetData></worksheet>`,
    )
  })
  const result = zipSync(file)
  return new Uint8Array(result).buffer
}
