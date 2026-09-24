import re

class EducationExtractor:
    def __init__(self):
        self.degree_keywords = [
            'BSc', 'MSc', 'PhD', 'Bachelor', 'Master', 'Doctor', 'B.A.', 'B.S.', 'M.A.', 'M.S.',
            'Diploma', 'National Diploma', 'Certificate', 'Honours', 'BTech', 'MTech', 'BCom', 'LLB'
        ]
        self.high_school_keywords = [
            'Matric', 'Grade 12', 'National Senior Certificate', 'NSC', 'High School', 'Secondary School', 'Senior Certificate'
        ]

    def extract_education(self, text):
        """
        Extract tertiary education & qualifications.
        """
        education = []
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        for line in lines:
            if any(degree.lower() in line.lower() for degree in self.degree_keywords):
                year = re.findall(r'\b(19|20)\d{2}\b', line)
                matched_degree = next((d for d in self.degree_keywords if d.lower() in line.lower()), 'Qualification')
                education.append({
                    'degree': matched_degree,
                    'institution': line.split(',')[0].strip(),
                    'year': year[0] if year else None
                })
        return education

    def extract_school_info(self, text):
        """
        Extract High School / Matric details.
        """
        high_school_info = {
            'school_name': None,
            'qualification': None,
            'year_completed': None,
            'subjects': []
        }
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        for line in lines:
            if any(kw.lower() in line.lower() for kw in self.high_school_keywords):
                year = re.findall(r'\b(19|20)\d{2}\b', line)
                high_school_info['qualification'] = 'Matric / Grade 12 (NSC)'
                high_school_info['school_name'] = line.split(',')[0].strip()
                high_school_info['year_completed'] = year[0] if year else None
                break
        return high_school_info

