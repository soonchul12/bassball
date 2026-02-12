-- Supabase players 테이블에 경기수(games), 삼진(so) 컬럼 추가
-- Supabase 대시보드 → SQL Editor에서 이 스크립트 실행

ALTER TABLE players ADD COLUMN IF NOT EXISTS games integer DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS so integer DEFAULT 0;
