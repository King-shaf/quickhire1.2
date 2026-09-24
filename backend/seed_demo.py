import os
import django
import sys

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quickhire.settings')
sys.path.append(os.path.join(os.getcwd(), 'backend'))
django.setup()

from models.models import User

def create_demo_users():
    demo_users = [
        {
            'username': 'admin_demo',
            'email': 'admin@quickhire.ai',
            'password': 'admin123',
            'role': 'ADMIN',
            'is_staff': True,
            'is_superuser': True
        },
        {
            'username': 'manager_demo',
            'email': 'manager@quickhire.ai',
            'password': 'manager123',
            'role': 'MANAGER',
            'is_staff': False,
            'is_superuser': False
        },
        {
            'username': 'user_demo',
            'email': 'user@quickhire.ai',
            'password': 'user123',
            'role': 'USER',
            'is_staff': False,
            'is_superuser': False
        }
    ]

    for user_data in demo_users:
        username = user_data.pop('username')
        password = user_data.pop('password')
        
        user, created = User.objects.get_or_create(
            username=username,
            defaults=user_data
        )
        
        if created:
            user.set_password(password)
            user.save()
            print(f"Created demo user: {username} ({user.role})")
        else:
            # Update existing demo users to ensure role is correct
            user.role = user_data['role']
            user.set_password(password)
            user.save()
            print(f"Updated existing demo user: {username}")

    print("\nDemo seeding complete!")
    print("-" * 30)
    print("Admin:   admin_demo   / admin123")
    print("Manager: manager_demo / manager123")
    print("User:    user_demo    / user123")
    print("-" * 30)

if __name__ == "__main__":
    create_demo_users()
