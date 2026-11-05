/**
 * Konstanta permission (pola Musyan: string `resource:action`, wildcard '*').
 * Setiap key baru WAJIB juga didaftarkan di system/role-permission/permission.definitions.ts.
 */
export const P_WILDCARD = '*';

// Office (company)
export const P_OFFICE_READ = 'office:read';
export const P_OFFICE_UPDATE = 'office:update';
export const P_OFFICE_DELETE = 'office:delete';

// Members & roles
export const P_USER_READ = 'member:read'; // alias nama Musyan, dipakai controller salinan
export const P_MEMBER_READ = 'member:read';
export const P_MEMBER_MANAGE = 'member:manage';
export const P_ROLE_MANAGE = 'role:manage';

// AI providers (kredensial model)
export const P_AI_PROVIDER_READ = 'ai.provider:read';
export const P_AI_PROVIDER_MANAGE = 'ai.provider:manage';

// Workforce
export const P_EMPLOYEE_READ = 'employee:read';
export const P_EMPLOYEE_WRITE = 'employee:write';
export const P_EMPLOYEE_DELETE = 'employee:delete';
export const P_EMPLOYEE_INSTRUCT = 'employee.instruction:send';
export const P_TASK_READ = 'task:read';
export const P_TASK_CREATE = 'task:create';
export const P_TASK_CANCEL = 'task:cancel';

// Discussion
export const P_DISCUSSION_READ = 'discussion:read';
export const P_DISCUSSION_SEND = 'discussion:send';
export const P_SUMMON_USE = 'summon:use';

// Files
export const P_FILE_UPLOAD = 'file:upload';

// Audit
export const P_ACTIVITY_READ = 'activity:read';
