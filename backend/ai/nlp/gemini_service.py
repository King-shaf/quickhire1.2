import os
import google.generativeai as genai
import json
from django.conf import settings

class GeminiCVAnalyzer:
    def __init__(self):
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def analyze_document(self, file_path, mime_type):
        """
        Analyze a document directly using Gemini API (multimodal).
        Supports PDF, JPG, PNG, etc.
        """
        prompt = """
        ACT AS AN EXPERT RECRUITER SPECIALIZING IN SOUTH AFRICAN & INTERNATIONAL CV ANALYSIS. Analyze the attached CV/Resume document and extract EVERYTHING with strict accuracy.
        Your goal is to populate a complete, highly detailed candidate profile.
        
        Return the result in a STRICT valid JSON format with the following keys:
        - first_name: Candidate's first name(s) (string)
        - last_name: Candidate's surname / last name (string)
        - candidate_name: Full name of the candidate (string)
        - email: Professional email address (string)
        - phone: Contact phone number, paying attention to South African phone formats (+27..., 07..., 08..., 06..., 011...) (string)
        - location: Candidate's address, city, or location (string, e.g. "Johannesburg, South Africa")
        - id_number: Candidate's South African ID number (13 digits) or passport number if specified, else null (string)
        - total_experience_years: Total years of professional experience (number, e.g. 5.5)
        - summary: A detailed professional summary of the candidate's background (string)
        - school_info: An object with:
            - high_school: Object with 'school_name' (High School / Secondary School), 'qualification' (e.g. "Matric / Grade 12 / NSC"), 'year_completed' (string/number), 'subjects' (list of strings)
            - tertiary_education: List of objects, each with 'degree' (e.g., "BSc Computer Science"), 'institution' (e.g., "University of the Witwatersrand"), 'year' (e.g., "2021"), 'status' (Completed / In Progress)
        - education: List of objects, each with 'degree', 'institution', and 'year'
        - experience: List of detailed objects, each with:
            - 'title': Job title or position
            - 'company': Company or employer name
            - 'type_of_experience': Type of employment (e.g., "Full-time", "Contract", "Internship", "Permanent")
            - 'start_date': Work experience start date (e.g., "Jan 2020" or "01/2020")
            - 'end_date': Work experience end date (e.g., "Dec 2023" or "Present")
            - 'duration_years': Duration in years (number)
            - 'description': Detailed description of responsibilities and achievements
        - references: List of objects for referees, each with 'name', 'title', 'company', 'phone', 'email'
        - credentials: Object with:
            - 'drivers_license': Driver's license code (e.g., "Code 8 / EB", "Code 10", "None")
            - 'professional_registrations': List of professional body memberships (e.g., "ECSA", "SAICA", "SACE", "HPCSA")
            - 'certifications': List of certificates, courses, or accreditations
        - skills: Comprehensive list of technical, soft, and industry-specific skills (list of strings)
        - raw_text: THE ENTIRE TEXT extracted from the document, preserving layout/order as much as possible (string)
        
        CRITICAL: If a piece of information is present in the document, you MUST extract it accurately.
        If it's truly missing, use null for strings and numbers, and an empty list [] or empty object {} for arrays/objects.
        DO NOT explain or add text outside the JSON.
        """
        
        try:
            print(f"Gemini: Uploading file {file_path} (mime: {mime_type})...")
            uploaded_file = genai.upload_file(path=file_path, mime_type=mime_type)
            
            print(f"Gemini: Generating content for {uploaded_file.name}...")
            response = self.model.generate_content([prompt, uploaded_file])
            
            # Clean response text to ensure it's valid JSON
            content = response.text.strip()
            print(f"Gemini: Received response (length: {len(content)})")
            
            if content.startswith('```json'):
                content = content[7:-3].strip()
            elif content.startswith('```'):
                content = content[3:-3].strip()
            
            data = json.loads(content)
            
            # Ensure raw_text is populated even if Gemini was lazy
            if not data.get('raw_text'):
                data['raw_text'] = response.text # Fallback
            
            # Delete the file from Gemini's storage after processing
            try:
                uploaded_file.delete()
                print(f"Gemini: Deleted temp file {uploaded_file.name}")
            except Exception as e:
                print(f"Gemini: Warning: Failed to delete temp file: {e}")
                
            return data
        except Exception as e:
            print(f"Gemini: CRITICAL ERROR in multimodal analysis: {e}")
            import traceback
            traceback.print_exc()
            return None
