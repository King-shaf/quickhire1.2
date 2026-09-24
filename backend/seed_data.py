import os
import django
import sys

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quickhire.settings')
# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
django.setup()

from models.models import Skill

def seed_skills():
    skills = [
        ('Python', 'Programming'), ('Java', 'Programming'), ('JavaScript', 'Programming'), 
        ('C++', 'Programming'), ('Go', 'Programming'), ('Rust', 'Programming'),
        ('Django', 'Framework'), ('Flask', 'Framework'), ('React', 'Framework'), 
        ('Angular', 'Framework'), ('Vue.js', 'Framework'), ('Spring Boot', 'Framework'),
        ('PostgreSQL', 'Database'), ('MySQL', 'Database'), ('MongoDB', 'Database'), 
        ('Redis', 'Database'), ('SQLite', 'Database'), ('Cassandra', 'Database'),
        ('Docker', 'DevOps'), ('Kubernetes', 'DevOps'), ('Jenkins', 'DevOps'), 
        ('AWS', 'Cloud'), ('Azure', 'Cloud'), ('Google Cloud', 'Cloud'),
        ('Machine Learning', 'AI'), ('Deep Learning', 'AI'), ('NLP', 'AI'), 
        ('Computer Vision', 'AI'), ('PyTorch', 'AI'), ('TensorFlow', 'AI'),
        ('Project Management', 'Soft Skill'), ('Leadership', 'Soft Skill'), 
        ('Communication', 'Soft Skill'), ('Teamwork', 'Soft Skill'),
        ('Agile', 'Methodology'), ('Scrum', 'Methodology'), ('Git', 'Tools'),
        ('REST API', 'Backend'), ('GraphQL', 'Backend'), ('Microservices', 'Architecture'),
        ('Unit Testing', 'Testing'), ('Selenium', 'Testing'), ('Jira', 'Tools'),
        ('Confluence', 'Tools'), ('Linux', 'OS'), ('Windows', 'OS'), ('MacOS', 'OS'),
        ('HTML5', 'Frontend'), ('CSS3', 'Frontend'), ('TypeScript', 'Programming')
    ]
    
    for name, category in skills:
        Skill.objects.get_or_create(name=name, category=category)
    print(f"Successfully seeded {len(skills)} skills.")

if __name__ == "__main__":
    seed_skills()
