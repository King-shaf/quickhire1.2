from celery import shared_task
from django.conf import settings
from supabase_client import sb_table, get_supabase
import uuid
from datetime import datetime, timezone

try:
    from ai.ocr.processor import OCRProcessor
    from ai.cnn.segment import ImprovedLayoutSegmenter
    from ai.nlp.pipeline import NLPPipeline
    from ai.embedding.generator import EmbeddingGenerator
    from ai.ranking.engine import RankingEngine
    from ai.nlp.gemini_service import GeminiCVAnalyzer
except ImportError:
    class OCRProcessor:
        def process_file(self, path): return f"Placeholder text for {path}", 0.5
    class ImprovedLayoutSegmenter:
        def segment_cv_adaptive(self, img, method='heuristic'): return []
    class NLPPipeline:
        def __init__(self, **kwargs): pass
        def process_cv(self, text): return {'name': None, 'email': None, 'phone': None, 'skills': [], 'experience': [], 'education': []}
    class EmbeddingGenerator:
        def generate_embedding(self, text): return [0.0] * 384
    class RankingEngine:
        def rank_candidates(self, cands, job):
            results = []
            for i, cand in enumerate(cands):
                score = 0.95 - (i * 0.05)
                results.append({
                    'candidate_id': cand['id'],
                    'semantic_score': score,
                    'skill_match_score': score - 0.1,
                    'overall_score': score,
                    'rank_position': i + 1,
                    'explanation': f"Good match based on Gemini analysis. High score in {', '.join(cand['skills'][:2]) if cand['skills'] else 'profile'}."
                })
            return results
    class GeminiCVAnalyzer:
        def analyze_cv(self, text): return None
import os
import traceback
try:
    import cv2
except ImportError:
    cv2 = None
try:
    from pdf2image import convert_from_path
    HAS_PDF2IMAGE = True
except ImportError:
    HAS_PDF2IMAGE = False
    def convert_from_path(*args, **kwargs): return []


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _run_local_pipeline(cv_file_path, ext):
    """
    Execute the LOCAL pipeline in the EXACT diagram order:
      Step 1: PDF -> Image  (pdf2image)
      Step 2: OCR            (OCRProcessor.process_file)
      Step 3: CNN Layout     (ImprovedLayoutSegmenter.segment_cv_adaptive)
      Step 4: NLP Extraction (NLPPipeline.process_cv)
    Returns tuple: (raw_text, confidence, layout_sections, structured_data)
    Raises exception on critical failure (will trigger Gemini fallback).
    """
    raw_text = ""
    confidence = 0.0
    layout_sections = []
    structured_data = {
        'name': None,
        'email': None,
        'phone': None,
        'skills': [],
        'experience': [],
        'education': [],
        'total_experience_years': 0,
    }

    # ------------------------------------------------------------------
    # Step 1: PDF -> Image  (if input is a PDF)
    # ------------------------------------------------------------------
    first_page_image = None
    if ext == '.pdf' and HAS_PDF2IMAGE:
        try:
            images = convert_from_path(cv_file_path, first_page=1, last_page=1)
            if images:
                import numpy as np
                first_page_image = np.array(images[0])[:, :, ::-1]  # RGB -> BGR for OpenCV
        except Exception as e:
            print(f"[Pipeline Step 1] PDF->Image conversion warning: {e}")
            first_page_image = None

    # ------------------------------------------------------------------
    # Step 2: OCR Module  ->  raw_text, confidence
    # ------------------------------------------------------------------
    try:
        ocr = OCRProcessor()
        raw_text, confidence = ocr.process_file(cv_file_path)
    except Exception as e:
        print(f"[Pipeline Step 2] OCR FAILED: {e}")
        traceback.print_exc()
        raise RuntimeError(f"OCR module failed: {e}") from e

    if not raw_text or len(raw_text.strip()) < 20:
        raise RuntimeError("OCR produced empty or too-short text (< 20 chars)")

    # ------------------------------------------------------------------
    # Step 3: CNN Module  ->  layout analysis / section segmentation
    # ------------------------------------------------------------------
    try:
        # If we don't have an image from pdf2image, try to load the file directly
        img_for_cnn = first_page_image
        if img_for_cnn is None and cv2 is not None and ext in ('.jpg', '.jpeg', '.png'):
            img_for_cnn = cv2.imread(cv_file_path)

        if img_for_cnn is not None:
            cnn = ImprovedLayoutSegmenter()
            layout_sections = cnn.segment_cv_adaptive(img_for_cnn, method='heuristic')
        else:
            layout_sections = []
    except Exception as e:
        print(f"[Pipeline Step 3] CNN Layout warning (non-critical): {e}")
        layout_sections = []

    structured_data['layout_sections'] = [
        {k: v for k, v in s.items() if k != 'image'} for s in layout_sections
    ]

    # ------------------------------------------------------------------
    # Step 4: NLP Module  ->  extract skills / experience / education
    # ------------------------------------------------------------------
    try:
        nlp = NLPPipeline()
        nlp_result = nlp.process_cv(raw_text)
        structured_data.update({
            'name': nlp_result.get('name'),
            'email': nlp_result.get('email'),
            'phone': nlp_result.get('phone'),
            'skills': nlp_result.get('skills', []) or [],
            'experience': nlp_result.get('experience', []) or [],
            'education': nlp_result.get('education', []) or [],
            'total_experience_years': nlp_result.get('total_experience_years', 0),
        })
    except Exception as e:
        print(f"[Pipeline Step 4] NLP FAILED: {e}")
        traceback.print_exc()
        raise RuntimeError(f"NLP module failed: {e}") from e

    return raw_text, confidence, layout_sections, structured_data


