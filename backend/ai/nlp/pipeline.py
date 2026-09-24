import spacy
from spacy.matcher import Matcher
import re
from .extractors.skills import SkillExtractor
from .extractors.education import EducationExtractor
from .extractors.experience import ExperienceExtractor

class NLPPipeline:
    def __init__(self, skill_list=None):
        """
        Initialize the NLP pipeline with spaCy and modular extractors.
        """
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"])
            self.nlp = spacy.load("en_core_web_sm")

        self.skill_extractor = SkillExtractor(self.nlp, skill_list)
        self.education_extractor = EducationExtractor()
        self.experience_extractor = ExperienceExtractor()
        
        self.email_regex = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
        # SA Phone formats: +27 72 123 4567, 072 123 4567, 011 234 5678, 0821234567, etc.
        self.phone_regex = re.compile(r'(?:\+27|0)\s*(?:[1-8][0-9])\s*[\-\.]?\s*[0-9]{3}\s*[\-\.]?\s*[0-9]{4}|\d{3}[-\.\s]??\d{3}[-\.\s]??\d{4}|\(\d{3}\)\s*\d{3}[-\.\s]??\d{4}')
        # SA ID number format: 13 digits (YYMMDD SSSS C A Z)
        self.sa_id_regex = re.compile(r'\b\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{7}\b')

    def extract_contact_info(self, text):
        email = self.email_regex.findall(text)
        phone = self.phone_regex.findall(text)
        sa_id = self.sa_id_regex.findall(text)
        return (
            email[0] if email else None,
            phone[0] if phone else None,
            sa_id[0] if sa_id else None
        )

    def extract_name(self, text):
        doc = self.nlp(text[:600])
        for ent in doc.ents:
            if ent.label_ == "PERSON" and len(ent.text.strip().split()) >= 2:
                parts = ent.text.strip().split()
                return {
                    'full_name': ent.text.strip(),
                    'first_name': parts[0],
                    'last_name': " ".join(parts[1:])
                }
        # Fallback to line 1
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        if lines:
            parts = lines[0].split()
            return {
                'full_name': lines[0],
                'first_name': parts[0] if parts else lines[0],
                'last_name': " ".join(parts[1:]) if len(parts) > 1 else ''
            }
        return {'full_name': 'Candidate', 'first_name': 'Candidate', 'last_name': ''}

    def extract_references(self, text):
        refs = []
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        in_ref_section = False
        for line in lines:
            if 'reference' in line.lower() or 'referee' in line.lower():
                in_ref_section = True
                continue
            if in_ref_section:
                if any(sec in line.lower() for sec in ['education', 'experience', 'skills', 'hobbies']):
                    break
                if '@' in line or self.phone_regex.search(line):
                    refs.append({
                        'name': line.split(',')[0].strip(),
                        'title': 'Referee',
                        'company': 'Reference Provider',
                        'contact': line
                    })
        return refs

    def extract_credentials(self, text):
        creds = {
            'drivers_license': None,
            'professional_registrations': [],
            'certifications': []
        }
        if re.search(r'code\s*(8|eb|10|14|08)', text, re.IGNORECASE):
            creds['drivers_license'] = 'Code 8 / EB Driver\'s License'
        elif re.search(r'driver[\'\s]*s\s*licen[sc]e', text, re.IGNORECASE):
            creds['drivers_license'] = 'Valid Driver\'s License'

        bodies = ['ECSA', 'SAICA', 'SACE', 'HPCSA', 'PMI', 'AWS', 'CIMA', 'CCNA']
        for b in bodies:
            if b in text:
                creds['professional_registrations'].append(b)
        return creds

    def process_cv(self, text):
        doc = self.nlp(text)
        name_info = self.extract_name(text)
        email, phone, sa_id = self.extract_contact_info(text)
        
        skills = self.skill_extractor.extract_skills(doc)
        education = self.education_extractor.extract_education(text)
        high_school_info = self.education_extractor.extract_school_info(text)
        experience = self.experience_extractor.extract_experience(text)
        total_exp = self.experience_extractor.calculate_total_experience(experience)
        references = self.extract_references(text)
        credentials = self.extract_credentials(text)

        return {
            'name': name_info['full_name'],
            'first_name': name_info['first_name'],
            'last_name': name_info['last_name'],
            'email': email,
            'phone': phone,
            'id_number': sa_id,
            'skills': skills,
            'education': education,
            'school_info': {
                'high_school': high_school_info,
                'tertiary_education': education
            },
            'experience': experience,
            'total_experience_years': total_exp,
            'references': references,
            'credentials': credentials
        }

