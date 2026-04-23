import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { addWatermarkCapped } from '@/lib/watermark';
import { addXlsxWatermark } from '@/lib/watermark-xlsx';
import JSZip from 'jszip';

export const maxDuration = 60;

// Only document types in the ZIP — photos and videos are too large for serverless
const DOCUMENT_EXTS = ['pdf', 'xlsx', 'xls', 'csv', 'doc', 'docx', 'ppt', 'pptx', 'txt'];
const SKIP_EXTS = ['url', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi', 'mp3'];

async function listAllFiles(prefix: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage
    .from('sl-data-room')
    .list(prefix, { limit: 500, sortBy: { column: 'name', order: 'asc' } });

  if (error || !data) return [];

  const paths: string[] = [];
  const folderPromises: Promise<string[]>[] = [];

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      folderPromises.push(listAllFiles(fullPath));
    } else {
      paths.push(fullPath);
    }
  }

  if (folderPromises.length > 0) {
    const nestedResults = await Promise.all(folderPromises);
    for (const nested of nestedResults) paths.push(...nested);
  }

  return paths;
}

async function processFile(
  filePath: string,
  email: string,
  today: string,
  rootPath: string
): Promise<{ zipPath: string; buffer: Buffer } | null> {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  if (SKIP_EXTS.includes(ext)) return null;
  if (!DOCUMENT_EXTS.includes(ext)) return null;

  const { data, error } = await supabaseAdmin.storage
    .from('sl-data-room')
    .download(filePath);

  if (error || !data) return null;

  let fileBuffer = Buffer.from(await data.arrayBuffer());

  if (ext === 'pdf') {
    try {
      // Cap at 10 pages — large govt docs (FEIR etc) would timeout otherwise
      fileBuffer = Buffer.from(await addWatermarkCapped(new Uint8Array(fileBuffer), email, today, 10));
    } catch { /* use original */ }
  } else if (['xlsx', 'xls'].includes(ext)) {
    try {
      fileBuffer = Buffer.from(addXlsxWatermark(fileBuffer, email, today));
    } catch { /* use original */ }
  }

  const zipPath = rootPath ? filePath.slice(rootPath.length + 1) : filePath;
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

  // No Sharp in the ZIP path = safe to run all in parallel
  const results = await Promise.allSettled(
    allFiles.map(filePath => processFile(filePath, session.email, today, rootPath))
  );

  const zip = new JSZip();
  let docCount = 0;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      zip.file(result.value.zipPath, result.value.buffer);
      docCount++;
    }
  }

  zip.file('CONFIDENTIAL_NOTICE.txt',
    `CONFIDENTIAL - DO NOT DISTRIBUTE\n\nDownloaded by: ${session.email}\nDate: ${today}\n\nThis ZIP contains ${docCount} document(s). All PDFs and spreadsheets are watermarked.\nPhotos and videos are excluded from ZIP download due to file size - please download them individually from the data room.\n\nAll downloads are logged and tracked. Unauthorized distribution violates the NDA you signed.\n`
  );

  // Log
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
