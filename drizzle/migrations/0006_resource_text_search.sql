-- Full-text search index over extracted text in resource metadata
CREATE INDEX IF NOT EXISTS idx_resource_extracted_text_search
  ON resource USING GIN (to_tsvector('english', coalesce(metadata->>'extractedText', '')));

-- Composite indexes for filtered resource queries
CREATE INDEX IF NOT EXISTS idx_resource_topic_active
  ON resource (topic_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_resource_subject_active
  ON resource (subject_id, is_active) WHERE is_active = true;
