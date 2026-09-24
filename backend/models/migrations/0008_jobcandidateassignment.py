# Generated for JobCandidateAssignment

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('models', '0007_candidate_candidate_code_candidate_first_name_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='JobCandidateAssignment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('assigned', 'Assigned'), ('under_review', 'Under Review'), ('shortlisted', 'Shortlisted'), ('interview_scheduled', 'Interview Scheduled'), ('offer_extended', 'Offer Extended'), ('hired', 'Hired'), ('rejected', 'Rejected')], default='assigned', max_length=50)),
                ('notes', models.TextField(blank=True, null=True)),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='candidate_assignments', to=settings.AUTH_USER_MODEL)),
                ('candidate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='job_assignments', to='models.candidate')),
                ('company', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='candidate_assignments', to='models.company')),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assignments', to='models.jobdescription')),
            ],
            options={
                'db_table': 'job_candidate_assignments',
            },
        ),
        migrations.AddIndex(
            model_name='jobcandidateassignment',
            index=models.Index(fields=['job', 'status'], name='job_cand_job_status_idx'),
        ),
        migrations.AddIndex(
            model_name='jobcandidateassignment',
            index=models.Index(fields=['candidate'], name='job_cand_cand_idx'),
        ),
        migrations.AddIndex(
            model_name='jobcandidateassignment',
            index=models.Index(fields=['assigned_at'], name='job_cand_assigned_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='jobcandidateassignment',
            unique_together={('job', 'candidate')},
        ),
    ]
