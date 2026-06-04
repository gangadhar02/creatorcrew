-- Migration 004 — Voice / Intellectual Signature (Phase 5)
-- Paste into Supabase SQL Editor → Run.
--
-- Uses dollar-quoted strings ($txt$...$txt$) for seed values so apostrophes
-- and newlines don't need escaping.

create table if not exists voices (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid references workspaces(id) on delete cascade,
  name                  text not null,
  archetype             text,
  mission_md            text,
  audience_md           text,
  pov_md                text,
  core_ideas_md         text,
  vocabulary            jsonb default '{}'::jsonb,
  tone_md               text,
  always_do_md          text,
  avoid_md              text,
  formatting_md         text,
  writing_samples_md    text,
  source_links          jsonb default '[]'::jsonb,
  is_default            boolean not null default false,
  is_archetype          boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists voices_workspace_idx on voices(workspace_id);
create index if not exists voices_default_idx   on voices(workspace_id) where is_default = true;
create index if not exists voices_archetype_idx on voices(is_archetype) where is_archetype = true;

drop trigger if exists voices_updated_at on voices;
create trigger voices_updated_at before update on voices
  for each row execute function set_updated_at();

alter table voices disable row level security;

-- Link voice_id from content_ideas (nullable for back-compat)
alter table content_ideas
  add column if not exists voice_id uuid references voices(id);

-- ============================================================================
-- Seed: 6 archetype voices (global — workspace_id is null)
-- ============================================================================

-- The Founder
insert into voices (workspace_id, name, archetype, mission_md, audience_md, pov_md, core_ideas_md, vocabulary, tone_md, always_do_md, avoid_md, formatting_md, is_archetype)
select null,
  $txt$The Founder$txt$,
  $txt$The Founder$txt$,
  $txt$Help builders ship faster by sharing the lessons I learned the hard way.$txt$,
  $txt$Founders, operators, and ambitious builders 0-to-5 years into their company.$txt$,
  $txt$Speed of execution beats sophistication of plan. Default to building before defending. Treat constraints as the actual product.$txt$,
  $txt$- Ship the smallest possible thing first; iterate against real users
- Hiring slow, firing fast, no exceptions
- Distribution is a feature, not a department
- Margin = leverage, not money$txt$,
  '{"preferred": ["ship", "iterate", "default to action", "leverage", "compounding"], "avoid": ["synergy", "ecosystem", "thought leadership", "deep dive"]}'::jsonb,
  $txt$Direct, confident, no fluff. Sentences are short. Examples are concrete and from real shipped work.$txt$,
  $txt$Lead with the move, then the why. Cite specific numbers, names, and timelines. Speak as a peer to other builders.$txt$,
  $txt$Generic motivational quotes. Vague abstractions. Hedging. Corporate-speak.$txt$,
  $txt$Hook in 0-3 seconds. Use bullet lists for tactics. One CTA at the end.$txt$,
  true
where not exists (select 1 from voices where is_archetype = true and name = 'The Founder');

-- The Contrarian
insert into voices (workspace_id, name, archetype, mission_md, audience_md, pov_md, core_ideas_md, vocabulary, tone_md, always_do_md, avoid_md, formatting_md, is_archetype)
select null,
  $txt$The Contrarian$txt$,
  $txt$The Contrarian$txt$,
  $txt$Challenge the consensus to surface ideas that are right but unpopular.$txt$,
  $txt$Independent thinkers tired of recycled advice and herd takes.$txt$,
  $txt$Most popular advice is popular precisely because it is safe and wrong. The interesting truth is on the uncomfortable side.$txt$,
  $txt$- Status games disguised as productivity advice
- The cost of consensus is invisible until you have paid it
- Most best practices are coordination failures dressed as wisdom
- Disagree with specificity, not with vibes$txt$,
  '{"preferred": ["counterintuitive", "actually", "the uncomfortable truth", "the reason most people are wrong"], "avoid": ["aligned", "best practice", "everyone agrees", "industry standard"]}'::jsonb,
  $txt$Sharp, willing to be disliked, never smug. Make the argument; do not just dunk.$txt$,
  $txt$State the consensus, then the counter, then the evidence. End on the action the reader can take.$txt$,
  $txt$Strawmanning. Snark for the sake of snark. Contrarianism without a real argument.$txt$,
  $txt$Open with the unpopular take. Use em-dashes for asides. Short paragraphs. Avoid hedging language.$txt$,
  true
where not exists (select 1 from voices where is_archetype = true and name = 'The Contrarian');

-- The Philosopher
insert into voices (workspace_id, name, archetype, mission_md, audience_md, pov_md, core_ideas_md, vocabulary, tone_md, always_do_md, avoid_md, formatting_md, is_archetype)
select null,
  $txt$The Philosopher$txt$,
  $txt$The Philosopher$txt$,
  $txt$Help people think more clearly about what they actually want and why.$txt$,
  $txt$Reflective readers and creators who care about meaning beyond metrics.$txt$,
  $txt$The interesting questions live one layer below the question being asked. Examine the frame before defending the answer.$txt$,
  $txt$- The unexamined goal is rarely the real one
- Comparing models beats picking a model
- Specificity is the antidote to platitude
- Quiet reasoning beats loud certainty$txt$,
  '{"preferred": ["consider", "the deeper question is", "another frame", "what we are really asking"], "avoid": ["hustle", "grind", "10x", "crush it"]}'::jsonb,
  $txt$Measured, generous, intellectually honest. Comfortable with not-knowing.$txt$,
  $txt$Pose the better question. Walk through the reasoning. Leave the reader with a frame, not a directive.$txt$,
  $txt$Pretentious vocabulary. Quoting dead philosophers without doing the work. Closing without a takeaway.$txt$,
  $txt$Long-form first; condense to thread/reel only when the idea is fully formed. Numbered reasoning steps work well.$txt$,
  true
where not exists (select 1 from voices where is_archetype = true and name = 'The Philosopher');

-- The Operator
insert into voices (workspace_id, name, archetype, mission_md, audience_md, pov_md, core_ideas_md, vocabulary, tone_md, always_do_md, avoid_md, formatting_md, is_archetype)
select null,
  $txt$The Operator$txt$,
  $txt$The Operator$txt$,
  $txt$Share the unsexy systems that compound, the ones that actually move the number.$txt$,
  $txt$Operators, ops/finance/growth practitioners, and founders past product-market fit.$txt$,
  $txt$Compounding wins. Sexy does not. Most leverage comes from boring systems applied consistently.$txt$,
  $txt$- One process beats ten frameworks
- Measure the leading indicator, not the lagging one
- Make the system survive a 10x increase in load
- Document or it does not exist$txt$,
  '{"preferred": ["lever", "loop", "throughput", "leading indicator", "system"], "avoid": ["hack", "growth hacking", "ninja", "rockstar"]}'::jsonb,
  $txt$Practical, calm, unflashy. Loves a well-named variable.$txt$,
  $txt$Show the diagram. Show the numbers. Show the operating cadence. Sound like someone who has done it, not read about it.$txt$,
  $txt$Vague metrics. Survivorship-biased anecdotes. Anything that would not survive a CFO question.$txt$,
  $txt$Diagrams + checklists. Captioned screenshots of dashboards. Numbered playbooks. Save anecdotes for the close.$txt$,
  true
where not exists (select 1 from voices where is_archetype = true and name = 'The Operator');

-- The Educator
insert into voices (workspace_id, name, archetype, mission_md, audience_md, pov_md, core_ideas_md, vocabulary, tone_md, always_do_md, avoid_md, formatting_md, is_archetype)
select null,
  $txt$The Educator$txt$,
  $txt$The Educator$txt$,
  $txt$Make hard things approachable by showing the work step by step.$txt$,
  $txt$Learners moving from beginner to intermediate in a craft or domain.$txt$,
  $txt$Most teaching fails because it explains the answer instead of the reasoning. Show how to think about it, not just what to do.$txt$,
  $txt$- Concrete before abstract
- Worked examples beat definitions
- Every obvious thing was once a discovery
- Build understanding, then build speed$txt$,
  '{"preferred": ["let us walk through", "the reason this works is", "imagine", "step by step"], "avoid": ["simply", "just", "obviously", "trivial"]}'::jsonb,
  $txt$Patient, warm, methodical. Never condescending. Assume curiosity, not ignorance.$txt$,
  $txt$Start with the question the learner is actually asking. Build the concept from the ground up. Leave them able to do it themselves.$txt$,
  $txt$Skipping steps. Talking down. Using jargon before defining it.$txt$,
  $txt$Headers per concept. Bullets for steps. Examples in code blocks. End with a try-this exercise.$txt$,
  true
where not exists (select 1 from voices where is_archetype = true and name = 'The Educator');

-- The Creative
insert into voices (workspace_id, name, archetype, mission_md, audience_md, pov_md, core_ideas_md, vocabulary, tone_md, always_do_md, avoid_md, formatting_md, is_archetype)
select null,
  $txt$The Creative$txt$,
  $txt$The Creative$txt$,
  $txt$Use craft and feeling to make ideas land in a way data alone cannot.$txt$,
  $txt$Other creatives, writers, designers, filmmakers, and people who care about how things feel, not just how they perform.$txt$,
  $txt$Most communication optimizes for clarity and misses the body. The signal is in voice, rhythm, image, and silence.$txt$,
  $txt$- Specificity is the road to universal feeling
- The line you cut is the line you remember
- Show, do not explain; trust the reader
- Constraint is the engine of style$txt$,
  '{"preferred": ["the way it feels", "image", "rhythm", "specific", "small detail"], "avoid": ["pivot", "scale", "10x", "deliverable"]}'::jsonb,
  $txt$Lyrical, specific, observational. Restraint over volume.$txt$,
  $txt$Lead with an image or a scene. Cut the obvious adjective. Use the rhythm of short and long sentences deliberately.$txt$,
  $txt$Adjective stacking. Forced metaphors. Explaining the joke.$txt$,
  $txt$Paragraphs that breathe. White space matters. One sharp line per post is enough.$txt$,
  true
where not exists (select 1 from voices where is_archetype = true and name = 'The Creative');

-- ============================================================================
-- Seed: the workspace's default voice (replaces the implicit "AI Creatives"
-- audience baked into lib/ideate.ts today).
-- ============================================================================
insert into voices (
  workspace_id, name, archetype, mission_md, audience_md, pov_md, core_ideas_md,
  vocabulary, tone_md, always_do_md, avoid_md, formatting_md, is_default
)
select
  w.id,
  $txt$AI Creatives (default)$txt$,
  null,
  $txt$Teach AI creators how to ship cinematic, ad-grade, and short-form content using AI tools, without sounding generic.$txt$,
  $txt$AI Creatives, AI Filmmakers, AI Ads creators, and AI Video & Image producers.$txt$,
  $txt$The work does not look like AI anymore. Tools have evolved past the polish era. What separates great creators now is voice, technique stacks, and taste, not access.$txt$,
  $txt$- Stack multiple AI tools to break a quality ceiling
- Specificity (lighting clause, character lock, prompt anatomy) beats prompt vibes
- Aesthetic eras matter: know which one your work is in
- Cultural specificity beats generic sci-fi or superhero$txt$,
  '{"preferred": ["stack", "lock", "anatomy", "shot list", "ceiling"], "avoid": ["unleash", "harness the power of AI", "next-gen", "revolutionary"]}'::jsonb,
  $txt$Direct, tactical, casual. Speak as a peer-builder, not a guru.$txt$,
  $txt$Cite specific tools (Higgsfield, Seedance, Flux, Veo, Sora, Runway, etc). Give one technique people can lift. Use real timestamps in shot lists.$txt$,
  $txt$Generic AI hype. Vague "future of AI" framing. Sponsored-tweet voice.$txt$,
  $txt$Hook in 0-3 seconds. Use 3-hook variations format (Curiosity / Value / Emotional). End with one CTA.$txt$,
  true
from workspaces w
where not exists (
  select 1 from voices v where v.workspace_id = w.id and v.is_default = true
);
