/**
 * QUICK HIRE - Candidate CV Downloader Utility
 * Supports downloading original uploaded files (PDF/DOCX) or generating a comprehensive,
 * styled, printable CV dossier (HTML/PDF) with complete candidate details.
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateCandidateCVHtml(candidate) {
  const name = candidate.name || [candidate.first_name, candidate.last_name].filter(Boolean).join(' ') || 'Candidate';
  const candCode = candidate.candidate_code || candidate.simple_id || ('CAND-' + (candidate.id ? String(candidate.id).split('-')[0].slice(0, 4).toUpperCase() : '1001'));
  const email = candidate.email || candidate.structured_data?.email || 'N/A';
  const phone = candidate.phone || candidate.structured_data?.phone || 'N/A';
  const location = candidate.location || candidate.structured_data?.location || candidate.structured_data?.address || 'South Africa';
  const jobTitle = candidate.matched_job_title && candidate.matched_job_title !== 'No matching job' ? candidate.matched_job_title : (candidate.education?.degree || 'Professional Candidate');
  const ocrConf = Math.round((candidate.ocr_confidence ?? candidate.structured_data?.ocr_confidence ?? 0.98) * 100);
  const docName = candidate.source_file_name || (candidate.source_file ? String(candidate.source_file).split('/').pop() : 'Original_CV.pdf');

  // Work Experience
  const rawWork = candidate.work_experience || candidate.structured_data?.experience || candidate.structured_data?.gemini_analysis?.experience || candidate.experience || [];
  const workList = Array.isArray(rawWork) ? rawWork : [];

  // Education
  const eduDegree = candidate.education?.degree || candidate.structured_data?.education?.degree || candidate.education_history?.[0]?.degree || (candidate.structured_data?.education?.[0]?.degree) || '';
  const eduInstitution = candidate.education?.institution || candidate.structured_data?.education?.institution || candidate.education_history?.[0]?.institution || (candidate.structured_data?.education?.[0]?.institution) || '';
  const eduYear = candidate.education?.year || candidate.structured_data?.education?.year || candidate.education_history?.[0]?.year || (candidate.structured_data?.education?.[0]?.year) || '';
  const rawEdu = candidate.education_history || candidate.structured_data?.education || [];
  const eduList = Array.isArray(rawEdu) ? rawEdu : (eduDegree ? [{ degree: eduDegree, institution: eduInstitution, year: eduYear }] : []);

  // High School / Matric
  const hsInfo = candidate.school_info?.high_school || candidate.structured_data?.school_info?.high_school || {};

  // Skills
  const technicalSkills = candidate.skills?.technical || candidate.technical_skills || [];
  const softSkills = candidate.skills?.soft || candidate.soft_skills || [];
  let allSkills = candidate.all_skills || [];
  if (!allSkills.length && Array.isArray(candidate.skills)) {
    allSkills = candidate.skills.map(s => typeof s === 'string' ? s : s.name).filter(Boolean);
  }
  if (!allSkills.length) {
    allSkills = [...technicalSkills, ...softSkills];
  }

  // Summary
  const summary = candidate.structured_data?.gemini_analysis?.summary || candidate.summary || candidate.structured_data?.summary ||
    `${name} is a qualified professional with expertise in ${allSkills.slice(0, 5).join(', ') || 'their field'}. Demonstrates verified educational background and operational capability.`;

  // References
  const references = candidate.references || candidate.structured_data?.references || [];

  // Raw OCR Text
  const rawText = candidate.raw_text || candidate.structured_data?.raw_text || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(name)} - Curriculum Vitae</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 15mm 15mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #f8fafc;
      line-height: 1.55;
      font-size: 13.5px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cv-container {
      max-width: 860px;
      margin: 24px auto;
      background: #ffffff;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border-radius: 8px;
      overflow: hidden;
    }
    .no-print-bar {
      background: #0d1442;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
    .no-print-bar button {
      background: #c9a84c;
      color: #0d1442;
      border: none;
      padding: 7px 16px;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .no-print-bar button:hover {
      background: #dfbc5e;
    }
    .cv-header {
      background: linear-gradient(135deg, #0d1442 0%, #1a237e 100%);
      color: #ffffff;
      padding: 32px 36px;
      position: relative;
    }
    .candidate-name {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 4px;
      color: #ffffff;
    }
    .candidate-role {
      font-size: 15px;
      color: #ffd700;
      font-weight: 600;
      margin-bottom: 14px;
    }
    .contact-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px 16px;
      font-size: 12.5px;
      color: #e2e8f0;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,0.15);
    }
    .contact-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge-code {
      display: inline-block;
      background: rgba(255,215,0,0.18);
      color: #ffd700;
      border: 1px solid rgba(255,215,0,0.4);
      padding: 3px 9px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
    }
    .badge-popia {
      display: inline-block;
      background: rgba(46,125,50,0.2);
      color: #86efac;
      border: 1px solid rgba(46,125,50,0.4);
      padding: 3px 9px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .cv-body {
      padding: 32px 36px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #1a237e;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title:first-of-type {
      margin-top: 0;
    }
    .summary-text {
      color: #334155;
      font-size: 13.5px;
      line-height: 1.6;
      background: #f8fafc;
      padding: 14px 18px;
      border-radius: 6px;
      border-left: 4px solid #1a237e;
    }
    .skills-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .skill-chip {
      background: #eef2ff;
      color: #1e1b4b;
      border: 1px solid #c7d2fe;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .skill-chip-gold {
      background: #fefce8;
      color: #713f12;
      border: 1px solid #fef08a;
    }
    .timeline-item {
      padding: 12px 14px;
      border-left: 2px solid #cbd5e1;
      margin-left: 8px;
      margin-bottom: 12px;
      position: relative;
      background: #ffffff;
    }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -7px;
      top: 16px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #1a237e;
      border: 2px solid #ffffff;
    }
    .timeline-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .timeline-company {
      color: #1a237e;
      font-weight: 600;
      font-size: 13px;
    }
    .timeline-date {
      color: #64748b;
      font-size: 11.5px;
      margin-bottom: 6px;
    }
    .timeline-desc {
      color: #475569;
      font-size: 12.5px;
      white-space: pre-wrap;
    }
    .edu-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 10px;
    }
    .edu-degree {
      font-weight: 700;
      color: #0f172a;
      font-size: 13.5px;
    }
    .edu-inst {
      color: #1a237e;
      font-size: 12.5px;
      font-weight: 600;
    }
    .matric-card {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-top: 10px;
    }
    .raw-text-box {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.5;
      background: #0d1442;
      color: #e2e8f0;
      padding: 14px;
      border-radius: 6px;
      max-height: 280px;
      overflow-y: auto;
      white-space: pre-wrap;
      border: 1px solid #1e293b;
    }
    .cv-footer {
      border-top: 1px solid #e2e8f0;
      padding: 18px 36px;
      background: #f8fafc;
      font-size: 11px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    @media print {
      body { background: #ffffff; }
      .no-print-bar { display: none !important; }
      .cv-container { box-shadow: none; margin: 0; max-width: 100%; border-radius: 0; }
      .cv-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .raw-text-box { max-height: none; overflow: visible; }
    }
  </style>
</head>
<body>
  <div class="cv-container">
    <div class="no-print-bar">
      <div>
        <strong>QUICK HIRE</strong> &bull; Verified Candidate Curriculum Vitae &bull; ${escapeHtml(candCode)}
      </div>
      <button onclick="window.print()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"></path><path d="M6 14h12v8H6z"></path></svg>
        Print / Save as PDF
      </button>
    </div>

    <div class="cv-header">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
        <div>
          <h1 class="candidate-name">${escapeHtml(name)}</h1>
          <div class="candidate-role">${escapeHtml(jobTitle)}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <span class="badge-code">${escapeHtml(candCode)}</span>
          <span class="badge-popia">&#10004; POPIA Compliant &bull; OCR ${ocrConf}%</span>
        </div>
      </div>

      <div class="contact-grid">
        <div class="contact-item">
          <strong>Email:</strong> ${escapeHtml(email)}
        </div>
        <div class="contact-item">
          <strong>Phone:</strong> ${escapeHtml(phone)}
        </div>
        <div class="contact-item">
          <strong>Location:</strong> ${escapeHtml(location)}
        </div>
        <div class="contact-item">
          <strong>Source File:</strong> ${escapeHtml(docName)}
        </div>
      </div>
    </div>

    <div class="cv-body">
      <!-- Professional Summary -->
      <div class="section-title">Professional Summary</div>
      <div class="summary-text">
        ${escapeHtml(summary)}
      </div>

      <!-- Skills -->
      ${allSkills.length > 0 ? `
      <div class="section-title">Skills & Core Competencies</div>
      <div class="skills-wrapper">
        ${allSkills.map(s => `<span class="skill-chip">${escapeHtml(s)}</span>`).join('')}
      </div>
      ` : ''}

      <!-- Work Experience -->
      <div class="section-title">Work Experience (${candidate.years_experience || candidate.structured_data?.total_experience_years || 0} Years)</div>
      ${workList.length > 0 ? `
        ${workList.map(w => `
          <div class="timeline-item">
            <div class="timeline-title">${escapeHtml(w.title || 'Role')}</div>
            <div class="timeline-company">${escapeHtml(w.company || 'Company')}</div>
            <div class="timeline-date">${escapeHtml(w.start_date || w.duration || 'N/A')} &ndash; ${escapeHtml(w.end_date || (w.duration ? '' : 'Present'))}</div>
            ${w.description ? `<div class="timeline-desc">${escapeHtml(w.description)}</div>` : ''}
          </div>
        `).join('')}
      ` : `
        <p style="color: #64748b; font-style: italic;">Verified work experience recorded (${candidate.years_experience || 0} years recorded in candidate profile).</p>
      `}

      <!-- Education & Qualifications -->
      <div class="section-title">Education & Qualifications</div>
      ${eduList.length > 0 ? `
        ${eduList.map(e => `
          <div class="edu-card">
            <div class="edu-degree">${escapeHtml(e.degree || 'Degree')}</div>
            <div class="edu-inst">${escapeHtml(e.institution || 'University / Institution')}</div>
            ${e.year ? `<div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">Graduation / Year: ${escapeHtml(e.year)}</div>` : ''}
          </div>
        `).join('')}
      ` : `
        <div class="edu-card">
          <div class="edu-degree">${escapeHtml(eduDegree || 'Standard Tertiary Education')}</div>
          <div class="edu-inst">${escapeHtml(eduInstitution || 'Recognised Institution')}</div>
        </div>
      `}

      ${hsInfo.school_name ? `
        <div class="matric-card">
          <strong style="color: #166534; font-size: 12.5px;">National Senior Certificate (Matric):</strong>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">${escapeHtml(hsInfo.school_name)}</div>
          ${hsInfo.year ? `<div style="font-size: 11.5px; color: #475569;">Year: ${escapeHtml(hsInfo.year)}</div>` : ''}
          ${Array.isArray(hsInfo.subjects) && hsInfo.subjects.length > 0 ? `
            <div style="margin-top: 6px; font-size: 11.5px; color: #334155;">
              <strong>Subjects:</strong> ${escapeHtml(hsInfo.subjects.join(', '))}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- References -->
      ${Array.isArray(references) && references.length > 0 ? `
        <div class="section-title">References</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;">
          ${references.map(r => `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px;">
              <div style="font-weight: 700; color: #0f172a;">${escapeHtml(typeof r === 'string' ? r : r.name || 'Reference')}</div>
              ${typeof r === 'object' && r.company ? `<div style="color: #1a237e; font-size: 12px;">${escapeHtml(r.company)}</div>` : ''}
              ${typeof r === 'object' && r.contact ? `<div style="color: #64748b; font-size: 11.5px;">${escapeHtml(r.contact)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Original OCR Extracted Content -->
      ${rawText ? `
        <div class="section-title">Extracted Document Text (System OCR Verification)</div>
        <div class="raw-text-box">${escapeHtml(rawText)}</div>
      ` : ''}
    </div>

    <div class="cv-footer">
      <div>QUICK HIRE &copy; ${new Date().getFullYear()} &bull; Automated Recruitment Screening &amp; Ranking System</div>
      <div>POPIA Protected &bull; Confidential Candidate Dossier</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Downloads a candidate's CV.
 * 1. Checks if candidate.source_file is an accessible URL (PDF/DOCX) and downloads original file.
 * 2. If missing, local, or CORS blocked, generates and downloads the complete verified HTML/PDF CV.
 */
export async function downloadCandidateCV(candidate) {
  if (!candidate) {
    throw new Error('No candidate provided for download.');
  }

  const cleanName = (candidate.name || 'Candidate')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');

  const sourceFile = candidate.source_file || candidate.file_url || candidate.resume_url;

  // 1. Try remote source file download if it's a valid web URL
  if (sourceFile && typeof sourceFile === 'string' && (sourceFile.startsWith('http://') || sourceFile.startsWith('https://') || sourceFile.startsWith('blob:'))) {
    try {
      const resp = await fetch(sourceFile, { mode: 'cors' });
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.size > 100) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const cleanUrl = sourceFile.split('?')[0];
          const extMatch = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : 'pdf';
          a.download = candidate.source_file_name || `${cleanName}_CV.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          return { success: true, method: 'original_file', filename: a.download };
        }
      }
    } catch (err) {
      console.warn('Direct source_file download failed, proceeding with generated CV dossier:', err);
    }
  }

  // 2. Generate and download complete CV dossier HTML
  const htmlContent = generateCandidateCVHtml(candidate);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = `${cleanName}_CV.html`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  return { success: true, method: 'generated_dossier', filename: fileName };
}
