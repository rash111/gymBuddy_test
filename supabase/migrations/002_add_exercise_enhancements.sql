-- ============================================================
-- Add Exercise Enhancements (YouTube Shorts & Posture Guides)
-- ============================================================

-- Add new columns to exercises table
ALTER TABLE public.exercises
ADD COLUMN IF NOT EXISTS shorts_url TEXT,
ADD COLUMN IF NOT EXISTS posture_guide JSONB;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS exercises_shorts_url_idx ON public.exercises(shorts_url) WHERE shorts_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS exercises_posture_guide_idx ON public.exercises(posture_guide) WHERE posture_guide IS NOT NULL;

-- Update RLS policies for exercises if needed (exercises is public read)
-- No changes needed - exercises table remains publicly readable
