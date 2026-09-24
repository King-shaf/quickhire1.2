from rest_framework import serializers
from models.models import Candidate, Skill, JobDescription, Ranking, AuditLog, JobCandidateAssignment

class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = '__all__'

class CandidateSerializer(serializers.ModelSerializer):
    skills = SkillSerializer(many=True, read_only=True)
    class Meta:
        model = Candidate
        exclude = ('embedding',)

class JobDescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobDescription
        exclude = ('embedding',)
        read_only_fields = ('created_by',)

class RankingSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(source='candidate.name', read_only=True)
    candidate_email = serializers.CharField(source='candidate.email', read_only=True)
    candidate_summary = serializers.SerializerMethodField()

    class Meta:
        model = Ranking
        fields = '__all__'

    def get_candidate_summary(self, obj):
        try:
            return obj.candidate.structured_data.get('gemini_analysis', {}).get('summary', '')
        except:
            return ''

class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = AuditLog
        fields = '__all__'

class JobCandidateAssignmentSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(source='candidate.name', read_only=True)
    candidate_email = serializers.CharField(source='candidate.email', read_only=True)
    job_title = serializers.CharField(source='job.title', read_only=True)
    job_department = serializers.CharField(source='job.department', read_only=True)

    class Meta:
        model = JobCandidateAssignment
        fields = '__all__'

