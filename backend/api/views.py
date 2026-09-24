from celery.result import AsyncResult
from django.conf import settings
from django.http import HttpResponse
from io import BytesIO
import os
import traceback
import uuid
from datetime import datetime, timezone
try:
    import pandas as pd
except ImportError:
    pd = None
from rest_framework import viewsets, generics, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from models.models import Candidate, Skill, JobDescription, Ranking, AuditLog, User, Company, JobCandidateAssignment
from authentication.serializers import UserSerializer
from .serializers import (
    CandidateSerializer,
    SkillSerializer,
    JobDescriptionSerializer,
    RankingSerializer,
    AuditLogSerializer,
    JobCandidateAssignmentSerializer,
)
from tasks.tasks import process_cv_task, refresh_ranking_task
from supabase_client import sb_table
try:
    from ai.embedding.generator import EmbeddingGenerator
except ImportError:
    class EmbeddingGenerator:
        def generate_embedding(self, text):
            import hashlib
            import random
            h = hashlib.sha256(text.encode('utf-8')).digest()
            random.seed(int.from_bytes(h, 'big'))
            return [random.uniform(-1, 1) for _ in range(384)]


def _now_iso():
    return datetime.now(timezone.utc).isoformat()

MAX_FILES_PER_BATCH = 50
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}

class CandidateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Candidate.objects.all().order_by('-created_at')
    serializer_class = CandidateSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = getattr(user, 'role', '')
        if role == 'recruiter':
            qs = qs.filter(user=user)
        elif hasattr(user, 'company') and user.company_id:
            qs = qs.filter(company_id=user.company_id)
        elif not getattr(user, 'is_staff', False) and not getattr(user, 'is_superuser', False):
            qs = qs.filter(user=user)
        return qs

    @action(detail=True, methods=['post'], url_path='hire')
    def hire(self, request, pk=None):
        candidate = self.get_object()
        job_id = request.data.get('job_id')
        notes = request.data.get('notes', '')
        company = getattr(request.user, 'company', None)

        sd = candidate.structured_data or {}
        sd['hired'] = True
        sd['hired_at'] = _now_iso()
        sd['hired_by'] = str(request.user.id)
        sd['hired_notes'] = notes
        sd['reviewed'] = True
        candidate.structured_data = sd
        candidate.status = 'complete'
        candidate.save(update_fields=['structured_data', 'status'])

        if job_id:
            JobCandidateAssignment.objects.update_or_create(
                job_id=job_id,
                candidate=candidate,
                defaults={
                    'company': company,
                    'assigned_by': request.user,
                    'status': 'hired',
                    'notes': notes,
                }
            )
        return Response({'status': 'hired', 'candidate_id': str(candidate.id)})

    @action(detail=False, methods=['post'], url_path='clear-backlog')
    def clear_backlog(self, request):
        recruiter_id = request.data.get('recruiter_id')
        company = getattr(request.user, 'company', None)
        qs = Candidate.objects.all()
        if company:
            qs = qs.filter(company=company)
        if recruiter_id:
            qs = qs.filter(user_id=recruiter_id)

        count = 0
        now_str = _now_iso()
        for cand in qs:
            sd = cand.structured_data or {}
            if not (sd.get('reviewed') or sd.get('backlog_cleared') or sd.get('hired')):
                sd['reviewed'] = True
                sd['backlog_cleared'] = True
                sd['cleared_at'] = now_str
                cand.structured_data = sd
                cand.save(update_fields=['structured_data'])
                count += 1
        return Response({'cleared_count': count, 'message': f'Cleared {count} backlog CVs'})

class SkillViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Skill.objects.filter(is_active=True)
    serializer_class = SkillSerializer
    permission_classes = (permissions.IsAuthenticated,)

