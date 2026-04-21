import * as XLSX from 'xlsx';

export function addXlsxWatermark(buffer: Buffer, email: string, date: string): Buffer {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  // Add a CONFIDENTIAL NOTICE sheet as the first sheet
  const noticeSheet = XLSX.utils.aoa_to_sheet([
    ['⚠ CONFIDENTIAL'],
    [''],
    ['This document is confidential and intended solely for the recipient named below.'],
    ['Unauthorized distribution, copying, or disclosure is strictly prohibited.'],
    [''],
    ['Recipient', email],
    ['Date Accessed', date],
    [''],
    ['Three Lions Capital Management, LLC'],
  ]);

  // Style the header cell
  noticeSheet['A1'] = { v: '⚠ CONFIDENTIAL', t: 's', s: { font: { bold: true, sz: 16 } } };
  noticeSheet['!cols'] = [{ wch: 20 }, { wch: 50 }];

  // Insert as first sheet
  wb.SheetNames.unshift('CONFIDENTIAL NOTICE');
  wb.Sheets['CONFIDENTIAL NOTICE'] = noticeSheet;

  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(out);
}
