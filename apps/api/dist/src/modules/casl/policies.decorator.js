"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckPolicies = exports.CHECK_POLICIES_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.CHECK_POLICIES_KEY = 'check_policy';
const CheckPolicies = (...handlers) => (0, common_1.SetMetadata)(exports.CHECK_POLICIES_KEY, handlers);
exports.CheckPolicies = CheckPolicies;
//# sourceMappingURL=policies.decorator.js.map