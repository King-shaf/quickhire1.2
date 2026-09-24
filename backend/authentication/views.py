from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import RegisterSerializer, UserSerializer, CustomTokenObtainPairSerializer
from models.models import User, AuditLog

MAX_FAILED_ATTEMPTS = 5

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Log registration
            AuditLog.objects.create(
                user=user,
                action='USER_REGISTERED',
                resource_type='USER',
                resource_id=str(user.id),
                details={'username': user.username},
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        user = User.objects.filter(username=username).first()
        if user and user.is_active is False:
            return Response(
                {'detail': 'Your account has been deactivated. Please contact an administrator.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if user and user.account_locked:
            return Response(
                {'detail': 'Account is locked. Contact an administrator.'},
                status=status.HTTP_403_FORBIDDEN
            )

        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            if user:
                user.failed_attempts = 0
                user.save(update_fields=['failed_attempts'])
                # Log login
                AuditLog.objects.create(
                    user=user,
                    action='USER_LOGGED_IN',
                    resource_type='USER',
                    resource_id=str(user.id),
                    ip_address=request.META.get('REMOTE_ADDR')
                )
        elif user:
            user.failed_attempts += 1
            if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
                user.account_locked = True
            user.save(update_fields=['failed_attempts', 'account_locked'])
        return response

class UserProfileView(generics.RetrieveAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class LogoutView(generics.GenericAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Refresh token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response({'detail': 'Invalid or expired refresh token.'}, status=status.HTTP_400_BAD_REQUEST)

        AuditLog.objects.create(
            user=request.user,
            action='USER_LOGGED_OUT',
            resource_type='USER',
            resource_id=str(request.user.id),
            ip_address=request.META.get('REMOTE_ADDR')
        )
        return Response({'detail': 'Logout successful.'}, status=status.HTTP_200_OK)
