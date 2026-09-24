from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CandidateViewSet,
    SkillViewSet,
    JobDescriptionViewSet,
    JobCandidateAssignmentViewSet,
    RankingListView,
    RankingRefreshView,
    CVUploadView,
    TaskStatusView,
    DashboardStatsView,
    AuditLogListView,
    ExportRankingView,
    ChatbotMessageView,
    AdminUserListView,
    AdminUserUpdateView,
    # Alias views (exact matches per architecture diagrams)
    UnifiedUploadView,
    RankView,
    DashboardAliasView,
    ReportAliasView,
    ChatAliasView,
    DatabaseManagementView,
)

router = DefaultRouter()
router.register(r'candidates', CandidateViewSet)
router.register(r'skills', SkillViewSet)
router.register(r'jobs', JobDescriptionViewSet)
router.register(r'assignments', JobCandidateAssignmentViewSet)


urlpatterns = [
    path('', include(router.urls)),
    # -------- Existing routes (kept for backward compatibility) --------
    path('ranking/<int:job_id>/', RankingListView.as_view(), name='ranking_list'),
    path('ranking/<int:job_id>/refresh/', RankingRefreshView.as_view(), name='ranking_refresh'),
    path('candidate/<int:pk>/', CandidateViewSet.as_view({'get': 'retrieve'}), name='candidate_detail'),
    path('upload/cv/', CVUploadView.as_view(), name='cv_upload'),
    path('upload/job/', JobDescriptionViewSet.as_view({'post': 'create'}), name='job_upload'),
    path('task/<str:task_id>/', TaskStatusView.as_view(), name='task_status'),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('audit-logs/', AuditLogListView.as_view(), name='audit_log_list'),
    path('database/', DatabaseManagementView.as_view(), name='database_management'),
    path('report/<int:job_id>/', ExportRankingView.as_view(), name='export_report'),
    path('users/', AdminUserListView.as_view(), name='admin_users_list'),
    path('users/<str:pk>/', AdminUserUpdateView.as_view(), name='admin_users_update'),
    path('chatbot/message/', ChatbotMessageView.as_view(), name='chatbot_message'),

    # ==================================================================
    # ALIAS ROUTES — Exact 1:1 match per architecture diagrams
    # ==================================================================
    # POST /api/upload/   → UnifiedUploadView  (handles CV files OR Job Description)
    path('upload/', UnifiedUploadView.as_view(), name='unified_upload'),

    # GET  /api/rank/?job_id=<id>  → list rankings
    # POST /api/rank/               → trigger refresh
    path('rank/', RankView.as_view(), name='rank_view'),

    # GET /api/dashboard/  → stats
    path('dashboard/', DashboardAliasView.as_view(), name='dashboard_alias'),

    # GET /api/report/?job_id=<id>&format=xlsx|json
    path('report/', ReportAliasView.as_view(), name='report_alias'),

    # POST /api/chat/   → chatbot message
    path('chat/', ChatAliasView.as_view(), name='chat_alias'),
]
