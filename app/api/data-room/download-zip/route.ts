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
const SKIP_EXTS = ['url']; // skip .url files (Vimeo links, can't download)

async function listAllFiles(prefix: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage
    .from('sl-data-room')
    .list(prefix, { limit: 500, sortBy: { column: 'name', order: 'asc' } });

  if (error || !data) return [];

  const paths: string[] = [];
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // folder — recurse
      const children = await listAllFiles(fullPath);
      paths.push(...children);
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rootPath = req.nextUrl.searchParams.get('path') || '';
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Collect all file paths recursively
  const allFiles = await listAllFiles(rootPath);

  const zip = new JSZip();

  for (const filePath of allFiles) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';

    // Skip .url files
    if (SKIP_EXTS.includes(ext)) continue;

    // Download from Supabase
    const { data, error } = await supabaseAdmin.storage
      .from('sl-data-room')
      .download(filePath);

    if (error || !data) continue;

    let fileBuffer = Buffer.from(await data.arrayBuffer());

    // Apply watermark by type
    if (ext === 'pdf') {
      try {
        fileBuffer = Buffer.from(await addWatermark(new Uint8Array(fileBuffer), session.email, today));
      } catch {
        // use original if watermark fails
      }
    } else if (IMAGE_EXTS.includes(ext)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fileBuffer = (await addImageWatermark(fileBuffer, session.email, today)) as any;
      } catch {
        // use original if watermark fails
      }
    } else if (EXCEL_EXTS.includes(ext)) {
      try {
        fileBuffer = Buffer.from(addXlsxWatermark(fileBuffer, session.email, today));
      } catch {
        // use original if watermark fails
      }
    }

    // Determine zip path — strip rootPath prefix so zip starts at folder name or root
    const zipPath = rootPath ? filePath.slice(rootPath.length + 1) : filePath;
    zip.file(zipPath, fileBuffer);
  }

  // Log access
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  supabaseAdmin.from('sl_access_log').insert({
    email: session.email,
    file_path: rootPath || '(root)',
    action: 'zip-download',
    ip_address: ip,
  }).then(() => {}, () => {});

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });

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
