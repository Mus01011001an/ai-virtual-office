import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityService } from './activity.service';

/**
 * Generic activity listener.
 * Emit event 'system.activity.log' from anywhere in the app to log an activity.
 *
 * Example:
 *   this.eventEmitter.emit('system.activity.log', {
 *     companyId: 'xxx',
 *     actorId: 'user-id',
 *     action: 'created',
 *     subjectType: 'User',
 *     subjectId: 'subject-id',
 *     description: 'User created a new record',
 *     details: { ... },
 *   });
 */
@Injectable()
export class ActivityListener {
  constructor(private readonly activity: ActivityService) {}

  @OnEvent('system.activity.log')
  async handleGenericLog(payload: any) {
    const {
      companyId,
      actorId,
      action,
      subjectType,
      subjectId,
      description,
      details,
    } = payload;

    await this.activity
      .log(companyId, actorId)
      .action(action)
      .subject(subjectType, subjectId)
      .description(description)
      .details(details)
      .save();
  }
}