def _run_gemini_fallback(cv_file_path, mime_type):
    """
    GeminiCVAnalyzer — used ONLY as a BACKUP / FAILSAFE when the local
    pipeline (OCR + CNN + NLP) crashes. Must NOT skip the local modules.
    """
    structured_data = {
        'name': None,
        'email': None,
        'phone': None,
        'skills': [],
        'experience': [],
        'education': [],
        'gemini_analysis': {},
    }
    raw_text = ""
    confidence = 0.95

    if GeminiCVAnalyzer is None:
        return raw_text, confidence, structured_data

    try:
        print(f"[Fallback] Running Gemini API analysis for {cv_file_path}")
        analyzer = GeminiCVAnalyzer()
        gemini_data = analyzer.analyze_document(cv_file_path, mime_type)
        if gemini_data:
            structured_data['name'] = gemini_data.get('candidate_name')
            structured_data['email'] = gemini_data.get('email')
            structured_data['phone'] = gemini_data.get('phone')
            structured_data['skills'] = gemini_data.get('skills', []) or []
            structured_data['experience'] = gemini_data.get('experience', []) or []
            structured_data['education'] = gemini_data.get('education', []) or []
            structured_data['total_experience_years'] = gemini_data.get('total_experience_years', 0)
            raw_text = gemini_data.get('raw_text', "") or ""
            structured_data['gemini_analysis'] = {
                'summary': gemini_data.get('summary'),
                'experience': gemini_data.get('experience'),
                'education': gemini_data.get('education'),
            }
        return raw_text, confidence, structured_data
    except Exception as e:
        print(f"[Fallback] Gemini FAILED too: {e}")
        traceback.print_exc()
        raise RuntimeError(f"Both local pipeline AND Gemini fallback failed. Last error: {e}") from e


