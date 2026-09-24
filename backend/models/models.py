from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import uuid

try:
    from pgvector.django import VectorField
    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False
    VectorField = None


class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    company_code = models.CharField(max_length=50, unique=True, blank=True, null=True)
    size = models.CharField(max_length=50, blank=True, null=True)
    industry = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'companies'

    def __str__(self):
        return self.name


class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Administrator'),
        ('company', 'Company Admin'),
        ('recruiter', 'Recruiter'),
        ('viewer', 'Viewer'),
        ('candidate', 'Candidate'),
        ('USER', 'User'),
        ('MANAGER', 'Manager'),
        ('ADMIN', 'Administrator (Legacy)'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='recruiter')
    failed_attempts = models.IntegerField(default=0)
    account_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    company = models.ForeignKey(Company, on_delete=models.SET_NULL, related_name='users', blank=True, null=True)
    company_name = models.CharField(max_length=255, blank=True, null=True)
    id_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    employee_id = models.CharField(max_length=50, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    last_login = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'users'

class Skill(models.Model):
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=50, blank=True, null=True)
    aliases = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'skills'

    def __str__(self):
        return self.name

class Candidate(models.Model):
    STATUS_CHOICES = (
        ('processing', 'Processing'),
        ('complete', 'Complete'),
        ('failed', 'Failed'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='candidates', blank=True, null=True)
    user_id_fk = models.UUIDField(blank=True, null=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='candidates', blank=True, null=True)
    company_id_fk = models.UUIDField(blank=True, null=True)
    batch_id = models.UUIDField(blank=True, null=True)
    name = models.CharField(max_length=255)
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    candidate_code = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    source_file = models.FileField(upload_to='cvs/', blank=True, null=True)
    raw_text = models.TextField(blank=True, null=True)
    extracted_skills = models.JSONField(default=list, blank=True)
    extracted_experience = models.JSONField(default=dict, blank=True)
    structured_data = models.JSONField(default=dict, blank=True)
    if HAS_PGVECTOR and VectorField:
        embedding_vector = VectorField(dimensions=384, null=True, blank=True)
        embedding = models.JSONField(null=True, blank=True)
    else:
        embedding = models.JSONField(null=True, blank=True)
    ocr_confidence = models.FloatField(default=0.0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='processing')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    skills = models.ManyToManyField(Skill, related_name='candidates', blank=True)

    class Meta:
        db_table = 'candidates'
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['created_at']),
            models.Index(fields=['status']),
        ]


class JobDescription(models.Model):
    STATUS_CHOICES = (
        ('queued', 'Queued'),
        ('processing', 'Processing'),
        ('complete', 'Complete'),
        ('failed', 'Failed'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='jobs', blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_jobs', blank=True, null=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='jobs', blank=True, null=True)
    company_id_fk = models.UUIDField(blank=True, null=True)
    title = models.CharField(max_length=255)
    description_text = models.TextField()
    if HAS_PGVECTOR and VectorField:
        embedding_vector = VectorField(dimensions=384, null=True, blank=True)
        embedding = models.JSONField(null=True, blank=True)
    else:
        embedding = models.JSONField(null=True, blank=True)
    required_skills = models.JSONField(default=list, blank=True)
    preferred_skills = models.JSONField(default=list, blank=True)
    industry = models.CharField(max_length=100, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'jobs'
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['title']),
            models.Index(fields=['status']),
        ]


class Ranking(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(JobDescription, on_delete=models.CASCADE, related_name='rankings')
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='rankings')
    match_score = models.FloatField(default=0.0)
    similarity_score = models.FloatField(default=0.0)
    skill_match_score = models.FloatField(default=0.0)
    overall_score = models.FloatField(default=0.0)
    rank_position = models.IntegerField()
    breakdown = models.JSONField(default=dict, blank=True)
    matched_requirements = models.JSONField(default=list, blank=True)
    explanation = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rankings_created', blank=True, null=True)

    class Meta:
        db_table = 'rankings'
        unique_together = ('job', 'candidate')
        indexes = [
            models.Index(fields=['job', 'rank_position']),
            models.Index(fields=['job', 'overall_score']),
        ]

class ChatLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    session_id = models.CharField(max_length=255)
    query_text = models.TextField()
    response_text = models.TextField()
    intent = models.CharField(max_length=100, blank=True, null=True)
    confidence = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_logs'
        indexes = [
            models.Index(fields=['session_id', 'created_at']),
        ]

class JobCandidateAssignment(models.Model):
    STATUS_CHOICES = (
        ('assigned', 'Assigned'),
        ('under_review', 'Under Review'),
        ('shortlisted', 'Shortlisted'),
        ('interview_scheduled', 'Interview Scheduled'),
        ('offer_extended', 'Offer Extended'),
        ('hired', 'Hired'),
        ('rejected', 'Rejected'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(JobDescription, on_delete=models.CASCADE, related_name='assignments')
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='job_assignments')
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='candidate_assignments')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, null=True, blank=True, related_name='candidate_assignments')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='assigned')
    notes = models.TextField(blank=True, null=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'job_candidate_assignments'
        unique_together = ('job', 'candidate')
        indexes = [
            models.Index(fields=['job', 'status']),
            models.Index(fields=['candidate']),
            models.Index(fields=['assigned_at']),
        ]

    def __str__(self):
        return f"{self.candidate.name} -> {self.job.title} ({self.status})"


class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    action = models.CharField(max_length=255)
    resource_type = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=100, blank=True, null=True)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        indexes = [
            models.Index(fields=['action', 'created_at']),
        ]


