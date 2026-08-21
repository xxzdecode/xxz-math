const clean = value => typeof value === 'string' ? value.trim() : '';

export function knowledgeContent(point) {
  const notes = point?.notes || {};
  return {
    idea: clean(notes.idea),
    rules: Array.isArray(notes.rules) ? notes.rules.map(clean).filter(Boolean) : [],
    example: clean(notes.example),
    caution: clean(notes.caution)
  };
}
