// Wire types and runtime schemas for couchpad. Zero dependencies beyond zod.
import { z } from 'zod';

/** Phone -> host input sample. `t` is a sender-local timestamp in ms. */
export interface InputFrame {
  t: number;
  axes?: { x: number; y: number };
  buttons?: Record<string, boolean>;
  tilt?: { x: number; y: number };
  swipe?: 'up' | 'down' | 'left' | 'right';
  /** PNG/JPEG data URL from the draw widget. */
  draw?: string;
  vote?: number;
  text?: string;
}

const xy = z.object({ x: z.number(), y: z.number() });

export const InputFrameSchema: z.ZodType<InputFrame> = z.object({
  t: z.number(),
  axes: xy.optional(),
  buttons: z.record(z.string(), z.boolean()).optional(),
  tilt: xy.optional(),
  swipe: z.enum(['up', 'down', 'left', 'right']).optional(),
  draw: z.string().optional(),
  vote: z.number().int().optional(),
  text: z.string().optional(),
});

/** Declarative description of one on-phone control. */
export type ControlWidget =
  | { kind: 'joystick'; id: string }
  | { kind: 'button'; id: string; label: string }
  | { kind: 'hold'; id: string; label: string }
  | { kind: 'tilt'; id: string }
  | { kind: 'swipe'; id: string }
  | { kind: 'draw'; id: string; prompt: string }
  | { kind: 'vote'; id: string; options: string[] }
  | { kind: 'text'; id: string; placeholder: string };

const id = z.string().min(1).max(32);

export const ControlWidgetSchema: z.ZodType<ControlWidget> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('joystick'), id }),
  z.object({ kind: z.literal('button'), id, label: z.string().min(1).max(20) }),
  z.object({ kind: z.literal('hold'), id, label: z.string().min(1).max(20) }),
  z.object({ kind: z.literal('tilt'), id }),
  z.object({ kind: z.literal('swipe'), id }),
  z.object({ kind: z.literal('draw'), id, prompt: z.string().min(1).max(80) }),
  z.object({ kind: z.literal('vote'), id, options: z.array(z.string().min(1).max(40)).min(2).max(6) }),
  z.object({ kind: z.literal('text'), id, placeholder: z.string().max(60) }),
]);

/**
 * Messages exchanged directly between host and phone (WebRTC DataChannel, or wrapped in `relay`).
 * `screen` is the host telling the phone which screen to show; `name` is app-defined.
 */
export const PeerMsgSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('input'), frame: InputFrameSchema }),
  z.object({ t: z.literal('screen'), name: z.string().min(1).max(32), data: z.unknown().optional() }),
  z.object({ t: z.literal('ping'), id: z.number() }),
  z.object({ t: z.literal('pong'), id: z.number() }),
]);
export type PeerMsg = z.infer<typeof PeerMsgSchema>;

export const ROOM_CODE_RE = /^[BCDFGHJKLMNPQRSTVWXZA]{4}$/;

export interface PlayerInfo {
  id: string;
  name: string;
  avatar?: string;
}

/** Error codes the client/host understand. Servers may add more; unknown codes are surfaced as-is. */
export type BackendErrorCode =
  | 'room.notFound' | 'room.full' | 'room.badRequest' | 'room.notInRoom' | 'room.targetGone'
  | 'room.badToken' | 'room.rateLimited' | (string & {});

/** Client (host or phone) -> signaling server. */
export type ClientToBackend =
  | { t: 'room.create'; household?: string }
  | { t: 'room.join'; code: string; name: string; rejoinToken?: string }
  | { t: 'room.resume'; code: string; tvToken: string }
  | { t: 'signal'; to: string; data: unknown }
  | { t: 'relay'; to?: string; data: unknown }
  | { t: 'ping' };

/** Signaling server -> client (host or phone). */
export type BackendToClient =
  | { t: 'room.created'; code: string; tvToken: string }
  | { t: 'room.resumed'; players?: PlayerInfo[] }
  | { t: 'room.joined'; playerId: string; token: string; name: string }
  | { t: 'player.joined'; player: PlayerInfo }
  | { t: 'player.left'; playerId: string }
  | { t: 'tv.left' }
  | { t: 'tv.back' }
  | { t: 'signal'; from: string; data: unknown }
  | { t: 'relay'; from: string; data: unknown }
  | { t: 'pong' }
  | { t: 'error'; code: BackendErrorCode; message?: string };
// Servers may send extra application messages (forge progress, chat, ...); couchpad ignores unknown `t` values.
