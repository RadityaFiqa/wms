"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogAction = exports.AUDIT_ACTION_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.AUDIT_ACTION_KEY = 'audit_action';
const AuditLogAction = (action) => (0, common_1.SetMetadata)(exports.AUDIT_ACTION_KEY, action);
exports.AuditLogAction = AuditLogAction;
//# sourceMappingURL=audit-log.decorator.js.map