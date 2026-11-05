import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { AssetService } from 'src/asset/asset.service';

export class ActivityLogBuilder {
  private data: any = {};

  constructor(
    private db: DatabaseService,
    companyId?: string,
    userId?: string,
  ) {
    this.data.companyId = companyId;
    this.data.userId = userId;
  }

  action(action: string): this {
    this.data.action = action;
    return this;
  }

  subject(type: string, id: string): this {
    this.data.subjectType = type;
    this.data.subjectId = id;
    return this;
  }

  description(desc: string): this {
    this.data.description = desc;
    return this;
  }

  details(details: any): this {
    this.data.details = details;
    return this;
  }

  ip(ip: string): this {
    this.data.ipAddress = ip;
    return this;
  }

  userAgent(ua: string): this {
    this.data.userAgent = ua;
    return this;
  }

  async save() {
    if (!this.data.action || !this.data.subjectType || !this.data.subjectId) {
      console.warn(
        'ActivityLog: Missing required fields (action, subjectType, or subjectId). Log might not be saved correctly.',
      );
    }

    return this.db.activityLog.create({
      data: this.data,
    });
  }
}

@Injectable()
export class ActivityService {
  constructor(
    private db: DatabaseService,
    private asset: AssetService,
  ) {}

  log(companyId?: string, userId?: string): ActivityLogBuilder {
    return new ActivityLogBuilder(this.db, companyId, userId);
  }

  async findAll(params: {
    subjectType: string;
    subjectId?: string;
    companyId: string;
    page?: number;
    limit?: number;
    q?: string;
  }) {
    const {
      subjectType,
      subjectId,
      companyId,
      page = 0,
      limit = 10,
      q,
    } = params;

    const where: any = { subjectType };

    if (companyId) {
      where.companyId = companyId;
    }

    if (subjectId) {
      where.subjectId = subjectId;
    }

    if (q && q.trim() !== '' && q !== 'undefined' && q !== 'null') {
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.db.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: page * limit,
        take: limit,
      }),
      this.db.activityLog.count({ where }),
    ]);

    // Map users to get avatars from AssetService
    const users = data.filter((log) => !!log.user).map((log) => log.user!);

    // De-duplicate users by ID
    const uniqueUsers = Array.from(
      new Map(users.map((u) => [u.id, u])).values(),
    );

    const usersWithAvatars = await this.asset.attachPrimaryToMany(
      { subjectType: 'user', field: 'avatar' },
      uniqueUsers,
    );

    const userMap = new Map(usersWithAvatars.map((u: any) => [u.id, u]));

    const mappedData = data.map((log) => {
      if (log.user) {
        const userWithAvatar = userMap.get(log.user.id);
        if (userWithAvatar) {
          (log.user as any).image = userWithAvatar.avatar?.url || null;
        }
      }
      return log;
    });

    return { data: mappedData, meta: { total } };
  }
}
