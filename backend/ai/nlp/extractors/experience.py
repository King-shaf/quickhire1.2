import re
from datetime import datetime

class ExperienceExtractor:
    def __init__(self):
        self.job_titles = [
            'Developer', 'Engineer', 'Manager', 'Analyst', 'Consultant', 'Lead', 'Architect',
            'Administrator', 'Specialist', 'Director', 'Officer', 'Executive', 'Technician',
            'Coordinator', 'Supervisor', 'Advisor', 'Intern', 'Accountant', 'Clerk', 'Agent'
        ]
        self.emp_types = ['Full-time', 'Contract', 'Permanent', 'Internship', 'Part-time', 'Freelance']

    def parse_date_string(self, d_str):
        if not d_str:
            return None
        clean = d_str.strip()
        if re.search(r'present|current|now|till date', clean, re.IGNORECASE):
            return 'Present'
        m = re.search(r'([A-Za-z]{3,9}\s*\d{4}|\d{1,2}/\d{4}|\d{4})', clean)
        return m.group(0) if m else clean

    def extract_experience(self, text):
        """
        Extract detailed work experience (title, company, type, start_date, end_date, duration_years).
        """
        experience = []
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        # Regex for date ranges: e.g. "Jan 2020 - Dec 2023", "2018 - Present", "03/2019 - 05/2022"
        date_range_pattern = re.compile(
            r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|[0-9]{1,2}/)?[A-Za-z]*\s*\d{4})\s*(?:-|–|to)\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|[0-9]{1,2}/)?[A-Za-z]*\s*\d{4}|Present|Current)',
            re.IGNORECASE
        )

        for i, line in enumerate(lines):
            # Search for date ranges in line
            date_match = date_range_pattern.search(line)
            is_title = any(t.lower() in line.lower() for t in self.job_titles)
            
            if date_match or is_title:
                start_date = date_match.group(1).strip() if date_match else None
                end_date = date_match.group(2).strip() if date_match else None
                
                # Infer job title & company
                title = line
                company = 'Company Not Specified'
                emp_type = 'Full-time'

                for t in self.emp_types:
                    if t.lower() in line.lower():
                        emp_type = t
                        break

                if ',' in line:
                    parts = line.split(',')
                    title = parts[0].strip()
                    company = parts[1].strip()
                elif ' at ' in line:
                    parts = line.split(' at ')
                    title = parts[0].strip()
                    company = parts[1].strip()
                elif i + 1 < len(lines) and not date_range_pattern.search(lines[i+1]):
                    company = lines[i+1].strip()

                # Clean title if date is inside
                if date_match:
                    title = date_range_pattern.sub('', title).strip(' ,-|–')

                duration_years = self._estimate_duration(start_date, end_date)

                experience.append({
                    'title': title or 'Position Held',
                    'company': company,
                    'type_of_experience': emp_type,
                    'start_date': start_date,
                    'end_date': end_date,
                    'duration_years': duration_years,
                    'description': line
                })

        return experience

    def _estimate_duration(self, start_str, end_str):
        if not start_str:
            return 1.0
        try:
            start_year = int(re.search(r'\b(19|20)\d{2}\b', start_str).group(0))
            if end_str and ('present' in end_str.lower() or 'current' in end_str.lower()):
                end_year = datetime.now().year
            elif end_str and re.search(r'\b(19|20)\d{2}\b', end_str):
                end_year = int(re.search(r'\b(19|20)\d{2}\b', end_str).group(0))
            else:
                end_year = start_year + 1
            return max(0.5, float(end_year - start_year))
        except Exception:
            return 1.0

    def calculate_total_experience(self, experience_list):
        if not experience_list:
            return 0.0
        total = sum(exp.get('duration_years', 1.0) for exp in experience_list)
        return round(total, 1)

