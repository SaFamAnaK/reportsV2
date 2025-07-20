// Cloudflare Worker to replace Express server.js for DOCX + PDF + ZIP generation
import { Router } from 'itty-router';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { zipSync } from 'fflate';
import { serveStatic } from "worktop/middleware-static";

export default {
  fetch: async (req, env, ctx) => {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      return handleAPI(req, env);
    }
    return serveStatic(req, env, ctx); // fallback to static files
  },
};

const router = Router();

// Helpers
function formatDateToDDMMYYYY(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateHebrew(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

// POST handler to replace /api/generate
router.post('/api/generate', async (request) => {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      return new Response('Unsupported Content-Type', { status: 400 });
    }

    const data = await request.json();
    const formattedDate = formatDateToDDMMYYYY(data.date);
    const formattedHeb = formatDateHebrew(data.date);

    // Fetch template.docx from external URL or R2
    const templateRes = await fetch('https://media.schmals.com/template.docx');
    const templateBuf = await templateRes.arrayBuffer();
    const zip = new PizZip(templateBuf);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const renderData = {
      date: formattedDate || "",
      dateHeb: formattedHeb || "",
      company: data.company || "",
      job_number: data.job_number || "",
      report_number: data.report_number || "",
      address: data.address || "",
      house_type: data.house_type || "",
      findings: (data.findings || '').split('\n').map(line => `\u2022 ${line}`).join('\n'),
      pageBreak: '',
    };

    // You may implement photo handling using base64 data or public URLs
    renderData.photos1 = data.photos1 || [];
    renderData.photos2 = data.photos2 || [];
    renderData.photos3 = data.photos3 || [];

    doc.render(renderData);
    const docxBuffer = doc.getZip().generate({ type: 'uint8array' });

    // Call external API to convert DOCX -> PDF
    const pdfRes = await fetch('https://v2.convertapi.com/convert/docx/to/pdf?Secret=YOUR_SECRET_KEY', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: docxBuffer
    });
    const pdfBuffer = pdfRes.ok ? new Uint8Array(await pdfRes.arrayBuffer()) : null;

    // Create ZIP file
    const files = {
      'report.docx': docxBuffer,
    };
    if (pdfBuffer) {
      files['report.pdf'] = pdfBuffer;
    }

    const zipped = zipSync(files);
    return new Response(zipped, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename=report.zip`
      }
    });
  } catch (err) {
    return new Response('Error generating document', { status: 500 });
  }
});
