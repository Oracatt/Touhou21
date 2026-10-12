import type {ReplayData, ReplayPlayer, ReplayRecorder} from '@ts-stg/thlib';
import type {TouhouEnemy, TouhouSpellRecord, TouhouSpellResult} from '@ts-stg/thlib/touhou';

export type PlayerId = 'reimu' | 'marisa';
export type CampaignMode = 'normal' | 'extra' | 'stage-practice' | 'spell-practice';
export type DialogueKind = 'before' | 'after' | 'midboss';
export interface DialogueLine {speaker: PlayerId | 'boss'; text: string;}
export interface DialogueCues {appear: number; portrait?: number; music: number;}
export interface SpellDefinition {
  id: string; name: string; motif: string; pattern: string; description: string;
  seconds: number; survival: boolean; code: number; stageId: number; spellIndex: number; midboss: boolean;
}
export interface StageDefinition {
  id: number; title: string; subtitle: string; location: string; bossId: string;
  colors: string[]; background: string; bgmStage: string; bgmBoss: string;
  roadFrames: number; midbossAt: number; nonspellNames: string[]; phaseLayout: string;
  midbossSpells: SpellDefinition[]; spells: SpellDefinition[];
  dialogues: Record<PlayerId, Partial<Record<DialogueKind, DialogueLine[]>>>;
  extra?: boolean; bossName?: string; midbossName?: string;
}
export interface MidbossDefinition {
  stageId: number; bossId: string; entrance: string; title: string; atFrame: number;
  nonspell: boolean; seconds: number; spells: SpellDefinition[];
  dialogues: Record<PlayerId, DialogueLine[]> | null; exit?: 'escape' | 'defeat';
}
export interface CharacterDefinition {
  id: string; name: string; reading: string; title: string; species: string; ability: string;
  occupation: string; location: string; colors: string[]; portrait: string;
  personality: string; backstory: string; design: Record<string, string>; spellTheme: string;
}
export interface PlayerDefinition {
  id: PlayerId; name: string; title: string; preset: PlayerId; colors: string[];
  description: string; route: string; portrait: string;
}
export interface RunConfig {
  character: number; difficulty: number; mode: CampaignMode;
  stageId: number; spellId: string | null; seed: number;
}
export interface RunOptions extends Partial<RunConfig> {
  testing?: boolean; fixedClock?: boolean; autoCapture?: boolean; autoDialogue?: boolean;
  autoStageClear?: boolean; invincible?: boolean; skipRoad?: boolean; unlockAll?: boolean;
  autostart?: boolean; page?: string;
}
export type CaptureRecord = TouhouSpellResult & {stage: number};
export interface RunResult {
  ending: 'good' | 'bad' | 'extra'; character: number; difficulty: number;
  mode: CampaignMode; score: number; continues: number; stageId: number;
  captures: CaptureRecord[];
}
export type RunSummary = Partial<RunResult> & {aborted?: boolean};
export type SpellRecords = Record<number, TouhouSpellRecord>;
export interface Progress {
  clears: Record<string, {difficulty: number; continues: number; score: number; noContinueClear: boolean}>;
  extraClears: Record<number, number>; stageUnlock: number; seenSpells: string[];
  spellRecords: Record<string, SpellRecords>; scores: Array<RunResult & {date: number}>; plays: number;
}
export interface RunReplayConfig extends RunConfig {
  game: string; revision: number; backend: string; startingLives: number;
  initialSpellRecords: SpellRecords; initialHighScore: number;
  spellTimes: Array<{stage: number; captureIndex: number; encoded: number}>;
}
export type RunReplayData = Omit<ReplayData, 'config'> & {config: RunReplayConfig};
export type RunRecorder = Omit<ReplayRecorder, 'config' | 'toJSON'> & {config: RunReplayConfig; toJSON(): RunReplayData};
export type RunPlayback = Omit<ReplayPlayer, 'config' | 'data'> & {config: RunReplayConfig; data: RunReplayData};
export interface CampaignEnemy extends TouhouEnemy {
  kind?: string; bossId?: string; stageId?: number; _spriteDirection?: number;
  roadWaveId?: string; roadRole?: string; roadAttack?: string; roadFormation?: string;
}
export type CampaignBoss = CampaignEnemy & {bossId: string;maximumHp:number};