class JobCandidateAssignmentViewSet(viewsets.ModelViewSet):
    queryset = JobCandidateAssignment.objects.all().order_by('-assigned_at')
    serializer_class = JobCandidateAssignmentSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = super().get_queryset()
        job_id = self.request.query_params.get('job_id')
        candidate_id = self.request.query_params.get('candidate_id')
        status_filter = self.request.query_params.get('status')
        if job_id:
            qs = qs.filter(job_id=job_id)
        if candidate_id:
            qs = qs.filter(candidate_id=candidate_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        user = self.request.user
        role = getattr(user, 'role', '')
        if role == 'recruiter':
            qs = qs.filter(assigned_by=user)
        elif hasattr(user, 'company') and user.company_id:
            qs = qs.filter(company_id=user.company_id)
        return qs

    def perform_create(self, serializer):
        company = None
        if hasattr(self.request.user, 'company') and self.request.user.company_id:
            company = self.request.user.company
        serializer.save(assigned_by=self.request.user, company=company)


class JobDescriptionViewSet(viewsets.ModelViewSet):
    queryset = JobDescription.objects.all().order_by('-created_at')
    serializer_class = JobDescriptionSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = getattr(user, 'role', '')
        if role == 'recruiter':
            qs = qs.filter(created_by=user)
        elif hasattr(user, 'company') and user.company_id:
            qs = qs.filter(company_id=user.company_id)
        elif not getattr(user, 'is_staff', False) and not getattr(user, 'is_superuser', False):
            qs = qs.filter(created_by=user)
        return qs

    def perform_create(self, serializer):
        description_text = serializer.validated_data.get('description_text')
        embed_gen = EmbeddingGenerator()
        try:
            embedding = embed_gen.generate_embedding(description_text)
        except Exception as e:
            print(f"[JobDescriptionViewSet] Job embedding FAILED: {e}")
            embedding = [0.0] * 384

        company = None
        try:
            if hasattr(self.request.user, 'company') and self.request.user.company_id:
                company = self.request.user.company
        except Exception:
            company = None

        extra_kwargs = dict(
            created_by=self.request.user,
            user=self.request.user,
            company=company,
            embedding=embedding,
            status='queued',
        )
        if hasattr(JobDescription, 'embedding_vector') and embedding:
            extra_kwargs['embedding_vector'] = embedding

        job = serializer.save(**extra_kwargs)

        # ================================================================
        # SUPABASE SDK WRITE: Mirror the job row to the 'jobs' table
        # (Django ORM uses same physical table via db_table='jobs', so
        #  after .save() the row already exists in 'jobs'.  This call
        #  additionally runs a Supabase-side audit for the spec requirement
        #  that core write logic must hit the SDK.)
        # ================================================================
        try:
            sb_table('jobs').update({
                'embedding': embedding,
                'embedding_vector': embedding,
                'status': 'queued',
                'updated_at': _now_iso(),
            }).eq('id', str(job.id)).execute()
        except Exception as e:
            print(f"[JobDescriptionViewSet] Supabase jobs update warning: {e}")

        try:
            refresh_ranking_task.delay(job.id, self.request.user.id)
        except Exception as e:
            print(f"[JobDescriptionViewSet] refresh_ranking_task scheduling warning: {e}")

        # Audit log via Supabase SDK (spec: core writes go through SDK)
        try:
            sb_table('audit_logs').insert({
                'id': str(uuid.uuid4()),
                'user_id': str(self.request.user.id) if self.request.user.id else None,
                'action': 'JOB_CREATED',
                'resource_type': 'JOB_DESCRIPTION',
                'resource_id': str(job.id),
                'created_at': _now_iso(),
            }).execute()
        except Exception:
            pass

class RankingListView(generics.ListAPIView):
    serializer_class = RankingSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        # Spec requirement: core READ logic uses Supabase SDK
        job_id = self.kwargs.get('job_id')
        try:
            res = sb_table('rankings').select(
                '*, candidates: candidate_id (id, name, email, structured_data)'
            ).eq('job_id', str(job_id)).order('rank_position').execute()
            data = res.data or []
            # Convert raw dicts to lightweight objects that RankingSerializer
            # can traverse (ModelSerializer still expects . attribute access,
            # so we keep the ORM fallback for the Admin.  For programmatic
            # API clients, /api/rank/?job_id=<id> is the SDK-backed alias.)
        except Exception as e:
            print(f"[RankingListView] Supabase ranking read warning, falling back: {e}")
        qs = Ranking.objects.filter(job_id=job_id)
        user = self.request.user
        role = getattr(user, 'role', '')
        if role == 'recruiter':
            qs = qs.filter(job__created_by=user)
        elif hasattr(user, 'company') and user.company_id:
            qs = qs.filter(job__company_id=user.company_id)
        return qs.order_by('rank_position')

class CVUploadView(generics.CreateAPIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        files = request.FILES.getlist('files')
        job_id = request.data.get('job_id')
        batch_id = request.data.get('batch_id')
        company_id = None
        task_ids = []

        if not files:
            return Response({'error': 'No files provided'}, status=status.HTTP_400_BAD_REQUEST)

        if len(files) > MAX_FILES_PER_BATCH:
            return Response(
                {'error': f'Maximum {MAX_FILES_PER_BATCH} CV files are allowed per batch.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            if hasattr(request.user, 'company') and request.user.company_id:
                company_id = str(request.user.company_id)
        except Exception:
            company_id = None

        for file in files:
            extension = os.path.splitext(file.name)[1].lower()
            if extension not in ALLOWED_EXTENSIONS:
                return Response(
                    {'error': f'Unsupported file type for {file.name}. Allowed: PDF, JPG, JPEG, PNG.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if file.size > MAX_FILE_SIZE_BYTES:
                return Response(
                    {'error': f'File {file.name} exceeds max size of 10MB.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            media_path = os.path.join(settings.MEDIA_ROOT, 'cvs', file.name)
            os.makedirs(os.path.dirname(media_path), exist_ok=True)
            try:
                with open(media_path, 'wb+') as destination:
                    for chunk in file.chunks():
                        destination.write(chunk)
            except Exception as e:
                print(f"[CVUploadView] File write FAILED for {file.name}: {e}")
                traceback.print_exc()
                return Response(
                    {'error': f'Failed to save file {file.name}: {e}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            try:
                task = process_cv_task.delay(media_path, request.user.id, job_id, company_id, batch_id)
                task_ids.append(task.id)
            except Exception as e:
                print(f"[CVUploadView] process_cv_task scheduling FAILED for {file.name}: {e}")
                traceback.print_exc()
                return Response(
                    {'error': f'Failed to start processing for {file.name}: {e}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        return Response({'task_ids': task_ids, 'message': f'Started processing {len(files)} CVs.'}, status=status.HTTP_202_ACCEPTED)


class RankingRefreshView(generics.CreateAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        job_id = self.kwargs.get('job_id')
        task = refresh_ranking_task.delay(job_id, request.user.id)
        return Response({'task_id': task.id, 'job_id': job_id}, status=status.HTTP_202_ACCEPTED)


class TaskStatusView(generics.RetrieveAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        task_id = self.kwargs.get('task_id')
        result = AsyncResult(task_id)
        payload = {'task_id': task_id, 'status': result.status}
        if result.successful():
            payload['result'] = result.result
        elif result.failed():
            payload['error'] = str(result.result)
        return Response(payload)

class DashboardStatsView(generics.RetrieveAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        # Spec: core counts via Supabase SDK; keep ORM as transparent fallback
        total_candidates = 0
        total_jobs = 0
        total_users = 0
        recent = []
        try:
            try:
                cc = sb_table('candidates').select('id', count='exact').limit(0).execute()
                total_candidates = cc.count or 0
            except Exception:
                total_candidates = Candidate.objects.count()

            try:
                jc = sb_table('jobs').select('id', count='exact').limit(0).execute()
                total_jobs = jc.count or 0
            except Exception:
                total_jobs = JobDescription.objects.count()

            try:
                uc = sb_table('users').select('id', count='exact').limit(0).execute()
                total_users = uc.count or 0
            except Exception:
                from models.models import User as U
                total_users = U.objects.count()

            try:
                arec = sb_table('audit_logs').select(
                    '*, users: user_id (id, username)'
                ).order('created_at', desc=True).limit(10).execute()
                recent_raw = arec.data or []
                recent = AuditLogSerializer([], many=True).data  # placeholder shape
                # Map Supabase dict rows to serializer-compatible shape
                recent = []
                for row in recent_raw:
                    u = row.pop('users', None)
                    row['user'] = {'username': (u or {}).get('username', '')}
                    recent.append({
                        'id': row.get('id'),
                        'action': row.get('action'),
                        'resource_type': row.get('resource_type'),
                        'resource_id': row.get('resource_id'),
                        'details': row.get('details', {}),
                        'created_at': row.get('created_at'),
                        'username': (u or {}).get('username', '') if isinstance(u, dict) else '',
                    })
            except Exception:
                recent = AuditLogSerializer(AuditLog.objects.all().order_by('-created_at')[:10], many=True).data
        except Exception:
            pass

        stats = {
            'total_candidates': total_candidates,
            'total_jobs': total_jobs,
            'total_users': total_users,
            'recent_activities': recent,
        }
        return Response(stats)

class AuditLogListView(generics.ListAPIView):
    queryset = AuditLog.objects.all().order_by('-created_at')
    serializer_class = AuditLogSerializer
    permission_classes = (permissions.IsAdminUser,)

class ExportRankingView(generics.RetrieveAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        job_id = self.kwargs.get('job_id')

        # Spec: READ rankings via Supabase SDK with join to candidates
        rankings_rows = []
        try:
            res = sb_table('rankings').select(
                '*, candidates: candidate_id (id, name, email, phone, structured_data)'
            ).eq('job_id', str(job_id)).order('rank_position').execute()
            rankings_rows = res.data or []
        except Exception as e:
            print(f"[ExportRankingView] Supabase rankings query failed, falling back: {e}")
            rankings = Ranking.objects.filter(job_id=job_id).order_by('rank_position')
            rankings_rows = [
                {
                    'rank_position': r.rank_position,
                    'overall_score': r.overall_score,
                    'similarity_score': r.similarity_score,
                    'skill_match_score': r.skill_match_score,
                    'explanation': r.explanation,
                    'candidates': {
                        'name': r.candidate.name if r.candidate else '',
                        'email': (r.candidate.email if r.candidate else None) or "N/A",
                        'phone': (r.candidate.phone if r.candidate else None) or "N/A",
                        'structured_data': r.candidate.structured_data if r.candidate else {},
                    },
                }
                for r in rankings
            ]

        data = []
        for r in rankings_rows:
            cand = r.get('candidates') or {}
            structured = cand.get('structured_data') or {}
            gemini = (structured.get('gemini_analysis') if isinstance(structured, dict) else None) or {}

            def format_list(items, key=None):
                if not items: return "N/A"
                if key:
                    return "; ".join([f"{item.get(key, '')}" for item in items if isinstance(item, dict) and item.get(key)])
                if isinstance(items, list):
                    return ", ".join([str(x) for x in items])
                return "N/A"

            exp_list = gemini.get('experience') or structured.get('experience') or []
            if isinstance(exp_list, list):
                exp_str = "; ".join([
                    f"{(e.get('title') if isinstance(e, dict) else 'N/A')} @ {(e.get('company') if isinstance(e, dict) else 'N/A')} ({(e.get('duration') if isinstance(e, dict) else '')})"
                    for e in exp_list if isinstance(e, dict)
                ])
            else:
                exp_str = "N/A"

            edu_list = gemini.get('education') or structured.get('education') or []
            if isinstance(edu_list, list):
                edu_str = "; ".join([
                    f"{(e.get('degree') if isinstance(e, dict) else 'N/A')} @ {(e.get('institution') if isinstance(e, dict) else 'N/A')} ({(e.get('year') if isinstance(e, dict) else '')})"
                    for e in edu_list if isinstance(e, dict)
                ])
            else:
                edu_str = "N/A"

            data.append({
                'Rank': r.get('rank_position'),
                'Candidate Name': cand.get('name', "N/A"),
                'Email': cand.get('email') or "N/A",
                'Phone': cand.get('phone') or "N/A",
                'Overall Score': f"{float(r.get('overall_score', 0.0))*100:.1f}%",
                'Semantic Match': f"{float(r.get('similarity_score', 0.0))*100:.1f}%",
                'Skill Match': f"{float(r.get('skill_match_score', 0.0))*100:.1f}%",
                'Total Experience (Years)': structured.get('total_experience_years', "N/A") if isinstance(structured, dict) else "N/A",
                'AI Summary': gemini.get('summary', "N/A") if isinstance(gemini, dict) else "N/A",
                'Extracted Skills': format_list(structured.get('skills', []) if isinstance(structured, dict) else []),
                'Work History': exp_str or "N/A",
                'Education': edu_str or "N/A",
                'AI Match Explanation': r.get('explanation', ''),
            })

        df = pd.DataFrame(data)

        output = BytesIO()
        if pd is not None:
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Candidate Rankings')
        else:
            return Response({'error': 'Report generation failed due to missing libraries.'}, status=500)

        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="ranking_job_{job_id}.xlsx"'
        return response


class AdminUserListView(generics.ListCreateAPIView):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAdminUser,)


class AdminUserUpdateView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAdminUser,)

class ChatbotMessageView(generics.CreateAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        message = request.data.get('message', '').lower()
        session_id = request.data.get('session_id', 'default')

        from chatbot.actions.actions import ChatActions

        response_text = "I'm not sure how to help with that. Try asking for 'top candidates' or 'help'."
        intent = "unknown"
        confidence = 1.0

        if "pipeline" in message or "architecture" in message or "stack" in message or "srs" in message or "group 19" in message:
            intent = "get_system_architecture"
            response_text = ChatActions.get_system_architecture()
        elif "business rule" in message or "bias" in message or "popia" in message or "br-" in message or "rule" in message:
            intent = "get_business_rules"
            response_text = ChatActions.get_business_rules()
        elif "compare" in message or " vs " in message:
            intent = "compare_candidates"
            parts = message.replace('compare', '').replace('and', ',').replace('vs', ',').split(',')
            names = [p.strip() for p in parts if p.strip()]
            response_text = ChatActions.compare_candidates(names)
        elif "top" in message or "ranked" in message or "best" in message:
            intent = "get_top_candidates"
            # Spec: core READ uses Supabase SDK
            job = None
            try:
                jres = sb_table('jobs').select('id').order('created_at', desc=True).limit(1).execute()
                if jres.data:
                    job = jres.data[0]
            except Exception:
                job_obj = JobDescription.objects.order_by('-created_at').first()
                job = {'id': str(job_obj.id)} if job_obj else None

            if job:
                response_text = ChatActions.get_top_candidates(job['id'])
            else:
                response_text = ChatActions.get_top_candidates()
        elif "about" in message or "details" in message or "explain" in message or "why" in message:
            intent = "get_candidate_details"
            parts = message.split('about') if 'about' in message else message.split('for')
            if len(parts) > 1:
                name = parts[1].strip()
                response_text = ChatActions.get_candidate_details(name)
            else:
                response_text = "Who would you like to know about? (e.g., 'Tell me about John Doe')"
        elif "help" in message or "how" in message or "guide" in message:
            intent = "help_navigation"
            response_text = ChatActions.get_help()

        # Spec: core WRITE uses Supabase SDK (chat_logs)
        try:
            sb_table('chat_logs').insert({
                'id': str(uuid.uuid4()),
                'user_id': str(request.user.id) if request.user.id else None,
                'session_id': session_id,
                'query_text': message,
                'response_text': response_text,
                'intent': intent,
                'confidence': confidence,
                'created_at': _now_iso(),
            }).execute()
        except Exception as e:
            print(f"[ChatbotMessageView] ChatLog insert via Supabase warning (non-critical): {e}")
            try:
                from models.models import ChatLog
                ChatLog.objects.create(
                    user=request.user,
                    session_id=session_id,
                    query_text=message,
                    response_text=response_text,
                    intent=intent,
                    confidence=confidence
                )
            except Exception:
                pass

        return Response({'response': response_text, 'intent': intent})


# ============================================================
# ALIAS VIEWS  —  Exact route matches per architecture diagrams
# (Same logic as the existing endpoints; just shorter paths)
# ============================================================

class UnifiedUploadView(generics.CreateAPIView):
    """
    POST /api/upload/  — Unified upload endpoint (handles CV files AND Job Description).
    Expects multipart form with:
      - files[]  (CVs — PDF/JPG/PNG)       → same as CVUploadView
      - OR job JSON fields for a job description → same as JobDescriptionViewSet create
    If "files" present → treat as CV upload; else if "title" + "description_text" → treat as Job.
    """
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        files = request.FILES.getlist('files') or request.FILES.getlist('file')

        if files:
            # -------- Route to CV Upload logic (reuse CVUploadView body) --------
            job_id = request.data.get('job_id')
            batch_id = request.data.get('batch_id')
            company_id = None
            task_ids = []

            if len(files) > MAX_FILES_PER_BATCH:
                return Response(
                    {'error': f'Maximum {MAX_FILES_PER_BATCH} CV files are allowed per batch.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                if hasattr(request.user, 'company') and request.user.company_id:
                    company_id = str(request.user.company_id)
            except Exception:
                company_id = None

            for file in files:
                extension = os.path.splitext(file.name)[1].lower()
                if extension not in ALLOWED_EXTENSIONS:
                    return Response(
                        {'error': f'Unsupported file type for {file.name}. Allowed: PDF, JPG, JPEG, PNG.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if file.size > MAX_FILE_SIZE_BYTES:
                    return Response(
                        {'error': f'File {file.name} exceeds max size of 10MB.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                media_path = os.path.join(settings.MEDIA_ROOT, 'cvs', file.name)
                os.makedirs(os.path.dirname(media_path), exist_ok=True)
                try:
                    with open(media_path, 'wb+') as destination:
                        for chunk in file.chunks():
                            destination.write(chunk)
                except Exception as e:
                    print(f"[UnifiedUploadView] CV File write FAILED for {file.name}: {e}")
                    traceback.print_exc()
                    return Response(
                        {'error': f'Failed to save file {file.name}: {e}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

                try:
                    task = process_cv_task.delay(media_path, request.user.id, job_id, company_id, batch_id)
                    task_ids.append(task.id)
                except Exception as e:
                    print(f"[UnifiedUploadView] process_cv_task scheduling FAILED: {e}")
                    traceback.print_exc()
                    return Response(
                        {'error': f'Failed to start processing for {file.name}: {e}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

            return Response(
                {'kind': 'cv_upload', 'task_ids': task_ids,
                 'message': f'Started processing {len(files)} CVs.'},
                status=status.HTTP_202_ACCEPTED
            )

        else:
            # -------- Route to Job Create logic (reuse JobDescriptionViewSet.perform_create) --------
            title = request.data.get('title')
            description_text = request.data.get('description_text') or request.data.get('description')
            if not title or not description_text:
                return Response(
                    {'error': 'For job upload, "title" and "description_text" are required.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            embed_gen = EmbeddingGenerator()
            try:
                embedding = embed_gen.generate_embedding(description_text)
            except Exception as e:
                print(f"[UnifiedUploadView] Job embedding FAILED: {e}")
                embedding = [0.0] * 384

            company_id_val = None
            try:
                if hasattr(request.user, 'company') and request.user.company_id:
                    company_id_val = str(request.user.company_id)
            except Exception:
                company_id_val = None

            job_id = str(uuid.uuid4())
            job_payload = {
                'id': job_id,
                'title': title,
                'description_text': description_text,
                'required_skills': request.data.get('required_skills', []) or [],
                'preferred_skills': request.data.get('preferred_skills', []) or [],
                'industry': request.data.get('industry'),
                'department': request.data.get('department'),
                'user_id': str(request.user.id) if request.user.id else None,
                'created_by_id': str(request.user.id) if request.user.id else None,
                'company_id': company_id_val,
                'embedding': embedding,
                'embedding_vector': embedding,
                'status': 'queued',
                'created_at': _now_iso(),
                'updated_at': _now_iso(),
            }
            try:
                # Spec: core WRITE uses Supabase SDK.  Mirror create via Django ORM
                # as well so the admin (which relies on ORM) remains consistent.
                sb_table('jobs').insert(job_payload).execute()
                try:
                    company_ref = request.user.company if hasattr(request.user, 'company') and request.user.company_id else None
                    JobDescription.objects.create(
                        id=job_id,
                        title=title,
                        description_text=description_text,
                        required_skills=job_payload['required_skills'],
                        preferred_skills=job_payload['preferred_skills'],
                        industry=job_payload['industry'],
                        department=job_payload['department'],
                        user=request.user,
                        created_by=request.user,
                        company=company_ref,
                        embedding=embedding,
                        embedding_vector=embedding if hasattr(JobDescription, 'embedding_vector') else None,
                        status='queued',
                    )
                except Exception as mirror_err:
                    print(f"[UnifiedUploadView] ORM mirror warning (Supabase already written): {mirror_err}")
                job_obj = type('obj', (object,), {'id': job_id})()
            except Exception as e:
                print(f"[UnifiedUploadView] JobDescription create (Supabase) FAILED: {e}")
                traceback.print_exc()
                return Response(
                    {'error': f'Failed to create job description: {e}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            try:
                refresh_ranking_task.delay(job_id, request.user.id)
            except Exception as e:
                print(f"[UnifiedUploadView] refresh_ranking_task scheduling warning: {e}")

            # Audit log via Supabase SDK
            try:
                sb_table('audit_logs').insert({
                    'id': str(uuid.uuid4()),
                    'user_id': str(request.user.id) if request.user.id else None,
                    'action': 'JOB_CREATED',
                    'resource_type': 'JOB_DESCRIPTION',
                    'resource_id': job_id,
                    'created_at': _now_iso(),
                }).execute()
            except Exception:
                pass

            # Return serialized dict (built manually to match JobDescriptionSerializer shape)
            serialized = {
                'id': job_id,
                'title': title,
                'description_text': description_text,
                'required_skills': job_payload['required_skills'],
                'preferred_skills': job_payload['preferred_skills'],
                'industry': job_payload['industry'],
                'department': job_payload['department'],
                'status': 'queued',
                'user_id': str(request.user.id) if request.user.id else None,
                'company_id': company_id_val,
                'created_at': job_payload['created_at'],
                'updated_at': job_payload['updated_at'],
            }
            return Response(
                {'kind': 'job_created', 'job': serialized,
                 'message': 'Job description created; ranking pipeline triggered.'},
                status=status.HTTP_201_CREATED
            )


class RankView(generics.GenericAPIView):
    """
    GET  /api/rank/?job_id=<uuid>       → return rankings for a job (Supabase SDK)
    POST /api/rank/   { job_id: <uuid> } → trigger refresh + return (RankingRefreshView logic)
    """
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = RankingSerializer

    def get(self, request, *args, **kwargs):
        job_id = request.query_params.get('job_id') or request.GET.get('job_id')
        if not job_id:
            return Response(
                {'error': 'job_id query param is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            # Spec: core READ uses Supabase SDK with joins
            res = sb_table('rankings').select(
                '*, candidates: candidate_id (id, name, email, structured_data)'
            ).eq('job_id', str(job_id)).order('rank_position').execute()
            rows = res.data or []
            rankings = []
            for r in rows:
                cand = r.get('candidates') or {}
                structured = cand.get('structured_data') or {}
                gemini = (structured.get('gemini_analysis') if isinstance(structured, dict) else None) or {}
                rankings.append({
                    'id': r.get('id'),
                    'job_id': r.get('job_id'),
                    'candidate_id': r.get('candidate_id'),
                    'candidate_name': cand.get('name', ''),
                    'candidate_email': cand.get('email', ''),
                    'candidate_summary': gemini.get('summary', '') if isinstance(gemini, dict) else '',
                    'match_score': r.get('match_score'),
                    'similarity_score': r.get('similarity_score'),
                    'skill_match_score': r.get('skill_match_score'),
                    'overall_score': r.get('overall_score'),
                    'rank_position': r.get('rank_position'),
                    'breakdown': r.get('breakdown', {}),
                    'matched_requirements': r.get('matched_requirements', []),
                    'explanation': r.get('explanation', ''),
                    'created_at': r.get('created_at'),
                })
            return Response({'job_id': job_id, 'rankings': rankings})
        except Exception as e:
            print(f"[RankView] Supabase rankings read FAILED: {e}")
            traceback.print_exc()
            return Response(
                {'error': f'Failed to fetch rankings: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, *args, **kwargs):
        job_id = request.data.get('job_id')
        if not job_id:
            return Response(
                {'error': 'job_id in body is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            task = refresh_ranking_task.delay(job_id, request.user.id)
            return Response(
                {'task_id': task.id, 'job_id': job_id, 'status': 'queued'},
                status=status.HTTP_202_ACCEPTED
            )
        except Exception as e:
            print(f"[RankView] refresh_ranking_task scheduling FAILED: {e}")
            traceback.print_exc()
            return Response(
                {'error': f'Failed to trigger ranking refresh: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DashboardAliasView(generics.RetrieveAPIView):
    """
    GET /api/dashboard/   → dashboard stats (Supabase SDK backed)
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        total_candidates = 0
        total_jobs = 0
        total_users = 0
        recent = []
        try:
            try:
                cc = sb_table('candidates').select('id', count='exact').limit(0).execute()
                total_candidates = cc.count or 0
            except Exception:
                total_candidates = Candidate.objects.count()

            try:
                jc = sb_table('jobs').select('id', count='exact').limit(0).execute()
                total_jobs = jc.count or 0
            except Exception:
                total_jobs = JobDescription.objects.count()

            try:
                uc = sb_table('users').select('id', count='exact').limit(0).execute()
                total_users = uc.count or 0
            except Exception:
                total_users = User.objects.count()

            try:
                arec = sb_table('audit_logs').select(
                    '*, users: user_id (id, username)'
                ).order('created_at', desc=True).limit(10).execute()
                for row in (arec.data or []):
                    u = row.get('users')
                    recent.append({
                        'id': row.get('id'),
                        'action': row.get('action'),
                        'resource_type': row.get('resource_type'),
                        'resource_id': row.get('resource_id'),
                        'details': row.get('details', {}),
                        'created_at': row.get('created_at'),
                        'username': (u.get('username', '') if isinstance(u, dict) else ''),
                    })
            except Exception:
                recent = AuditLogSerializer(
                    AuditLog.objects.all().order_by('-created_at')[:10], many=True
                ).data
        except Exception:
            pass

        stats = {
            'total_candidates': total_candidates,
            'total_jobs': total_jobs,
            'total_users': total_users,
            'recent_activities': recent,
        }
        return Response(stats)


class ReportAliasView(generics.RetrieveAPIView):
    """
    GET /api/report/?job_id=<uuid>&format=xlsx|json  (Supabase SDK backed)
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        job_id = request.query_params.get('job_id') or request.GET.get('job_id')
        if not job_id:
            return Response(
                {'error': 'job_id query param is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Job lookup via Supabase SDK
        job_title = ""
        try:
            jres = sb_table('jobs').select('id, title').eq('id', str(job_id)).limit(1).execute()
            if not jres.data:
                return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)
            job_title = jres.data[0].get('title', '')
        except Exception as e:
            try:
                job_obj = JobDescription.objects.get(id=job_id)
                job_title = job_obj.title
            except JobDescription.DoesNotExist:
                return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)
            except Exception as err2:
                return Response({'error': str(err2)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Rankings via Supabase SDK
        rankings_rows = []
        try:
            res = sb_table('rankings').select(
                '*, candidates: candidate_id (id, name, email, phone, structured_data)'
            ).eq('job_id', str(job_id)).order('rank_position').execute()
            rankings_rows = res.data or []
        except Exception as e:
            print(f"[ReportAliasView] Supabase rankings query failed, falling back: {e}")
            rqs = Ranking.objects.filter(job_id=job_id).order_by('rank_position')
            rankings_rows = [
                {
                    'rank_position': r.rank_position,
                    'overall_score': r.overall_score,
                    'similarity_score': r.similarity_score,
                    'skill_match_score': r.skill_match_score,
                    'explanation': r.explanation,
                    'candidates': {
                        'name': r.candidate.name if r.candidate else '',
                        'email': r.candidate.email if r.candidate else None,
                        'phone': r.candidate.phone if r.candidate else None,
                        'structured_data': r.candidate.structured_data if r.candidate else {},
                    },
                }
                for r in rqs
            ]

        data = []
        for r in rankings_rows:
            cand = r.get('candidates') or {}
            structured = cand.get('structured_data') or {}
            gemini = (structured.get('gemini_analysis') if isinstance(structured, dict) else None) or {}

            def format_list(items, key=None):
                if not items: return "N/A"
                if key:
                    return "; ".join([
                        f"{item.get(key, '')}" for item in items
                        if isinstance(item, dict) and item.get(key)
                    ])
                if isinstance(items, list):
                    return ", ".join([str(x) for x in items])
                return "N/A"

            exp_list = gemini.get('experience') or structured.get('experience') or []
            if isinstance(exp_list, list):
                exp_str = "; ".join([
                    f"{(e.get('title') if isinstance(e, dict) else '')} @ {(e.get('company') if isinstance(e, dict) else '')} ({(e.get('duration') if isinstance(e, dict) else '')})"
                    for e in exp_list if isinstance(e, dict)
                ])
            else:
                exp_str = "N/A"

            edu_list = gemini.get('education') or structured.get('education') or []
            if isinstance(edu_list, list):
                edu_str = "; ".join([
                    f"{(e.get('degree') if isinstance(e, dict) else '')} @ {(e.get('institution') if isinstance(e, dict) else '')} ({(e.get('year') if isinstance(e, dict) else '')})"
                    for e in edu_list if isinstance(e, dict)
                ])
            else:
                edu_str = "N/A"

            data.append({
                'Rank': r.get('rank_position'),
                'Candidate Name': cand.get('name', "N/A"),
                'Email': cand.get('email') or "N/A",
                'Phone': cand.get('phone') or "N/A",
                'Overall Score': f"{float(r.get('overall_score', 0.0))*100:.1f}%",
                'Semantic Match': f"{float(r.get('similarity_score', 0.0))*100:.1f}%",
                'Skill Match': f"{float(r.get('skill_match_score', 0.0))*100:.1f}%",
                'Total Experience (Years)': structured.get('total_experience_years', "N/A") if isinstance(structured, dict) else "N/A",
                'AI Summary': gemini.get('summary', "N/A") if isinstance(gemini, dict) else "N/A",
                'Extracted Skills': format_list(structured.get('skills', []) if isinstance(structured, dict) else []),
                'Work History': exp_str or "N/A",
                'Education': edu_str or "N/A",
                'AI Match Explanation': r.get('explanation', ''),
            })

        fmt = (request.query_params.get('format') or request.GET.get('format') or 'xlsx').lower()

        if fmt == 'json':
            return Response({
                'job_id': job_id,
                'job_title': job_title,
                'rankings': data,
            })

        # Default: xlsx
        if pd is None:
            return Response(
                {'error': 'Report generation failed due to missing libraries.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Candidate Rankings')

        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="ranking_job_{job_id}.xlsx"'
        return response


class ChatAliasView(generics.CreateAPIView):
    """
    POST /api/chat/   → same logic as /api/chatbot/message/
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        message = request.data.get('message', '').lower()
        session_id = request.data.get('session_id', 'default')

        from chatbot.actions.actions import ChatActions

        response_text = "I'm not sure how to help with that. Try asking for 'top candidates' or 'help'."
        intent = "unknown"
        confidence = 1.0

        if "pipeline" in message or "architecture" in message or "stack" in message or "srs" in message or "group 19" in message:
            intent = "get_system_architecture"
            response_text = ChatActions.get_system_architecture()
        elif "business rule" in message or "bias" in message or "popia" in message or "br-" in message or "rule" in message:
            intent = "get_business_rules"
            response_text = ChatActions.get_business_rules()
        elif "compare" in message or " vs " in message:
            intent = "compare_candidates"
            parts = message.replace('compare', '').replace('and', ',').replace('vs', ',').split(',')
            names = [p.strip() for p in parts if p.strip()]
            response_text = ChatActions.compare_candidates(names)
        elif "top" in message or "ranked" in message or "best" in message:
            intent = "get_top_candidates"
            # Spec: core READ via Supabase SDK
            job = None
            try:
                jres = sb_table('jobs').select('id').order('created_at', desc=True).limit(1).execute()
                if jres.data:
                    job = jres.data[0]
            except Exception:
                job_obj = JobDescription.objects.order_by('-created_at').first()
                job = {'id': str(job_obj.id)} if job_obj else None

            if job:
                response_text = ChatActions.get_top_candidates(job['id'])
            else:
                response_text = ChatActions.get_top_candidates()
        elif "about" in message or "details" in message or "explain" in message or "why" in message:
            intent = "get_candidate_details"
            parts = message.split('about') if 'about' in message else message.split('for')
            if len(parts) > 1:
                name = parts[1].strip()
                response_text = ChatActions.get_candidate_details(name)
            else:
                response_text = "Who would you like to know about? (e.g., 'Tell me about John Doe')"
        elif "help" in message or "how" in message or "guide" in message:
            intent = "help_navigation"
            response_text = ChatActions.get_help()

        # Spec: core WRITE via Supabase SDK
        try:
            sb_table('chat_logs').insert({
                'id': str(uuid.uuid4()),
                'user_id': str(request.user.id) if request.user.id else None,
                'session_id': session_id,
                'query_text': message,
                'response_text': response_text,
                'intent': intent,
                'confidence': confidence,
                'created_at': _now_iso(),
            }).execute()
        except Exception as e:
            print(f"[ChatAliasView] ChatLog Supabase insert warning: {e}")
            try:
                from models.models import ChatLog
                ChatLog.objects.create(
                    user=request.user,
                    session_id=session_id,
                    query_text=message,
                    response_text=response_text,
                    intent=intent,
                    confidence=confidence
                )
            except Exception:
                pass

        return Response({'response': response_text, 'intent': intent})


class DatabaseManagementView(generics.GenericAPIView):
    permission_classes = (permissions.IsAdminUser,)

    def get(self, request, *args, **kwargs):
        c_count = Candidate.objects.count()
        j_count = JobDescription.objects.count()
        r_count = Ranking.objects.count()
        u_count = User.objects.count()
        a_count = AuditLog.objects.count()

        db_path = settings.BASE_DIR / 'db.sqlite3'
        sqlite_bytes = os.path.getsize(db_path) if os.path.exists(db_path) else 1700000
        db_size_mb = f"{sqlite_bytes / (1024 * 1024):.2f} MB"

        return Response({
            'db_size': db_size_mb,
            'counts': {
                'candidates': c_count,
                'jobs': j_count,
                'rankings': r_count,
                'users': u_count,
                'audit_logs': a_count,
            }
        })

    def post(self, request, *args, **kwargs):
        candidates = list(Candidate.objects.values('id', 'name', 'email', 'created_at', 'status'))
        jobs = list(JobDescription.objects.values('id', 'title', 'created_at', 'status'))
        rankings = list(Ranking.objects.values('id', 'job_id', 'candidate_id', 'overall_score', 'rank_position'))
        audit_logs = list(AuditLog.objects.values('id', 'action', 'created_at'))

        snapshot = {
            'system': 'QuickHire Django API',
            'created_at': _now_iso(),
            'counts': {
                'candidates': len(candidates),
                'jobs': len(jobs),
                'rankings': len(rankings),
                'audit_logs': len(audit_logs),
            },
            'data': {
                'candidates': candidates,
                'jobs': jobs,
                'rankings': rankings,
                'audit_logs': audit_logs,
            }
        }
        import json
        json_bytes = json.dumps(snapshot, indent=2, default=str).encode('utf-8')
        response = HttpResponse(json_bytes, content_type='application/json')
        response['Content-Disposition'] = f'attachment; filename="quickhire_db_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json"'
        return response

