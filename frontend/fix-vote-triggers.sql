-- FIX VOTE COUNTING TRIGGERS
-- This migration creates the missing update_post_vote_count function
-- and ensures the triggers work correctly for parallel voting

-- 1. Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_post_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Handle new vote insertion
    IF NEW.engagement_type = 'upvote' THEN
      INSERT INTO post_stats (raw_post_id, upvote_count, downvote_count, reply_count, last_updated)
      VALUES (NEW.raw_post_id, 1, 0, 0, NOW())
      ON CONFLICT (raw_post_id)
      DO UPDATE SET
        upvote_count = post_stats.upvote_count + 1,
        last_updated = NOW();
    ELSIF NEW.engagement_type = 'downvote' THEN
      INSERT INTO post_stats (raw_post_id, upvote_count, downvote_count, reply_count, last_updated)
      VALUES (NEW.raw_post_id, 0, 1, 0, NOW())
      ON CONFLICT (raw_post_id)
      DO UPDATE SET
        downvote_count = post_stats.downvote_count + 1,
        last_updated = NOW();
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Handle vote deletion
    IF OLD.engagement_type = 'upvote' THEN
      UPDATE post_stats
      SET
        upvote_count = GREATEST(post_stats.upvote_count - 1, 0),
        last_updated = NOW()
      WHERE raw_post_id = OLD.raw_post_id;
    ELSIF OLD.engagement_type = 'downvote' THEN
      UPDATE post_stats
      SET
        downvote_count = GREATEST(post_stats.downvote_count - 1, 0),
        last_updated = NOW()
      WHERE raw_post_id = OLD.raw_post_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. The triggers are already created, but let's verify they exist
-- If they don't exist, uncomment the lines below:

-- DROP TRIGGER IF EXISTS trigger_update_vote_count_insert ON post_engagement;
-- DROP TRIGGER IF EXISTS trigger_update_vote_count_delete ON post_engagement;

-- CREATE TRIGGER trigger_update_vote_count_insert
--   AFTER INSERT ON post_engagement
--   FOR EACH ROW
--   WHEN (NEW.engagement_type IN ('upvote', 'downvote'))
--   EXECUTE FUNCTION update_post_vote_count();

-- CREATE TRIGGER trigger_update_vote_count_delete
--   AFTER DELETE ON post_engagement
--   FOR EACH ROW
--   WHEN (OLD.engagement_type IN ('upvote', 'downvote'))
--   EXECUTE FUNCTION update_post_vote_count();

-- 3. Fix existing post stats by recalculating from engagement data
-- This will correct any posts that have incorrect vote counts
WITH vote_counts AS (
  SELECT 
    raw_post_id,
    COUNT(CASE WHEN engagement_type = 'upvote' THEN 1 END) as upvote_count,
    COUNT(CASE WHEN engagement_type = 'downvote' THEN 1 END) as downvote_count
  FROM post_engagement
  GROUP BY raw_post_id
)
INSERT INTO post_stats (raw_post_id, upvote_count, downvote_count, reply_count, last_updated)
SELECT 
  vc.raw_post_id,
  vc.upvote_count,
  vc.downvote_count,
  COALESCE(ps.reply_count, 0) as reply_count,
  NOW()
FROM vote_counts vc
LEFT JOIN post_stats ps ON vc.raw_post_id = ps.raw_post_id
ON CONFLICT (raw_post_id)
DO UPDATE SET
  upvote_count = EXCLUDED.upvote_count,
  downvote_count = EXCLUDED.downvote_count,
  last_updated = NOW();

-- 4. Create post_stats records for posts that have engagement but no stats
INSERT INTO post_stats (raw_post_id, upvote_count, downvote_count, reply_count, last_updated)
SELECT DISTINCT
  pe.raw_post_id,
  0 as upvote_count,
  0 as downvote_count,
  0 as reply_count,
  NOW()
FROM post_engagement pe
LEFT JOIN post_stats ps ON pe.raw_post_id = ps.raw_post_id
WHERE ps.raw_post_id IS NULL
ON CONFLICT (raw_post_id) DO NOTHING;
