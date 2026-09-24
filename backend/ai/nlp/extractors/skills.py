import spacy
from spacy.pipeline import EntityRuler

class SkillExtractor:
    def __init__(self, nlp_model, skill_list=None):
        self.nlp = nlp_model
        if skill_list:
            if "entity_ruler" not in self.nlp.pipe_names:
                ruler = self.nlp.add_pipe("entity_ruler", before="ner")
            else:
                ruler = self.nlp.get_pipe("entity_ruler")
            
            patterns = [{"label": "SKILL", "pattern": [{"LOWER": skill.lower()}]} for skill in skill_list]
            ruler.add_patterns(patterns)

    def extract_skills(self, doc):
        """
        Extract skills from a spaCy Doc.
        """
        skills = set()
        for ent in doc.ents:
            if ent.label_ == "SKILL":
                skills.add(ent.text)
        return list(skills)