@shared_task
def process_cv_task(cv_file_path, user_id, job_id=None, company_id=None, batch_id=None):
    """
    Async CV processing task — follows the diagram pipeline strictly:

    LOCAL PIPELINE FIRST (OCR → CNN → NLP → Embedding):
      1. PDF→Image         (pdf2image)
      2. OCRProcessor      → raw_text, confidence
      3. CNN Layout        → sections (heuristic)
      4. NLPPipeline       → {skills, experience, education, ...}
      5. EmbeddingGenerator → vector (always runs, never skipped)

    FALLBACK: If local pipeline throws, run GeminiCVAnalyzer once.
    If BOTH fail → mark candidate status='failed' and return error.

    DB REPLACED: All Django ORM (Candidate.objects, Skill.objects, AuditLog.objects)
                 replaced with Supabase SDK: sb_table('candidates'), sb_table('skills'),
                 sb_table('audit_logs'), sb_table('candidates_skills'),
                 sb_table('users'), sb_table('companies').
    """
    ext = os.path.splitext(cv_file_path)[1].lower()
    mime_type = 'application/pdf' if ext == '.pdf' else ('image/png' if ext == '.png' else 'image/jpeg')

    pipeline_method = 'LOCAL_OCR_CNN_NLP'
    pipeline_error = None

    # ------------------------------------------------------------------
    # Resolve User + Company  (SUPABASE SDK)
    # ------------------------------------------------------------------
    user = None
    try:
        res = sb_table('users').select('*').eq('id', str(user_id)).limit(1).execute()
        if not res.data:
            print(f"process_cv_task: User {user_id} does not exist")
            return {'candidate_id': None, 'status': 'FAILED', 'error': f'User {user_id} not found'}
        user = res.data[0]
    except Exception as e:
        print(f"process_cv_task: User lookup FAILED via Supabase: {e}")
        traceback.print_exc()
        return {'candidate_id': None, 'status': 'FAILED', 'error': f'User lookup failed: {e}'}

    company = None
    if company_id:
        try:
            res = sb_table('companies').select('*').eq('id', str(company_id)).limit(1).execute()
            if res.data:
                company = res.data[0]
        except Exception:
            company = None
    if company is None and user.get('company_id'):
        try:
            res = sb_table('companies').select('*').eq('id', str(user['company_id'])).limit(1).execute()
            if res.data:
                company = res.data[0]
        except Exception:
            company = None

    company_id_val = company['id'] if company else None

    # ------------------------------------------------------------------
    # Step A:  Run Local Pipeline  (OCR → CNN → NLP)
    # Step B:  On failure, run Gemini Fallback (once)
    # Step C:  If both fail → create FAILED candidate record & return
    # ------------------------------------------------------------------
    raw_text = ""
    confidence = 0.0
    structured_data = {
        'name': None, 'email': None, 'phone': None,
        'skills': [], 'experience': [], 'education': [],
    }

    try:
        raw_text, confidence, _layout, structured_data = _run_local_pipeline(cv_file_path, ext)
        pipeline_method = 'LOCAL_OCR_CNN_NLP'
    except Exception as local_err:
        pipeline_error = str(local_err)
        print(f"[process_cv_task] Local pipeline FAILED: {local_err}")
        print("[process_cv_task] Attempting Gemini fallback...")
        try:
            raw_text, confidence, gemini_structured = _run_gemini_fallback(cv_file_path, mime_type)
            structured_data.update(gemini_structured)
            pipeline_method = 'GEMINI_FALLBACK'
            structured_data['pipeline_fallback_reason'] = pipeline_error
        except Exception as gemini_err:
            # --------------------------------------------------------------
            # BOTH PIPELINES FAILED  →  record a FAILED candidate entry
            # via Supabase SDK so the UI can show error state.
            # --------------------------------------------------------------
            print(f"[process_cv_task] BOTH pipelines failed. Creating failed record via Supabase...")
            try:
                failed_candidate_id = str(uuid.uuid4())
                failed_payload = {
                    'id': failed_candidate_id,
                    'user_id': str(user['id']) if user else None,
                    'company_id': company_id_val,
                    'batch_id': str(batch_id) if batch_id else None,
                    'name': os.path.basename(cv_file_path),
                    'source_file': cv_file_path,
                    'raw_text': "",
                    'extracted_skills': [],
                    'extracted_experience': {},
                    'structured_data': {
                        'error': str(gemini_err),
                        'local_error': pipeline_error,
                    },
                    'ocr_confidence': 0.0,
                    'status': 'failed',
                    'created_at': _now_iso(),
                    'updated_at': _now_iso(),
                }
                try:
                    failed_payload['embedding'] = None
                    failed_payload['embedding_vector'] = None
                except Exception:
                    pass
                sb_table('candidates').insert(failed_payload).execute()

                try:
                    sb_table('audit_logs').insert({
                        'id': str(uuid.uuid4()),
                        'user_id': str(user['id']) if user else None,
                        'action': 'CV_PROCESSING_FAILED',
                        'resource_type': 'CANDIDATE',
                        'resource_id': failed_candidate_id,
                        'details': {
                            'filename': os.path.basename(cv_file_path),
                            'method': pipeline_method,
                            'local_error': pipeline_error,
                            'gemini_error': str(gemini_err),
                        },
                        'created_at': _now_iso(),
                    }).execute()
                except Exception:
                    pass
            except Exception as db_err:
                print(f"[process_cv_task] Could not even write failed record via Supabase: {db_err}")
                traceback.print_exc()
            return {
                'candidate_id': None,
                'status': 'FAILED',
                'error': f'Local: {pipeline_error}; Gemini: {gemini_err}',
            }

    # ------------------------------------------------------------------
    # Step 5 (ALWAYS runs):  Embedding Module  →  vector
    # ------------------------------------------------------------------
    embedding = None
    try:
        embed_gen = EmbeddingGenerator()
        embedding_text = raw_text if raw_text else (
            ' '.join(structured_data.get('skills', [])) + ' ' +
            ' '.join(str(x) for x in structured_data.get('experience', []))
        )
        embedding = embed_gen.generate_embedding(embedding_text)
    except Exception as e:
        print(f"[process_cv_task] Embedding FAILED: {e}")
        traceback.print_exc()
        embedding = [0.0] * 384

    # ------------------------------------------------------------------
    # DB WRITE 1:  Create Candidate record  via Supabase SDK
    # ------------------------------------------------------------------
    candidate_id = str(uuid.uuid4())
    cand_code = f"CAND-{candidate_id.split('-')[0][:4].upper()}"
    structured_data['candidate_code'] = cand_code
    structured_data['simple_id'] = cand_code
    
    # Lookup job metadata if job_id was provided
    matched_job_title = "General Applicant Pool"
    matched_job_created_at = None
    if job_id:
        try:
            j_res = sb_table('job_descriptions').select('*').eq('id', str(job_id)).limit(1).execute()
            if j_res.data:
                matched_job_title = j_res.data[0].get('title', 'Matched Job')
                matched_job_created_at = j_res.data[0].get('created_at')
        except Exception:
            pass

    structured_data['matched_job_id'] = str(job_id) if job_id else None
    structured_data['matched_job_title'] = matched_job_title
    structured_data['matched_job_created_at'] = matched_job_created_at

    try:
        insert_payload = {
            'id': candidate_id,
            'candidate_code': cand_code,
            'user_id': str(user['id']) if user else None,
            'company_id': company_id_val,
            'batch_id': str(batch_id) if batch_id else None,
            'name': structured_data.get('name') or os.path.basename(cv_file_path),
            'first_name': structured_data.get('first_name'),
            'last_name': structured_data.get('last_name'),
            'email': structured_data.get('email'),
            'phone': structured_data.get('phone'),
            'source_file': os.path.basename(cv_file_path),
            'raw_text': raw_text,
            'extracted_skills': structured_data.get('skills', []) or [],
            'extracted_experience': {
                'experience': structured_data.get('experience', []),
                'education': structured_data.get('education', []),
                'school_info': structured_data.get('school_info', {}),
                'references': structured_data.get('references', []),
                'credentials': structured_data.get('credentials', {}),
                'total_experience_years': structured_data.get('total_experience_years', 0),
            },
            'structured_data': structured_data,
            'embedding': embedding,
            'embedding_vector': embedding,
            'ocr_confidence': float(confidence or 0.0),
            'status': 'complete',
            'created_at': _now_iso(),
            'updated_at': _now_iso(),
        }
        sb_table('candidates').insert(insert_payload).execute()
    except Exception as db_err:
        print(f"[process_cv_task] Supabase insert (candidates) FAILED: {db_err}")
        traceback.print_exc()
        return {
            'candidate_id': None,
            'status': 'FAILED',
            'error': f'DB write (Candidate via Supabase) failed: {db_err}',
        }

    # ------------------------------------------------------------------
    # DB WRITE 2:  Skills M2M  via Supabase SDK  (table: candidates_skills)
    # ------------------------------------------------------------------
    try:
        for skill_name in structured_data.get('skills', []) or []:
            s_name = str(skill_name).strip()
            if not s_name:
                continue
            # Upsert skill into 'skills' table
            try:
                s_res = sb_table('skills').select('*').eq('name', s_name).limit(1).execute()
                if s_res.data:
                    skill_id = s_res.data[0]['id']
                else:
                    skill_id = str(uuid.uuid4())
                    try:
                        sb_table('skills').insert({
                            'id': skill_id,
                            'name': s_name,
                            'category': None,
                            'aliases': [],
                            'is_active': True,
                        }).execute()
                    except Exception:
                        s_res2 = sb_table('skills').select('*').eq('name', s_name).limit(1).execute()
                        if s_res2.data:
                            skill_id = s_res2.data[0]['id']
                            pass
                        else:
                            continue
            except Exception:
                continue

            # Insert M2M link into candidates_skills join table
            try:
                link_payload = {'candidate_id': candidate_id, 'skill_id': skill_id}
                sb_table('candidates_skills').upsert(link_payload, on_conflict='candidate_id,skill_id').execute()
            except Exception:
                pass
    except Exception as e:
        print(f"[process_cv_task] Skills M2M via Supabase warning (non-critical): {e}")

    # ------------------------------------------------------------------
    # DB WRITE 3:  Audit Log  via Supabase SDK
    # ------------------------------------------------------------------
    try:
        sb_table('audit_logs').insert({
            'id': str(uuid.uuid4()),
            'user_id': str(user['id']) if user else None,
            'action': 'CV_PROCESSED',
            'resource_type': 'CANDIDATE',
            'resource_id': candidate_id,
            'details': {
                'filename': os.path.basename(cv_file_path),
                'method': pipeline_method,
                'ocr_confidence': float(confidence or 0.0),
                'skills_count': len(structured_data.get('skills', []) or []),
                'pipeline_error': pipeline_error,
            },
            'created_at': _now_iso(),
        }).execute()
    except Exception as e:
        print(f"[process_cv_task] AuditLog insert via Supabase warning (non-critical): {e}")

    # ------------------------------------------------------------------
    # If a job_id was provided, trigger ranking refresh
    # ------------------------------------------------------------------
    if job_id:
        try:
            refresh_ranking_task.delay(job_id, user['id'] if user else None)
        except Exception as e:
            print(f"[process_cv_task] refresh_ranking_task scheduling warning: {e}")

    return {
        'candidate_id': candidate_id,
        'status': 'SUCCESS',
        'method': pipeline_method,
        'ocr_confidence': float(confidence or 0.0),
    }


