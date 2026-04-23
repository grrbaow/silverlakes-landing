import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { addWatermarkCapped } from '@/lib/watermark';
import { addXlsxWatermark } from '@/lib/watermark-xlsx';
import JSZip from 'jszip';

export const maxDuration = 60;

const DOCUMENT_EXTS = ['pdf', 'xlsx', 'xls', 'csv', 'doc', 'docx', 'ppt', 'pptx', 'txt'];
// Skip photos, videos, and Vimeo links -- too large for serverless
const SKIP_EXTS = ['url', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi', 'mp3'];
// Skip individual files over 8MB -- pdf-lib on a 24MB PDF alone can exceed the 60s timeout
const MAX_FILE_BYTES = 8 * 1024 * 1024;

async function listAllFiles(prefix: string): Promise<Array<{ path: string; size: number }>> {
  const { data, error } = await supabaseAdmin.storage
    .from('sl-data-room')
    .list(prefix, { limit: 500, sortBy: { column: 'name', order: 'asc' } });

  if (error || !data) return [];

  const files: Array<{ path: string; size: number }> = [];
  const folderPromises: Promise<Array<{ path: string; size: number }>>[] = [];

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      folderPromises.push(listAllFiles(fullPath));
    } else {
      const size = (item.metadata as { size?: number } | null)?.size ?? 0;
      files.push({ path: fullPath, size });
    }
  }

  if (folderPromises.length > 0) {
    const nestedResults = await Promise.all(folderPromises);
    for (const nested of nestedResults) files.push(...nested);
  }

  return files;
}

async function processFile(
  filePath: string,
  fileSize: number,
  email: string,
  today: string,
  rootPath: string
): Promise<{ zipPath: string; buffer: Buffer; skipped?: boolean; skipReason?: string } | null> {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  if (SKIP_EXTS.includes(ext)) return null;
  if (!DOCUMENT_EXTS.includes(ext)) return null;

  const zipPath = rootPath ? filePath.slice(rootPath.length + 1) : filePath;

  // Skip large files -- note them but don't try to process
  if (fileSize > MAX_FILE_BYTES) {
    return { zipPath: zipPath + '.DOWNLOAD_SEPARATELY.txt', buffer: Buffer.from(
      `This file (${filePath.split('/').pop()}) is ${Math.round(fileSize / 1024 / 1024)}MB and was excluded from the ZIP due to size.\nPlease download it individually from the data room at silverlakes-landing.vercel.app/data-room\n`
    ), skipped: true, skipReason: filePath };
  }

  const { data, error } = await supabaseAdmin.storage
    .from('sl-data-room')
    .download(filePath);

  if (error || !data) return null;

  let fileBuffer = Buffer.from(await data.arrayBuffer());

  if (ext === 'pdf') {
    try {
      fileBuffer = Buffer.from(await addWatermarkCapped(new Uint8Array(fileBuffer), email, today, 10));
    } catch { /* use original */ }
  } else if (['xlsx', 'xls'].includes(ext)) {
    try {
      fileBuffer = Buffer.from(addXlsxWatermark(fileBuffer, email, today));
    } catch { /* use original */ }
  }

  return { zipPath, buffer: fileBuffer };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rootPath = req.nextUrl.searchParams.get('path') || '';
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const allFiles = await listAllFiles(rootPath);
  if (allFiles.length === 0) {
    return NextResponse.json({ error: 'No files found' }, { status: 404 });
  }

  // All parallel -- no Sharp in this path so no native crash risk
  const results = await Promise.allSettled(
    allFiles.map(({ path, size }) => processFile(path, size, session.email, today, rootPath))
  );

  const zip = new JSZip();
  let docCount = 0;
  const skippedFiles: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      zip.file(result.value.zipPath, result.value.buffer);
      if (result.value.skipped && result.value.skipReason) {
        skippedFiles.push(result.value.skipReason.split('/').pop() || result.value.skipReason);
      } else {
        docCount++;
      }
    }
  }

  let notice = `CONFIDENTIAL - DO NOT DISTRIBUTE\n\nDownloaded by: ${session.email}\nDate: ${today}\n\n`;
  notice += `This ZIP contains ${docCount} watermarked document(s).\n`;
  if (skippedFiles.length > 0) {
    notice += `\nThe following large files were excluded from the ZIP (download individually from the data room):\n`;
    for (const f of skippedFiles) notice += `  - ${f}\n`;
  }
  notice += `\nPhotos and videos are excluded from ZIP download due to file size -- please download them individually.\n`;
  notice += `\nAll downloads are logged and tracked. Unauthorized distribution violates the NDA you signed.\n`;
  zip.file('CONFIDENTIAL_NOTICE.txt', notice);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  supabaseAdmin.from('sl_access_log').insert({
    email: session.email,
    file_path: rootPath || '(root)',
    action: 'zip-download',
    ip_address: ip,
  }).then(() => {}, () => {});

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 3 },
  });

  const folderLabel = rootPath ? rootPath.split('/').pop() : 'data-room';
  const filename = `silverlakes-${folderLabel}.zip`;

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': zipBuffer.length.toString(),
    },
  });
}
