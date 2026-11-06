import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { OfficeEventsService } from '../realtime/office-events.service';
import { UpdatePresenceDto } from './dto/presence.dto';

export interface UserPresenceData {
  userId: string;
  name: string;
  role: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  anim: 'idle' | 'walk' | 'run';
  isSpeaking?: boolean;
  lastSeen: number;
}

@Injectable()
export class PresenceService implements OnModuleDestroy {
  // Map<companyId, Map<userId, UserPresenceData>>
  private readonly store = new Map<string, Map<string, UserPresenceData>>();
  private readonly TTL_MS = 15_000; // 15 detik timeout eviction
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly events: OfficeEventsService) {
    this.cleanupTimer = setInterval(() => this.cleanupStalePresence(), 4_000);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  updatePresence(
    companyId: string,
    user: { id: string; name?: string; role?: string },
    dto: UpdatePresenceDto,
  ) {
    if (!this.store.has(companyId)) {
      this.store.set(companyId, new Map());
    }

    const companyMap = this.store.get(companyId)!;
    const now = Date.now();

    // Sanity check bounds agar posisi tidak di luar kantor
    const clampedX = Math.max(-38, Math.min(38, dto.x));
    const clampedZ = Math.max(-28, Math.min(38, dto.z));

    const data: UserPresenceData = {
      userId: user.id,
      name: user.name || 'Member',
      role: user.role || 'MEMBER',
      x: clampedX,
      y: dto.y,
      z: clampedZ,
      yaw: dto.yaw,
      anim: dto.anim || 'idle',
      isSpeaking: !!dto.isSpeaking,
      lastSeen: now,
    };

    companyMap.set(user.id, data);

    const onlineList = Array.from(companyMap.values());

    // Siarkan pembaruan kehadiran ke seluruh klien di company ini via SSE
    this.events.emit(companyId, 'presence.update', {
      count: onlineList.length,
      users: onlineList,
    });

    return {
      onlineCount: onlineList.length,
    };
  }

  relayVoiceSignal(companyId: string, fromUserId: string, payload: { toUserId?: string; signal: any }) {
    this.events.emit(companyId, 'presence.voice-signal', {
      fromUserId,
      toUserId: payload.toUserId,
      signal: payload.signal,
    });
    return { success: true };
  }

  getOnlineUsers(companyId: string): UserPresenceData[] {
    const companyMap = this.store.get(companyId);
    return companyMap ? Array.from(companyMap.values()) : [];
  }

  removeUser(companyId: string, userId: string) {
    const companyMap = this.store.get(companyId);
    if (companyMap && companyMap.delete(userId)) {
      const remaining = Array.from(companyMap.values());
      this.events.emit(companyId, 'presence.update', {
        count: remaining.length,
        users: remaining,
      });
    }
  }

  private cleanupStalePresence() {
    const now = Date.now();
    for (const [companyId, users] of this.store.entries()) {
      let evicted = false;
      for (const [userId, data] of users.entries()) {
        if (now - data.lastSeen > this.TTL_MS) {
          users.delete(userId);
          evicted = true;
        }
      }
      if (evicted) {
        const remaining = Array.from(users.values());
        this.events.emit(companyId, 'presence.update', {
          count: remaining.length,
          users: remaining,
        });
      }
    }
  }
}