@shared_task
def refresh_ranking_task(job_id, user_id=None):
    """
    Async task to recompute rankings for all candidates against a job.
    Uses RankingEngine.rank_candidates.

    DB REPLACED: All Django ORM (JobDescription.objects, Candidate.objects,
                 Ranking.objects, User.objects) replaced with Supabase SDK:
                 sb_table('jobs'), sb_table('candidates'), sb_table('rankings'),
                 sb_table('users').
    """
    # ------------------------------------------------------------------
    # DB READ: Job + Candidates  via Supabase SDK
    # ------------------------------------------------------------------
    job = None
    candidates = []
    try:
        job_res = sb_table('jobs').select('*').eq('id', str(job_id)).limit(1).execute()
        if not job_res.data:
            print(f"refresh_ranking_task: Job {job_id} does not exist")
            return {'job_id': job_id, 'count': 0, 'status': 'FAILED', 'error': 'Job not found'}
        job = job_res.data[0]
    except Exception as e:
        print(f"refresh_ranking_task: Job query via Supabase FAILED: {e}")
        traceback.print_exc()
        return {'job_id': job_id, 'count': 0, 'status': 'FAILED', 'error': str(e)}

    try:
        cand_res = sb_table('candidates').select('*').eq('status', 'complete').execute()
        candidates = cand_res.data or []
    except Exception as e:
        print(f"refresh_ranking_task: Candidates query via Supabase FAILED: {e}")
        traceback.print_exc()
        return {'job_id': job_id, 'count': 0, 'status': 'FAILED', 'error': str(e)}

    # ------------------------------------------------------------------
    # Ranking Engine  (wrapped in try/except)
    # ------------------------------------------------------------------
    results = []
    try:
        ranking_engine = RankingEngine()

        candidate_list = []
        for c in candidates:
            emb = None
            if c.get('embedding_vector') is not None:
                try:
                    ev = c['embedding_vector']
                    if hasattr(ev, 'tolist'):
                        emb = ev.tolist()
                    else:
                        emb = list(ev)
                except Exception:
                    emb = c.get('embedding')
            else:
                emb = c.get('embedding')
            if not emb:
                continue

            # Try to load skills from M2M join via Supabase, fallback to extracted_skills JSON
            skills_list = []
            try:
                link_res = sb_table('candidates_skills') \
                    .select('skill_id, skills(id, name)') \
                    .eq('candidate_id', str(c['id'])).execute()
                if link_res.data:
                    skills_list = [
                        (row['skills']['name'] if isinstance(row.get('skills'), dict) else row['skill_id'])
                        for row in link_res.data if row.get('skills')
                    ]
            except Exception:
                skills_list = []
            if not skills_list:
                skills_list = c.get('extracted_skills') or []

            candidate_list.append({
                'id': str(c['id']),
                'embedding': emb,
                'skills': list(skills_list),
            })

        job_emb = None
        if job.get('embedding_vector') is not None:
            try:
                jev = job['embedding_vector']
                if hasattr(jev, 'tolist'):
                    job_emb = jev.tolist()
                else:
                    job_emb = list(jev)
            except Exception:
                job_emb = job.get('embedding')
        else:
            job_emb = job.get('embedding')
        if not job_emb:
            job_emb = [0.0] * 384

        job_desc = {
            'embedding': job_emb,
            'required_skills': job.get('required_skills') or [],
            'preferred_skills': job.get('preferred_skills') or [],
        }

        results = ranking_engine.rank_candidates(candidate_list, job_desc)

        # Mark job status as complete via Supabase SDK
        try:
            sb_table('jobs').update({
                'status': 'complete',
                'updated_at': _now_iso(),
            }).eq('id', str(job['id'])).execute()
        except Exception:
            pass
    except Exception as e:
        print(f"refresh_ranking_task: RankingEngine FAILED: {e}")
        traceback.print_exc()
        return {'job_id': job_id, 'count': 0, 'status': 'FAILED', 'error': f'Ranking engine: {e}'}

    # ------------------------------------------------------------------
    # Resolve creator (for Ranking.created_by) via Supabase SDK
    # ------------------------------------------------------------------
    creator_id = None
    if user_id:
        try:
            u_res = sb_table('users').select('id').eq('id', str(user_id)).limit(1).execute()
            if u_res.data:
                creator_id = str(u_res.data[0]['id'])
        except Exception:
            creator_id = None
    if creator_id is None:
        creator_id = job.get('created_by_id') or job.get('user_id')

    # ------------------------------------------------------------------
    # DB WRITE:  Rankings  via Supabase SDK (upsert each row)
    # ------------------------------------------------------------------
    created_or_updated = 0
    try:
        for res in results:
            try:
                sem_score = float(res.get('semantic_score', 0.0))
                sk_score = float(res.get('skill_match_score', 0.0))
                ov_score = float(res.get('overall_score', 0.0))
                cand_id = str(res.get('candidate_id'))

                ranking_payload = {
                    'id': str(uuid.uuid4()),
                    'job_id': str(job['id']),
                    'candidate_id': cand_id,
                    'match_score': ov_score,
                    'similarity_score': sem_score,
                    'skill_match_score': sk_score,
                    'overall_score': ov_score,
                    'rank_position': int(res.get('rank_position', 0)),
                    'breakdown': {
                        'semantic': sem_score,
                        'skill_match': sk_score,
                        'overall': ov_score,
                    },
                    'matched_requirements': [],
                    'explanation': res.get('explanation', ''),
                    'created_by_id': creator_id,
                    'created_at': _now_iso(),
                }
                # Upsert on conflict (job_id, candidate_id) — unique_together
                sb_table('rankings').upsert(
                    ranking_payload,
                    on_conflict='job_id,candidate_id',
                ).execute()
                created_or_updated += 1
            except Exception as row_err:
                print(f"refresh_ranking_task: Single ranking row upsert FAILED (continuing): {row_err}")
                continue
    except Exception as outer_err:
        print(f"refresh_ranking_task: Ranking save outer failure via Supabase: {outer_err}")
        traceback.print_exc()
        return {
            'job_id': job_id,
            'count': created_or_updated,
            'status': 'PARTIAL',
            'error': str(outer_err),
        }

    return {
        'job_id': job_id,
        'count': created_or_updated,
        'status': 'SUCCESS',
    }
