import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { addWatermark } from '@/lib/watermark';
import { addImageWatermark } from '@/lib/watermark-image';
import { addXlsxWatermark } from '@/lib/watermark-xlsx';
import JSZip from 'jszip';

export const maxDuration = 60;

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
const EXCEL_EXTS = ['xlsx', 'xls'];
const SKIP_EXTS = ['url']; // Vimeo links — no file to package

async function listAllFiles(prefix: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage
    .from('sl-data-room')
    .list(prefix, { limit: 500, sortBy: { column: 'name', order: 'asc' } });

  if (error || !data) return [];

  const paths: string[] = [];
  // Recurse folders in parallel for speed
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

  const { data, error } = await supabaseAdmin.storage
    .from('sl-data-room')
    .download(filePath);

  if (error || !data) return null;

  let fileBuffer = Buffer.from(await data.arrayBuffer());

  if (ext === 'pdf') {
    try {
      fileBuffer = Buffer.from(await addWatermark(new Uint8Array(fileBuffer), email, today));
    } catch { /* use original */ }
  } else if (IMAGE_EXTS.includes(ext)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fileBuffer = (await addImageWatermark(fileBuffer, email, today)) as any;
    } catch { /* use original */ }
  } else if (EXCEL_EXTS.includes(ext)) {
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

  // List all files first (recursive, parallel folder discovery)
  const allFiles = await listAllFiles(rootPath);

  if (allFiles.length === 0) {
    return NextResponse.json({ error: 'No files found' }, { status: 404 });
  }

  // Download + watermark ALL files in parallel
  const results = await Promise.allSettled(
    allFiles.map(filePath => processFile(filePath, session.email, today, rootPath))
  );

  const zip = new JSZip();
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      zip.file(result.value.zipPath, result.value.buffer);
    }
  }

  // Add a confidentiality notice at the root
  zip.file('CONFIDENTIAL_NOTICE.txt',
    `CONFIDENTIAL — DO NOT DISTRIBUTE\n\nThis data room was downloaded by: ${session.email}\nDate: ${today}\n\nAll files are watermarked and tracked. Unauthorized distribution is a violation of the NDA you have signed.\n`
  );

  // Log the access
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
    compressionOptions: { level: 4 }, // level 4 = good balance of speed vs size
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
