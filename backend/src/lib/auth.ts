import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { customSession, bearer } from 'better-auth/plugins';
import { getPresignedReadUrl, prisma } from 'src/common/infrastructure';

/**
 * Better Auth — disalin dari boilerplate Musyan (src/lib/auth.ts), dipangkas:
 * tanpa menu dinamis, ghost mode, dan Google OAuth.
 * Token sesi dipakai sebagai Bearer token (plugin `bearer()`), bukan cookie.
 */
const SESSION_NO_EXPIRY_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export const auth: any = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  user: {
    additionalFields: {
      roleId: { type: 'string', input: false },
      phone: { type: 'string', input: false },
      companyId: { type: 'string', input: false },
      lastActiveCompanyId: { type: 'string', input: false },
      isSuperAdmin: { type: 'boolean', input: false },
      mustChangePassword: { type: 'boolean', input: false },
    },
  },
  session: {
    // Maks 400 hari (dipakai juga sebagai Max-Age cookie internal better-auth).
    expiresIn: 60 * 60 * 24 * 400,
    updateAge: 60 * 60 * 24,
    additionalFields: {
      activeCompanyId: { type: 'string', input: false },
      sessionType: { type: 'string', input: false },
    },
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:5173'],

  plugins: [
    bearer(),
    customSession(async ({ user, session }) => {
      // query independen dijalankan paralel (DB remote ±200 ms per round-trip saat development)
      const [dbUser, memberships] = await Promise.all([
        prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true, name: true, email: true, companyId: true, lastActiveCompanyId: true,
            isSuperAdmin: true, mustChangePassword: true,
          },
        }),
        prisma.companyMember.findMany({
          where: { userId: user.id, isActive: true, invitationStatus: 'accepted', company: { deletedAt: null } },
          include: {
            company: { select: { id: true, name: true } },
            role: { select: { id: true, name: true, isDefault: true } },
          },
          orderBy: { joinedAt: 'asc' },
        }),
      ]);
      if (!dbUser) return { user, session };

      const isSuperAdmin = dbUser.isSuperAdmin;

      // Prioritas: session.activeCompanyId → user.lastActiveCompanyId → user.companyId → default → pertama
      const sessionCompanyId = (session as any).activeCompanyId ?? null;
      const userLastCompanyId = dbUser.lastActiveCompanyId ?? dbUser.companyId ?? null;
      const isMember = (id: string | null) => Boolean(id && memberships.some((m) => m.companyId === id));
      const defaultMembership = memberships.find((m) => m.isDefault);
      const activeCompanyId = isMember(sessionCompanyId)
        ? sessionCompanyId
        : isMember(userLastCompanyId)
          ? userLastCompanyId
          : (defaultMembership?.companyId ?? memberships[0]?.companyId ?? null);

      // Self-healing: sinkronkan session & user bila berbeda
      if (session?.id && sessionCompanyId !== activeCompanyId) {
        prisma.session.update({ where: { id: session.id }, data: { activeCompanyId } })
          .catch((err) => console.error('[customSession] gagal sync session.activeCompanyId:', err?.message));
      }
      if (activeCompanyId && dbUser.lastActiveCompanyId !== activeCompanyId) {
        prisma.user.update({ where: { id: user.id }, data: { lastActiveCompanyId: activeCompanyId, companyId: activeCompanyId } })
          .catch((err) => console.error('[customSession] gagal simpan lastActiveCompanyId:', err?.message));
      }

      const activeMembership = memberships.find((m) => m.companyId === activeCompanyId) ?? null;
      const activeRole = activeMembership?.role ?? null;
      const [permRows, avatar] = await Promise.all([
        activeRole
          ? prisma.rolePermission.findMany({ where: { roleId: activeRole.id }, select: { permission: true } })
          : Promise.resolve([] as { permission: string }[]),
        prisma.assets.findFirst({
          where: { subjectType: 'user', subjectId: dbUser.id, isPrimary: true, deletedAt: null },
          select: { key: true },
        }),
      ]);
      const permissions = permRows.map((p) => p.permission);

      return {
        user: {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          isSuperAdmin,
          mustChangePassword: dbUser.mustChangePassword,
          image: avatar?.key ? await getPresignedReadUrl(avatar.key) : null,
          activeCompanyId,
          lastActiveCompanyId: activeCompanyId,
          activeCompany: activeMembership?.company ?? null,
          activeRole: activeRole ? { ...activeRole, permissions } : null,
          // kompatibilitas dengan kode salinan Musyan
          companyId: activeCompanyId,
          roleId: activeRole?.id ?? null,
          role: activeRole ? { ...activeRole, permissions } : null,
          memberships: memberships.map((m) => ({
            companyId: m.companyId,
            companyName: m.company.name,
            role: m.role,
            isDefault: m.isDefault,
            isOwner: m.isOwner,
          })),
        },
        session,
      };
    }),
  ],

  // expiresAt 10 tahun: sesi berakhir lewat logout / dicabut (pola Musyan).
  databaseHooks: {
    session: {
      create: {
        before: async (session) => ({
          data: { ...session, expiresAt: new Date(Date.now() + SESSION_NO_EXPIRY_MS) },
        }),
      },
    },
  },

  advanced: { database: { generateId: 'uuid' } },
});
